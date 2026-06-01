"""
Permission Router — check access, validate anomalies, temp access, groups.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user, verify_token
from database import get_db
from models.user import User
from models.user_mgmt_models import TempAccessGrant, UserGroup, UserGroupMember
from schemas.user_schemas import (
    AnomalyCheckRequest, AnomalyCheckResponse,
    TempAccessGrantRequest, TempAccessResponse,
)
from services.permission_service import (
    check_permission, get_effective_permissions, run_anomaly_check,
    save_form_rights, write_audit_log,
)

router = APIRouter(tags=["Permissions"])


@router.get("/check")
def check_my_permission(
    form_id:  str           = Query(...),
    site_id:  Optional[str] = Query(None),
    db:       Session       = Depends(get_db),
    current_user: User      = Depends(get_current_user),
):
    """Return CRUD rights for the calling user on a specific form + site."""
    return check_permission(db, current_user.id, form_id, UUID(site_id) if site_id else None)


@router.get("/summary/{user_id}")
def permission_summary(
    user_id: UUID,
    db:      Session = Depends(get_db),
    _: dict          = Depends(verify_token),
):
    """Full permission summary for a user (companies, sites, modules, form rights)."""
    return get_effective_permissions(db, user_id)


@router.post("/validate", response_model=AnomalyCheckResponse)
def validate_permissions(
    payload: AnomalyCheckRequest,
    _: dict = Depends(verify_token),
):
    """Run anomaly check on proposed form rights before saving. Returns findings."""
    return run_anomaly_check(
        user_type=payload.user_type,
        rights=payload.form_rights,
        form_names={},
    )


@router.post("/form-rights/{user_id}")
def assign_form_rights(
    user_id: UUID,
    payload: AnomalyCheckRequest,
    db:      Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save form rights for a user. Runs anomaly check first."""
    return save_form_rights(db, current_user.id, user_id, payload.form_rights)


# ── Temp access ───────────────────────────────────────────────────────────────

@router.post("/temp-access", response_model=TempAccessResponse)
def grant_temp_access(
    payload: TempAccessGrantRequest,
    db:      Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grant temporary scoped access to a user."""
    grant = TempAccessGrant(
        user_id=payload.user_id,
        scope_json=payload.scope_json,
        reason=payload.reason,
        status="active",
        granted_by=current_user.id,
        expires_at=payload.expires_at,
    )
    db.add(grant)
    write_audit_log(db, target_user_id=payload.user_id, changed_by=current_user.id,
                    change_type="permission_granted", table_name="temp_access_grants",
                    new_val={"scope": payload.scope_json, "expires_at": str(payload.expires_at)})
    db.commit()
    db.refresh(grant)
    return TempAccessResponse.model_validate(grant)


@router.delete("/temp-access/{grant_id}/revoke")
def revoke_temp_access(
    grant_id: UUID,
    db:       Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a temporary access grant."""
    grant = db.query(TempAccessGrant).filter(TempAccessGrant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    grant.status = "revoked"
    write_audit_log(db, target_user_id=grant.user_id, changed_by=current_user.id,
                    change_type="permission_revoked", table_name="temp_access_grants")
    db.commit()
    return {"success": True, "message": "Temp access revoked"}


# ── Groups ────────────────────────────────────────────────────────────────────

@router.get("/groups")
def list_groups(
    company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: dict     = Depends(verify_token),
):
    """List user groups for a company."""
    q = db.query(UserGroup)
    if company_id:
        q = q.filter(UserGroup.company_id == UUID(company_id))
    return q.all()


@router.post("/groups")
def create_group(
    payload: dict,
    db:      Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a user group."""
    group = UserGroup(
        name=payload["name"],
        description=payload.get("description"),
        company_id=UUID(payload["company_id"]) if payload.get("company_id") else None,
        created_by=current_user.id,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": str(group.id), "name": group.name}


@router.post("/groups/{group_id}/members")
def add_group_members(
    group_id:   UUID,
    user_ids:   list,
    db:         Session = Depends(get_db),
    current_user: User  = Depends(get_current_user),
):
    """Add members to a group."""
    added = 0
    for uid in user_ids:
        existing = db.query(UserGroupMember).filter(
            UserGroupMember.group_id == group_id, UserGroupMember.user_id == UUID(str(uid))
        ).first()
        if not existing:
            db.add(UserGroupMember(group_id=group_id, user_id=UUID(str(uid))))
            added += 1
    db.commit()
    return {"added": added}
