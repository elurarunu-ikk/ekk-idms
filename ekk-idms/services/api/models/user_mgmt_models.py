"""
User Management Module — SQLAlchemy models.
New tables only; the existing `users` table is extended via migration.
"""
import enum
import uuid

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer,
    String, Text, text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from database import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class UserKind(str, enum.Enum):
    internal = "internal"
    external = "external"


class UserType(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN       = "ADMIN"
    HO_USER     = "HO_USER"
    SITE_ADMIN  = "SITE_ADMIN"
    USER        = "USER"


class ChangeType(str, enum.Enum):
    created            = "created"
    updated            = "updated"
    role_changed       = "role_changed"
    activated          = "activated"
    deactivated        = "deactivated"
    password_reset     = "password_reset"
    permission_granted = "permission_granted"
    permission_revoked = "permission_revoked"
    cloned             = "cloned"
    impersonated       = "impersonated"


class TempAccessStatus(str, enum.Enum):
    active  = "active"
    expired = "expired"
    revoked = "revoked"


# ── User company assignments ──────────────────────────────────────────────────

class UserCompanyAssignment(Base):
    __tablename__ = "user_company_assignments"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id   = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    is_all_sites = Column(Boolean, nullable=False, server_default=text("false"))
    created_at   = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_user_company"),
    )


# ── User site assignments ─────────────────────────────────────────────────────

class UserSiteAssignment(Base):
    __tablename__ = "user_site_assignments"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    site_id    = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("user_id", "site_id", name="uq_user_site"),
    )


# ── User module assignments ───────────────────────────────────────────────────

class UserModuleAssignment(Base):
    __tablename__ = "user_module_assignments"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    module_id  = Column(String(100), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("user_id", "module_id", name="uq_user_module"),
    )


# ── User form rights ──────────────────────────────────────────────────────────

class UserFormRight(Base):
    __tablename__ = "user_form_rights"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    form_id          = Column(String(100), nullable=False)
    form_name        = Column(String(200), nullable=True)
    can_create       = Column(Boolean, nullable=False, server_default=text("false"))
    can_read         = Column(Boolean, nullable=False, server_default=text("true"))
    can_update       = Column(Boolean, nullable=False, server_default=text("false"))
    can_delete       = Column(Boolean, nullable=False, server_default=text("false"))
    field_visibility = Column(JSONB, nullable=True)
    created_at       = Column(DateTime, nullable=False, server_default=text("NOW()"))
    updated_at       = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("user_id", "form_id", name="uq_user_form"),
    )


# ── Permission audit log ─────────────────────────────────────────────────────

class PermissionAuditLog(Base):
    """Append-only. No updates or deletes on this table."""
    __tablename__ = "permission_audit_log"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_user_id   = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    changed_by       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    change_type      = Column(String(50), nullable=False)
    table_name       = Column(String(100), nullable=True)
    old_value        = Column(JSONB, nullable=True)
    new_value        = Column(JSONB, nullable=True)
    impersonating_as = Column(UUID(as_uuid=True), nullable=True)
    changed_at       = Column(DateTime, nullable=False, server_default=text("NOW()"))


# ── HR employee cache ─────────────────────────────────────────────────────────

class HREmployeeCache(Base):
    __tablename__ = "hr_employee_cache"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emp_id      = Column(String(50), unique=True, nullable=False)
    full_name   = Column(String(200), nullable=False)
    department  = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    email       = Column(String(200), nullable=True)
    phone       = Column(String(20), nullable=True)
    is_active   = Column(Boolean, nullable=False, server_default=text("true"))
    synced_at   = Column(DateTime, nullable=False, server_default=text("NOW()"))


# ── User groups ───────────────────────────────────────────────────────────────

class UserGroup(Base):
    __tablename__ = "user_groups"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    company_id  = Column(UUID(as_uuid=True), nullable=True)
    created_by  = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime, nullable=False, server_default=text("NOW()"))


# ── User group members ────────────────────────────────────────────────────────

class UserGroupMember(Base):
    __tablename__ = "user_group_members"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id   = Column(UUID(as_uuid=True), ForeignKey("user_groups.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    added_at   = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )


# ── Temporary access grants ───────────────────────────────────────────────────

class TempAccessGrant(Base):
    __tablename__ = "temp_access_grants"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    scope_json = Column(JSONB, nullable=False)
    reason     = Column(Text, nullable=True)
    status     = Column(String(20), nullable=False, server_default=text("'active'"))
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=text("NOW()"))


# ── Revoked tokens (JWT blacklist) ────────────────────────────────────────────

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_jti  = Column(String(200), unique=True, nullable=False)
    user_id    = Column(UUID(as_uuid=True), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=False, server_default=text("NOW()"))
