"""
User Management Router — all user CRUD, password, clone, impersonation endpoints.
Follows the capture_router.py pattern exactly.
"""
from __future__ import annotations
import json
import os
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user, hash_password, verify_token, create_token
from database import get_db
from models.user import User
from models.user_mgmt_models import UserType, UserModuleAssignment, UserSiteAssignment, UserCompanyAssignment
from models.user_project_access import UserProjectAccess
from models.project import Project
from models.user_session import RegisteredDevice, UserSession
from schemas.user_schemas import (
    ActivityDashboardResponse, AuditLogResponse, CloneResultResponse,
    ImpersonateRequest, PasswordChangeRequest, PasswordResetRequest,
    UserCreateRequest, UserListResponse, UserResponse, UserSummaryResponse,
    UserUpdateRequest,
)
from services.permission_service import get_effective_permissions, invalidate_user_sessions, write_audit_log
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
    if payload.email:
        new_email = payload.email.lower()
        if new_email != (user.email or '').lower():
            conflict = db.query(User).filter(User.email == new_email, User.id != user_id).first()
            if conflict:
                raise HTTPException(status_code=409, detail="Email already registered by another user.")
        user.email = new_email
    if payload.phone:        user.phone        = payload.phone
    if payload.department:   user.department   = payload.department
    if payload.designation:  user.designation  = payload.designation
    if payload.organisation: user.organisation = payload.organisation
    if payload.expires_at:   user.expires_at   = payload.expires_at
    if payload.user_type:    user.user_type    = payload.user_type
    if payload.user_kind:    user.user_kind    = payload.user_kind

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
        new_email=payload["new_email"],
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


# ── Module assignments ────────────────────────────────────────────────────────

@router.put("/{user_id}/modules")
def update_user_modules(
    user_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace all module assignments for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    module_ids = payload.get("module_ids", [])

    db.query(UserModuleAssignment).filter(
        UserModuleAssignment.user_id == user_id
    ).delete()

    for module_id in module_ids:
        db.add(UserModuleAssignment(
            user_id=user_id,
            module_id=module_id,
        ))

    write_audit_log(
        db,
        target_user_id=user_id,
        changed_by=current_user.id,
        change_type="updated",
        table_name="user_module_assignments",
        new_val={"module_ids": module_ids},
    )

    db.commit()
    return {"success": True, "module_ids": module_ids}


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


# ── Site assignments ──────────────────────────────────────────────────────────

@router.get("/{user_id}/sites")
def get_user_sites(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return assigned sites (with names) for a user. ADMIN / SUPER_ADMIN only."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_type = user.user_type or ""
    if user_type in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN", "HO_USER"):
        return {"is_all_sites": True, "sites": []}

    site_rows = db.query(UserProjectAccess).filter(
        UserProjectAccess.user_id == user_id,
        UserProjectAccess.is_active == True,
    ).all()
    site_ids = [r.project_id for r in site_rows]

    projects = db.query(Project).filter(Project.id.in_(site_ids)).all() if site_ids else []
    project_map = {p.id: p for p in projects}

    return {
        "is_all_sites": False,
        "sites": [
            {
                "id": str(sid),
                "name": project_map[sid].name if sid in project_map else str(sid),
                "project_code": project_map[sid].project_code if sid in project_map else None,
                "company_id": str(project_map[sid].company_id) if sid in project_map and project_map[sid].company_id else None,
            }
            for sid in site_ids
        ],
    }


@router.put("/{user_id}/sites")
def update_user_sites(
    user_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace all site assignments for a user. ADMIN / SUPER_ADMIN only."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    site_ids   = [UUID(s) for s in payload.get("site_ids", [])]
    company_id = payload.get("company_id")

    # Soft-update UserProjectAccess: deactivate removed sites, reactivate
    # returning ones, and create rows for brand-new additions.
    existing_rows = db.query(UserProjectAccess).filter(
        UserProjectAccess.user_id == user_id
    ).all()
    for row in existing_rows:
        if row.project_id not in site_ids:
            row.is_active = False
        elif not row.is_active:
            row.is_active = True

    existing_project_ids = {row.project_id for row in existing_rows}
    for sid in site_ids:
        if sid not in existing_project_ids:
            db.add(UserProjectAccess(
                user_id=user_id, project_id=sid,
                is_active=True, permissions_json={}
            ))

    if company_id:
        existing = db.query(UserCompanyAssignment).filter(
            UserCompanyAssignment.user_id == user_id
        ).first()
        if existing:
            existing.company_id   = UUID(company_id)
            existing.is_all_sites = False
        else:
            db.add(UserCompanyAssignment(
                user_id=user_id, company_id=UUID(company_id), is_all_sites=False
            ))

    write_audit_log(
        db, target_user_id=user_id, changed_by=current_user.id,
        change_type="updated", table_name="user_project_access",
        new_val={"site_ids": [str(s) for s in site_ids]},
    )
    db.commit()
    return {"success": True, "site_ids": [str(s) for s in site_ids]}


# ── Session / device admin ────────────────────────────────────────────────────

@router.get("/{user_id}/device-sessions")
def get_device_sessions(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SUPER ADMIN / ADMIN only. Returns current session and registered device info for a user."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    now = datetime.utcnow()

    web_session = db.query(UserSession).filter(
        UserSession.user_id == user_id, UserSession.platform == "web"
    ).first()

    mobile_session = db.query(UserSession).filter(
        UserSession.user_id == user_id, UserSession.platform == "mobile"
    ).first()

    registered_device = db.query(RegisteredDevice).filter(
        RegisteredDevice.user_id == user_id
    ).first()

    def session_dict(s):
        if not s:
            return None
        return {
            "last_seen_at": s.last_seen_at.isoformat() if s.last_seen_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "is_active": s.expires_at is None or s.expires_at > now,
            "device_label": s.device_label,
            "device_id_hint": s.device_id[-8:] if s.device_id else None,
        }

    return {
        "web": session_dict(web_session),
        "mobile": session_dict(mobile_session),
        "registered_device": {
            "device_label": registered_device.device_label,
            "device_id_hint": registered_device.device_id[-8:] if registered_device.device_id else None,
            "registered_at": registered_device.registered_at.isoformat() if registered_device.registered_at else None,
            "is_active": registered_device.is_active,
        } if registered_device else None,
    }


@router.post("/{user_id}/reset-device")
def reset_device(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SUPER ADMIN / ADMIN only. Clears the user's registered mobile device and invalidates their mobile session."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot reset your own device registration.")

    device = db.query(RegisteredDevice).filter(RegisteredDevice.user_id == user_id).first()
    if device:
        db.delete(device)

    mobile_session = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.platform == "mobile",
    ).first()
    if mobile_session:
        invalidate_user_sessions(db, user_id, mobile_session.jti)
        db.delete(mobile_session)

    write_audit_log(
        db, target_user_id=user_id, changed_by=current_user.id,
        change_type="device_reset", table_name="registered_devices",
    )
    db.commit()
    return {"success": True, "message": "Device registration cleared. User must re-register their device on next mobile login."}


@router.post("/{user_id}/force-logout")
def force_logout(
    user_id: UUID,
    platform: Optional[str] = Query(None, regex="^(web|mobile)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SUPER ADMIN / ADMIN only. Force-logs out a user's web and/or mobile session."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot force-logout your own session. Use the regular logout instead.")

    query = db.query(UserSession).filter(UserSession.user_id == user_id)
    if platform:
        query = query.filter(UserSession.platform == platform)

    sessions = query.all()
    for session in sessions:
        invalidate_user_sessions(db, user_id, session.jti)
        db.delete(session)

    write_audit_log(
        db, target_user_id=user_id, changed_by=current_user.id,
        change_type="force_logout", table_name="user_sessions",
        new_val={"platform": platform or "all"},
    )
    db.commit()
    return {"success": True, "message": f"Force-logged out {len(sessions)} session(s).", "sessions_removed": len(sessions)}


# ── Project access (wizard v2) ────────────────────────────────────────────────

class _ProjectAccessItem(BaseModel):
    project_id: UUID
    permissions_json: dict


@router.post("/{user_id}/project-access")
def upsert_project_access(
    user_id: UUID,
    payload: List[_ProjectAccessItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upsert UserProjectAccess rows for all submitted projects, and
    deactivate any existing active row whose project_id was omitted from
    the payload (the wizard always submits the complete intended state).
    Called immediately after user creation and on edit-mode save.
    """
    caller_type = current_user.user_type or ""
    if caller_type not in ("SUPER_ADMIN", "SUPER ADMIN", "ADMIN"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    submitted_project_ids = {item.project_id for item in payload}

    for item in payload:
        existing = (
            db.query(UserProjectAccess)
            .filter(
                UserProjectAccess.user_id == user_id,
                UserProjectAccess.project_id == item.project_id,
            )
            .first()
        )
        if existing:
            existing.permissions_json = json.dumps(item.permissions_json)
            existing.is_active = True
        else:
            db.add(UserProjectAccess(
                user_id=user_id,
                project_id=item.project_id,
                permissions_json=json.dumps(item.permissions_json),
                is_active=True,
            ))

    # Deactivate any active row whose project was omitted from this submission.
    omitted_rows = (
        db.query(UserProjectAccess)
        .filter(
            UserProjectAccess.user_id == user_id,
            UserProjectAccess.is_active == True,
            ~UserProjectAccess.project_id.in_(submitted_project_ids),
        )
        .all()
    )
    for row in omitted_rows:
        row.is_active = False

    write_audit_log(
        db, target_user_id=user_id, changed_by=current_user.id,
        change_type="permission_granted", table_name="user_project_access",
        new_val={
            "projects_upserted": len(payload),
            "projects_deactivated": len(omitted_rows),
        },
    )
    db.commit()
    return {"upserted": len(payload), "deactivated": len(omitted_rows)}


@router.get("/{user_id}/project-access")
def get_project_access(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Return all UserProjectAccess rows for a user (used by wizard edit mode)."""
    rows = (
        db.query(UserProjectAccess, Project)
        .join(Project, Project.id == UserProjectAccess.project_id)
        .filter(UserProjectAccess.user_id == user_id)
        .all()
    )
    return [
        {
            "project_id": str(upa.project_id),
            "project_code": proj.project_code,
            "project_name": proj.name,
            "permissions_json": json.loads(upa.permissions_json or "{}"),
            "is_active": upa.is_active,
        }
        for upa, proj in rows
    ]
