"""
User Management Router — all user CRUD, password, clone, impersonation endpoints.
Follows the capture_router.py pattern exactly.
"""
from __future__ import annotations
import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user, hash_password, verify_token, create_token
from database import get_db
from models.user import User
from models.user_mgmt_models import UserType
from schemas.user_schemas import (
    ActivityDashboardResponse, AuditLogResponse, CloneResultResponse,
    ImpersonateRequest, PasswordChangeRequest, PasswordResetRequest,
    UserCreateRequest, UserListResponse, UserResponse, UserSummaryResponse,
    UserUpdateRequest,
)
from services.permission_service import get_effective_permissions, write_audit_log
from services.user_service import (
    activate_user, change_own_password, check_privilege_chain,
    clone_user, create_user, deactivate_user, reset_password,
)

router = APIRouter(tags=["User Management"])

N8N_BASE_URL = os.getenv("N8N_BASE_URL", "")


def _notify_n8n(event: str, payload: dict) -> None:
    """Fire-and-forget n8n webhook. Skipped if N8N_BASE_URL not set."""
    if not N8N_BASE_URL:
        return
    try:
        import httpx
        httpx.post(f"{N8N_BASE_URL}/webhook/{event}", json=payload, timeout=5)
    except Exception:
        pass


# ── Create user ───────────────────────────────────────────────────────────────

@router.post("/", response_model=UserResponse)
def create_user_endpoint(
    payload: UserCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new user (full 5-step wizard payload). Enforces privilege chain."""
    user = create_user(db, payload, current_user)
    background_tasks.add_task(_notify_n8n, "user-created", {
        "user_id": str(user.id), "username": user.username,
        "full_name": user.full_name, "user_type": user.user_type,
    })
    return user


# ── List users ────────────────────────────────────────────────────────────────

@router.get("/", response_model=UserListResponse)
def list_users(
    user_type:  Optional[str]  = Query(None),
    user_kind:  Optional[str]  = Query(None),
    is_active:  Optional[bool] = Query(None),
    q:          Optional[str]  = Query(None),
    skip:       int = Query(0, ge=0),
    limit:      int = Query(50, le=200),
    db:         Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List users. Results are scoped to what the caller can see."""
    query = db.query(User)
    caller_type = current_user.user_type or ""

    # SITE_ADMIN only sees users of their sites — simplified: scope to is_active=True others
    if caller_type not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        query = query.filter(User.id != current_user.id)

    if user_type:
        query = query.filter(User.user_type == user_type)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if q:
        query = query.filter(
            User.username.ilike(f"%{q}%") | User.full_name.ilike(f"%{q}%")
        )

    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return UserListResponse(
        total=total,
        items=[UserSummaryResponse.model_validate(u) for u in items],
    )


# ── Get user ──────────────────────────────────────────────────────────────────

@router.get("/activity", response_model=ActivityDashboardResponse)
def activity_dashboard(
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Activity dashboard stats."""
    from sqlalchemy import func
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    active_count   = db.query(User).filter(User.is_active == True).count()
    dormant_count  = db.query(User).filter(
        User.is_active == True,
        (User.last_login_at == None) | (User.last_login_at < thirty_days_ago),
    ).count()
    recent_logins  = (
        db.query(User)
        .filter(User.last_login_at != None)
        .order_by(User.last_login_at.desc())
        .limit(10)
        .all()
    )
    return ActivityDashboardResponse(
        active_count=active_count,
        dormant_count=dormant_count,
        external_count=0,
        expiring_soon=0,
        recent_logins=[UserSummaryResponse.model_validate(u) for u in recent_logins],
    )


@router.get("/expiring-soon", response_model=UserListResponse)
def expiring_soon(
    days: int = Query(3, ge=1),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Users whose external access expires within `days` days. Used by n8n scheduler."""
    cutoff = datetime.utcnow() + timedelta(days=days)
    items = db.query(User).filter(
        User.expires_at != None, User.expires_at <= cutoff, User.is_active == True
    ).all()
    return UserListResponse(total=len(items), items=[UserSummaryResponse.model_validate(u) for u in items])


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db:      Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Get a single user with their full profile."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


# ── Update user ───────────────────────────────────────────────────────────────

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    db:      Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update basic info (name, email, phone, dept, designation)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_val = {"full_name": user.full_name, "email": user.email}
    if payload.full_name:    user.full_name    = payload.full_name
    if payload.email:        user.email        = payload.email
    if payload.phone:        user.phone        = payload.phone
    if payload.department:   user.department   = payload.department
    if payload.designation:  user.designation  = payload.designation
    if payload.organisation: user.organisation = payload.organisation
    if payload.expires_at:   user.expires_at   = payload.expires_at

    write_audit_log(db, target_user_id=user_id, changed_by=current_user.id,
                    change_type="updated", table_name="users",
                    old_val=old_val,
                    new_val={"full_name": user.full_name, "email": user.email})
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


# ── Activate / Deactivate ─────────────────────────────────────────────────────

@router.post("/{user_id}/activate")
def activate(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activate a user."""
    activate_user(db, user_id, current_user)
    return {"success": True, "message": "User activated"}


@router.post("/{user_id}/deactivate")
def deactivate(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token_data: dict = Depends(verify_token),
):
    """Deactivate user and invalidate their sessions."""
    deactivate_user(db, user_id, current_user)
    return {"success": True, "message": "User deactivated"}


# ── Password management ───────────────────────────────────────────────────────

@router.post("/{user_id}/reset-password")
def admin_reset_password(
    user_id: UUID,
    payload: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin resets a user's password. User must change on next login."""
    reset_password(db, user_id, payload.new_password, current_user)
    background_tasks.add_task(_notify_n8n, "password-reset", {
        "user_id": str(user_id), "reset_by": str(current_user.id),
    })
    return {"success": True, "message": "Password reset. User must change on next login."}


@router.post("/me/change-password")
def change_my_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User changes their own password."""
    change_own_password(db, current_user, payload.old_password, payload.new_password)
    return {"success": True, "message": "Password changed successfully"}


# ── Clone user ────────────────────────────────────────────────────────────────

@router.post("/{user_id}/clone", response_model=CloneResultResponse)
def clone(
    user_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clone a user's full permission profile to a new user."""
    from schemas.user_schemas import CloneUserRequest
    req = CloneUserRequest(
        source_user_id=user_id,
        new_username=payload["new_username"],
        new_full_name=payload["new_full_name"],
        new_password=payload["new_password"],
    )
    return clone_user(db, req, current_user)


# ── Impersonation ─────────────────────────────────────────────────────────────

@router.post("/{user_id}/impersonate")
def impersonate(
    user_id: UUID,
    payload: ImpersonateRequest,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token),
    current_user: User = Depends(get_current_user),
):
    """SUPER_ADMIN only. Returns a scoped JWT for impersonating target user."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN"):
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can impersonate users")

    target = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found or inactive")

    impersonation_token = create_token({
        "sub": target.email,
        "user_id": str(target.id),
        "user_type": target.user_type,
        "impersonating_as": str(current_user.id),
    })

    write_audit_log(
        db, target_user_id=user_id, changed_by=current_user.id,
        change_type="impersonated",
        new_val={"reason": payload.reason},
        impersonating_as=current_user.id,
    )
    db.commit()
    return {"access_token": impersonation_token, "token_type": "bearer", "impersonating": str(user_id)}


@router.post("/impersonate/end")
def end_impersonation(
    _: dict = Depends(verify_token),
):
    """End impersonation — client discards the impersonation token."""
    return {"success": True, "message": "Impersonation ended. Use your original token."}


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/{user_id}/audit-log", response_model=AuditLogResponse)
def get_audit_log(
    user_id: UUID,
    skip:  int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db:    Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Permission change history for a user."""
    from models.user_mgmt_models import PermissionAuditLog
    from schemas.user_schemas import AuditLogEntry
    q = (
        db.query(PermissionAuditLog)
        .filter(PermissionAuditLog.target_user_id == user_id)
        .order_by(PermissionAuditLog.changed_at.desc())
    )
    total = q.count()
    entries = q.offset(skip).limit(limit).all()
    return AuditLogResponse(
        total=total,
        entries=[AuditLogEntry.model_validate(e) for e in entries],
    )
