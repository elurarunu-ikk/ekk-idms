"""
User Management Service — creation, cloning, deactivation, password management.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from auth import hash_password, validate_password_policy
from models.user import User
from models.user_mgmt_models import (
    UserCompanyAssignment, UserModuleAssignment,
    UserSiteAssignment, UserType,
)
from models.user_session import UserSession
from schemas.user_schemas import (
    AnomalyCheckResponse, CloneResultResponse, UserCreateRequest,
    UserResponse,
)
from services.permission_service import (
    get_effective_permissions, run_anomaly_check, save_form_rights,
    write_audit_log, invalidate_user_sessions,
)

# Hierarchy: who can create whom
_CAN_CREATE = {
    "SUPER_ADMIN": {"SUPER_ADMIN", "ADMIN", "HO_USER", "SITE_ADMIN", "USER"},
    "SUPER ADMIN": {"SUPER_ADMIN", "ADMIN", "HO_USER", "SITE_ADMIN", "USER"},
    "ADMIN":       {"HO_USER", "SITE_ADMIN", "USER"},
    "SITE_ADMIN":  {"USER"},
    "HO_USER":     set(),
    "USER":        set(),
}


def check_privilege_chain(
    db: Session,
    creator: User,
    target_user_type: UserType,
    target_company_id: Optional[UUID] = None,
    target_site_ids: Optional[List[UUID]] = None,
) -> None:
    """Raise 403 if creator cannot create a user of target_user_type."""
    creator_type = creator.user_type or "USER"
    allowed = _CAN_CREATE.get(creator_type, set())
    if target_user_type.value not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"{creator_type} cannot create {target_user_type.value} users",
        )

    # SUPER_ADMIN cannot be deleted / there can only be one active SUPER_ADMIN
    # (checked elsewhere)

    # ADMIN scope check — cannot create users outside their own company
    if creator_type == "ADMIN" and target_company_id:
        creator_companies = {
            r.company_id for r in
            db.query(UserCompanyAssignment)
            .filter(UserCompanyAssignment.user_id == creator.id)
            .all()
        }
        if target_company_id not in creator_companies:
            raise HTTPException(status_code=403, detail="ADMIN cannot create users outside assigned company")

    # SITE_ADMIN scope check — cannot create for sites they don't manage
    if creator_type == "SITE_ADMIN" and target_site_ids:
        creator_sites = {
            r.site_id for r in
            db.query(UserSiteAssignment)
            .filter(UserSiteAssignment.user_id == creator.id)
            .all()
        }
        forbidden = set(target_site_ids) - creator_sites
        if forbidden:
            raise HTTPException(status_code=403, detail="SITE_ADMIN cannot create users for sites outside their scope")


def create_user(db: Session, payload: UserCreateRequest, creator: User) -> UserResponse:
    """Full user creation wrapped in a single transaction."""
    check_privilege_chain(
        db, creator, payload.user_type,
        payload.company_assignments[0].company_id if payload.company_assignments else None,
        payload.company_assignments[0].site_ids if payload.company_assignments else [],
    )

    existing_user = db.query(User).filter(User.username == payload.username).first()
    if existing_user:
        if not existing_user.is_active:
            raise HTTPException(
                status_code=409,
                detail="Username already exists (belongs to a deactivated user). Re-activate that user or choose a different username.",
            )
        raise HTTPException(status_code=409, detail="Username already exists")

    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered. Use a different email address.")

    validate_password_policy(payload.temp_password)

    try:
        user = User(
            username=payload.username,
            full_name=payload.full_name,
            user_type=payload.user_type.value,
            password_hash=hash_password(payload.temp_password),
            email=payload.email,
            is_active=True,
        )
        # Set extended columns (added by migration)
        user.user_kind      = payload.user_kind.value
        user.emp_id         = payload.emp_id
        user.department     = payload.department
        user.designation    = payload.designation
        user.organisation   = payload.organisation
        user.phone          = payload.phone
        user.must_change_pwd = True
        user.mfa_enabled    = False
        user.expires_at     = payload.expires_at
        user.created_by     = str(creator.id)
        db.add(user)
        db.flush()  # get user.id without committing

        # Company + site assignments
        for ca in payload.company_assignments:
            db.add(UserCompanyAssignment(
                user_id=user.id, company_id=ca.company_id, is_all_sites=ca.is_all_sites,
            ))
            for site_id in ca.site_ids:
                db.add(UserSiteAssignment(user_id=user.id, site_id=site_id))

        # Module assignments
        for module_id in payload.module_ids:
            db.add(UserModuleAssignment(user_id=user.id, module_id=module_id))

        # Form rights (anomaly check happens inside)
        if payload.form_rights:
            save_form_rights(db, grantor_id=creator.id, target_user_id=user.id, rights=payload.form_rights)

        write_audit_log(
            db, target_user_id=user.id, changed_by=creator.id,
            change_type="created", table_name="users",
            new_val={"username": user.username, "user_type": user.user_type},
        )

        db.commit()
        db.refresh(user)
        return UserResponse.model_validate(user)

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


def clone_user(db: Session, payload, cloner: User) -> CloneResultResponse:
    """Clone a user's full permission profile to a new user."""
    source_perms = get_effective_permissions(db, payload.source_user_id)
    source_user = db.query(User).filter(User.id == payload.source_user_id).first()
    if not source_user:
        raise HTTPException(status_code=404, detail="Source user not found")

    validate_password_policy(payload.new_password)

    if db.query(User).filter(User.username == payload.new_username).first():
        raise HTTPException(status_code=409, detail="Username already exists")

    try:
        new_user = User(
            username=payload.new_username,
            full_name=payload.new_full_name,
            user_type=source_user.user_type,
            password_hash=hash_password(payload.new_password),
            email=None,
            is_active=True,
        )
        new_user.user_kind       = getattr(source_user, 'user_kind', 'internal')
        new_user.must_change_pwd = True
        new_user.mfa_enabled     = False
        new_user.created_by      = str(cloner.id)
        db.add(new_user)
        db.flush()

        # Clone company assignments
        for company_id in source_perms.company_ids:
            db.add(UserCompanyAssignment(user_id=new_user.id, company_id=company_id))
        for site_id in source_perms.site_ids:
            db.add(UserSiteAssignment(user_id=new_user.id, site_id=site_id))
        for module_id in source_perms.module_ids:
            db.add(UserModuleAssignment(user_id=new_user.id, module_id=module_id))

        # Clone form rights
        form_rights_req = [
            type('FR', (), {
                'form_id': fr.form_id, 'form_name': fr.form_name,
                'can_create': fr.can_create, 'can_read': fr.can_read,
                'can_update': fr.can_update, 'can_delete': fr.can_delete,
            })()
            for fr in source_perms.form_rights
        ]

        anomalies = run_anomaly_check(
            user_type=UserType(source_user.user_type) if source_user.user_type in UserType.__members__ else UserType.USER,
            rights=source_perms.form_rights,
            form_names={},
        )

        if source_perms.form_rights:
            save_form_rights(db, grantor_id=cloner.id, target_user_id=new_user.id,
                             rights=source_perms.form_rights)

        write_audit_log(
            db, target_user_id=new_user.id, changed_by=cloner.id,
            change_type="cloned", table_name="users",
            old_val=None,
            new_val={"cloned_from": str(payload.source_user_id)},
        )

        db.commit()
        db.refresh(new_user)
        return CloneResultResponse(
            new_user=UserResponse.model_validate(new_user),
            anomalies=anomalies,
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


def _delete_user_sessions(db: Session, user_id: UUID) -> None:
    """Delete all UserSession rows for a user so they don't hit 409 on next login."""
    db.query(UserSession).filter(UserSession.user_id == user_id).delete()


def deactivate_user(db: Session, user_id: UUID, actor: User, token_jti: Optional[str] = None) -> None:
    """Soft deactivate. Invalidate sessions. Write audit log."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if (user.user_type or "") in ("SUPER_ADMIN", "SUPER ADMIN"):
        raise HTTPException(status_code=403, detail="SUPER_ADMIN cannot be deactivated")
    user.is_active = False
    invalidate_user_sessions(db, user_id, token_jti)
    _delete_user_sessions(db, user_id)
    write_audit_log(db, target_user_id=user_id, changed_by=actor.id,
                    change_type="deactivated", table_name="users")
    db.commit()


def activate_user(db: Session, user_id: UUID, actor: User) -> None:
    """Re-activate a deactivated user. Write audit log."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    write_audit_log(db, target_user_id=user_id, changed_by=actor.id,
                    change_type="activated", table_name="users")
    db.commit()


def reset_password(
    db: Session, user_id: UUID, new_password: str,
    actor: User, token_jti: Optional[str] = None,
) -> None:
    """Admin resets a user's password. Forces re-login."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    validate_password_policy(new_password)
    user.password_hash   = hash_password(new_password)
    user.must_change_pwd = True
    invalidate_user_sessions(db, user_id, token_jti)
    _delete_user_sessions(db, user_id)
    write_audit_log(db, target_user_id=user_id, changed_by=actor.id,
                    change_type="password_reset", table_name="users")
    db.commit()


def change_own_password(
    db: Session, user: User, old_password: str,
    new_password: str, token_jti: Optional[str] = None,
) -> None:
    """User changes their own password."""
    from auth import verify_password
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password_policy(new_password)
    user.password_hash    = hash_password(new_password)
    user.must_change_pwd  = False
    invalidate_user_sessions(db, user.id, token_jti)
    _delete_user_sessions(db, user.id)
    write_audit_log(db, target_user_id=user.id, changed_by=user.id,
                    change_type="password_reset", table_name="users")
    db.commit()
