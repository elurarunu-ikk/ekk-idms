"""
Permission service — read/write form rights, anomaly detection, audit log.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user_mgmt_models import (
    PermissionAuditLog, RevokedToken, UserCompanyAssignment,
    UserFormRight, UserModuleAssignment, UserSiteAssignment, UserType,
)
from schemas.user_schemas import (
    AnomalyCheckResponse, AnomalyFinding, FormRightRequest,
    FormRightResponse, PermissionSummaryResponse,
)

ANOMALY_RULES = [
    ("HO_USER",   "master",    "can_delete", "warning", "HO Users rarely need Delete on master data."),
    ("HO_USER",   "master",    "can_create", "warning", "HO Users rarely need Create on master data."),
    ("USER",      "payroll",   "can_read",   "error",   "USER role should not access Payroll forms."),
    ("USER",      "user_mgmt", "can_read",   "error",   "USER role cannot access User Management."),
    ("HO_USER",   "user_mgmt", "can_read",   "error",   "HO_USER cannot access User Management module."),
    ("SITE_ADMIN","payroll",   "can_read",   "warning", "Site Admin accessing Payroll is unusual."),
]


def get_effective_permissions(db: Session, user_id: UUID) -> PermissionSummaryResponse:
    """Return all companies, sites, modules, and form rights for a user."""
    from models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_type = user.user_type or ""
    if user_type in ("SUPER ADMIN", "SUPER_ADMIN"):
        return PermissionSummaryResponse(
            user_id=user_id, user_type=user_type, is_super=True,
        )

    company_rows = db.query(UserCompanyAssignment).filter(UserCompanyAssignment.user_id == user_id).all()
    site_rows    = db.query(UserSiteAssignment).filter(UserSiteAssignment.user_id == user_id).all()
    module_rows  = db.query(UserModuleAssignment).filter(UserModuleAssignment.user_id == user_id).all()
    right_rows   = db.query(UserFormRight).filter(UserFormRight.user_id == user_id).all()

    return PermissionSummaryResponse(
        user_id=user_id,
        user_type=user_type,
        is_super=False,
        company_ids=[r.company_id for r in company_rows],
        site_ids=[r.site_id for r in site_rows],
        module_ids=[r.module_id for r in module_rows],
        form_rights=[
            FormRightResponse(
                form_id=r.form_id, form_name=r.form_name,
                can_create=r.can_create, can_read=r.can_read,
                can_update=r.can_update, can_delete=r.can_delete,
            )
            for r in right_rows
        ],
    )


def check_permission(db: Session, user_id: UUID, form_id: str, site_id: Optional[UUID] = None) -> dict:
    """Return CRUD dict for one user+form combo. SUPER_ADMIN gets full access."""
    from models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if user and (user.user_type or "") in ("SUPER ADMIN", "SUPER_ADMIN"):
        return {"can_create": True, "can_read": True, "can_update": True, "can_delete": True}

    right = db.query(UserFormRight).filter(
        UserFormRight.user_id == user_id,
        UserFormRight.form_id == form_id,
    ).first()
    if not right:
        return {"can_create": False, "can_read": False, "can_update": False, "can_delete": False}
    return {
        "can_create": right.can_create, "can_read": right.can_read,
        "can_update": right.can_update, "can_delete": right.can_delete,
    }


def save_form_rights(
    db: Session,
    grantor_id: UUID,
    target_user_id: UUID,
    rights: List[FormRightRequest],
    form_names: Optional[dict] = None,
) -> List[FormRightResponse]:
    """Save form rights. Run anomaly check first. Write audit log for each change."""
    from models.user import User
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    anomalies = run_anomaly_check(
        user_type=UserType(target.user_type) if target.user_type in UserType.__members__ else UserType.USER,
        rights=rights,
        form_names=form_names or {},
    )
    if anomalies.has_errors:
        raise HTTPException(status_code=400, detail={
            "message": "Permission anomalies detected",
            "findings": [f.model_dump() for f in anomalies.findings if f.severity == "error"],
        })

    results = []
    for r in rights:
        existing = db.query(UserFormRight).filter(
            UserFormRight.user_id == target_user_id,
            UserFormRight.form_id == r.form_id,
        ).first()

        old_val = None
        if existing:
            old_val = {
                "can_create": existing.can_create, "can_read": existing.can_read,
                "can_update": existing.can_update, "can_delete": existing.can_delete,
            }
            existing.can_create = r.can_create
            existing.can_read   = r.can_read
            existing.can_update = r.can_update
            existing.can_delete = r.can_delete
            existing.updated_at = datetime.utcnow()
            row = existing
        else:
            row = UserFormRight(
                user_id=target_user_id, form_id=r.form_id,
                form_name=r.form_name or (form_names or {}).get(r.form_id),
                can_create=r.can_create, can_read=r.can_read,
                can_update=r.can_update, can_delete=r.can_delete,
            )
            db.add(row)

        new_val = {"can_create": r.can_create, "can_read": r.can_read,
                   "can_update": r.can_update, "can_delete": r.can_delete}
        write_audit_log(
            db, target_user_id=target_user_id, changed_by=grantor_id,
            change_type="permission_granted", table_name="user_form_rights",
            old_val=old_val, new_val=new_val,
        )
        results.append(FormRightResponse(
            form_id=r.form_id, form_name=r.form_name,
            can_create=r.can_create, can_read=r.can_read,
            can_update=r.can_update, can_delete=r.can_delete,
        ))

    db.commit()
    return results


def run_anomaly_check(
    user_type: UserType,
    rights: List[FormRightRequest],
    form_names: dict,
) -> AnomalyCheckResponse:
    """Run ANOMALY_RULES against proposed rights. Return findings."""
    findings: List[AnomalyFinding] = []
    for right in rights:
        fname = (form_names.get(right.form_id) or right.form_name or right.form_id).lower()
        for rule_type, form_kw, right_field, severity, message in ANOMALY_RULES:
            if user_type.value != rule_type:
                continue
            if form_kw not in fname:
                continue
            if getattr(right, right_field, False):
                findings.append(AnomalyFinding(field=right.form_id, severity=severity, message=message))

    return AnomalyCheckResponse(
        findings=findings,
        has_errors=any(f.severity == "error" for f in findings),
    )


def write_audit_log(
    db: Session,
    target_user_id: UUID,
    changed_by: UUID,
    change_type: str,
    table_name: Optional[str] = None,
    old_val: Optional[dict] = None,
    new_val: Optional[dict] = None,
    impersonating_as: Optional[UUID] = None,
) -> None:
    """Append-only insert to permission_audit_log."""
    log = PermissionAuditLog(
        target_user_id=target_user_id,
        changed_by=changed_by,
        change_type=change_type,
        table_name=table_name,
        old_value=old_val,
        new_value=new_val,
        impersonating_as=impersonating_as,
    )
    db.add(log)


def invalidate_user_sessions(db: Session, user_id: UUID, token_jti: Optional[str] = None) -> None:
    """Blacklist the user's current JWT so they are forced to re-login."""
    if token_jti:
        existing = db.query(RevokedToken).filter(RevokedToken.token_jti == token_jti).first()
        if not existing:
            db.add(RevokedToken(
                token_jti=token_jti,
                user_id=user_id,
                expires_at=datetime.utcnow().replace(hour=23, minute=59, second=59),
            ))


def is_token_revoked(db: Session, token_jti: str) -> bool:
    """Check if a JWT JTI has been revoked."""
    return db.query(RevokedToken).filter(RevokedToken.token_jti == token_jti).first() is not None
