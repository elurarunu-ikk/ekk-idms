"""
User Management Module — Pydantic v2 request/response schemas.
password_hash is NEVER included in any response schema.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.user_mgmt_models import UserKind, UserType


# ── Helpers ───────────────────────────────────────────────────────────────────

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Sub-objects used inside requests ─────────────────────────────────────────

class FormRightRequest(BaseModel):
    form_id:    str = Field(..., min_length=1, max_length=100)
    form_name:  Optional[str] = None
    can_create: bool = False
    can_read:   bool = True
    can_update: bool = False
    can_delete: bool = False


class CompanySiteAssignRequest(BaseModel):
    company_id:  UUID
    site_ids:    List[UUID] = []
    is_all_sites: bool = False


# ── User create/update requests ───────────────────────────────────────────────

class UserCreateRequest(BaseModel):
    # Step 1 — identity
    username:     str = Field(..., min_length=3, max_length=100)
    full_name:    str = Field(..., min_length=2, max_length=200)
    user_kind:    UserKind
    user_type:    UserType
    emp_id:       Optional[str] = Field(None, max_length=50)
    department:   Optional[str] = Field(None, max_length=100)
    designation:  Optional[str] = Field(None, max_length=100)
    organisation: Optional[str] = Field(None, max_length=200)
    email:        Optional[str] = Field(None, max_length=200)
    phone:        Optional[str] = Field(None, max_length=20)
    expires_at:   Optional[datetime] = None

    # Step 2 — password
    temp_password: str = Field(..., min_length=8)

    # Step 3 — company + site scope
    company_assignments: List[CompanySiteAssignRequest] = []

    # Step 4 — module scope
    module_ids: List[str] = []

    # Step 5 — form rights
    form_rights: List[FormRightRequest] = []

    @field_validator('emp_id')
    @classmethod
    def emp_id_required_for_internal(cls, v, info):
        if info.data.get('user_kind') == UserKind.internal and not v:
            raise ValueError('emp_id is required for internal users')
        return v

    @field_validator('expires_at')
    @classmethod
    def expires_at_required_for_external(cls, v, info):
        if info.data.get('user_kind') == UserKind.external and not v:
            raise ValueError('expires_at is required for external users')
        return v


class UserUpdateRequest(BaseModel):
    full_name:    Optional[str] = Field(None, min_length=2, max_length=200)
    email:        Optional[str] = Field(None, max_length=200)
    phone:        Optional[str] = Field(None, max_length=20)
    department:   Optional[str] = Field(None, max_length=100)
    designation:  Optional[str] = Field(None, max_length=100)
    organisation: Optional[str] = Field(None, max_length=200)
    expires_at:   Optional[datetime] = None
    user_type:    Optional[str] = Field(None, max_length=50)
    user_kind:    Optional[str] = Field(None, max_length=20)


class PasswordChangeRequest(BaseModel):
    old_password:     str = Field(..., min_length=1)
    new_password:     str = Field(..., min_length=8)
    confirm_password: str

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if v != info.data.get('new_password'):
            raise ValueError('Passwords do not match')
        return v


class PasswordResetRequest(BaseModel):
    new_password:     str = Field(..., min_length=8)
    confirm_password: str

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if v != info.data.get('new_password'):
            raise ValueError('Passwords do not match')
        return v


class CloneUserRequest(BaseModel):
    source_user_id: UUID
    new_username:   str = Field(..., min_length=3, max_length=100)
    new_full_name:  str = Field(..., min_length=2, max_length=200)
    new_password:   str = Field(..., min_length=8)


class ImpersonateRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class TempAccessGrantRequest(BaseModel):
    user_id:    UUID
    scope_json: dict
    reason:     Optional[str] = None
    expires_at: datetime


class HRLookupRequest(BaseModel):
    q: str = Field(..., min_length=1, max_length=100)


class AnomalyCheckRequest(BaseModel):
    user_type:   UserType
    form_rights: List[FormRightRequest]


class ModuleAssignRequest(BaseModel):
    user_id:    UUID
    module_ids: List[str]


# ── Response schemas ──────────────────────────────────────────────────────────

class UserSummaryResponse(_Base):
    id:            UUID
    username:      str
    full_name:     str
    user_type:     str
    user_kind:     Optional[str] = None
    is_active:     bool
    last_login_at: Optional[datetime] = None


class UserResponse(_Base):
    id:             UUID
    username:       str
    full_name:      str
    emp_id:         Optional[str] = None
    user_kind:      Optional[str] = None
    user_type:      str
    department:     Optional[str] = None
    designation:    Optional[str] = None
    organisation:   Optional[str] = None
    email:          Optional[str] = None
    phone:          Optional[str] = None
    must_change_pwd: Optional[bool] = None
    is_active:      bool
    mfa_enabled:    Optional[bool] = None
    expires_at:     Optional[datetime] = None
    last_login_at:  Optional[datetime] = None
    created_at:     Optional[datetime] = None


class UserListResponse(_Base):
    total: int
    items: List[UserSummaryResponse]


class FormRightResponse(_Base):
    form_id:    str
    form_name:  Optional[str] = None
    can_create: bool
    can_read:   bool
    can_update: bool
    can_delete: bool


class PermissionSummaryResponse(BaseModel):
    user_id:                UUID
    user_type:              str
    is_super:               bool = False
    company_ids:            List[UUID] = []
    site_ids:               List[UUID] = []
    module_ids:             List[str] = []
    form_rights:            List[FormRightResponse] = []
    sites_with_permissions: List[dict] = []


class AssignmentResponse(BaseModel):
    success: bool
    message: str


class AuditLogEntry(_Base):
    id:               UUID
    target_user_id:   UUID
    changed_by:       UUID
    change_type:      str
    table_name:       Optional[str] = None
    old_value:        Optional[dict] = None
    new_value:        Optional[dict] = None
    impersonating_as: Optional[UUID] = None
    changed_at:       datetime


class AuditLogResponse(BaseModel):
    total:   int
    entries: List[AuditLogEntry]


class AnomalyFinding(BaseModel):
    field:    str
    severity: str  # "error" | "warning"
    message:  str


class AnomalyCheckResponse(BaseModel):
    findings:   List[AnomalyFinding] = []
    has_errors: bool = False


class HREmployeeResponse(_Base):
    emp_id:      str
    full_name:   str
    department:  Optional[str] = None
    designation: Optional[str] = None
    email:       Optional[str] = None
    phone:       Optional[str] = None


class HRLookupResponse(BaseModel):
    results: List[HREmployeeResponse]


class CloneResultResponse(BaseModel):
    new_user:  UserResponse
    anomalies: AnomalyCheckResponse


class TempAccessResponse(_Base):
    id:         UUID
    user_id:    UUID
    scope_json: dict
    reason:     Optional[str] = None
    status:     str
    expires_at: datetime
    created_at: datetime


class ActivityDashboardResponse(BaseModel):
    active_count:       int
    dormant_count:      int
    external_count:     int
    expiring_soon:      int
    recent_logins:      List[UserSummaryResponse] = []
