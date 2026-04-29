from datetime import datetime
from typing import Dict, List, Optional
import uuid

from pydantic import BaseModel, EmailStr, Field


class CompanyBase(BaseModel):
    company_code: str
    name: str
    is_active: bool = True


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    company_code: Optional[str] = None
    name: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyResponse(CompanyBase):
    id: uuid.UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    project_code: str
    name: str
    company_id: Optional[uuid.UUID] = None
    site_type: str
    department_type: str
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_code: Optional[str] = None
    name: Optional[str] = None
    company_id: Optional[uuid.UUID] = None
    site_type: Optional[str] = None
    department_type: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: uuid.UUID
    company_name: Optional[str] = None
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProjectAssignmentInput(BaseModel):
    project_id: uuid.UUID
    permissions: Dict[str, Dict[str, bool]] = Field(default_factory=dict)
    is_active: bool = True


class UserCreateRequest(BaseModel):
    full_name: str
    emp_code: str
    username: str
    password: str
    contact_no: str
    email: EmailStr
    user_type: str
    is_active: bool = True
    force_password_change: bool = True
    assignments: List[ProjectAssignmentInput] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    emp_code: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    contact_no: Optional[str] = None
    email: Optional[EmailStr] = None
    user_type: Optional[str] = None
    is_active: Optional[bool] = None
    force_password_change: Optional[bool] = None
    assignments: Optional[List[ProjectAssignmentInput]] = None


class ProjectAssignmentResponse(BaseModel):
    project_id: uuid.UUID
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    is_active: bool
    permissions: Dict[str, Dict[str, bool]] = Field(default_factory=dict)


class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    emp_code: Optional[str]
    username: Optional[str]
    contact_no: Optional[str]
    email: EmailStr
    user_type: str
    is_active: bool
    force_password_change: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    last_login_at: Optional[datetime]
    assignments: List[ProjectAssignmentResponse] = Field(default_factory=list)


class SessionProject(BaseModel):
    id: uuid.UUID
    project_code: str
    name: str
    site_type: Optional[str] = None
    department_type: Optional[str] = None
    is_active: bool
    permissions: Dict[str, Dict[str, bool]] = Field(default_factory=dict)


class SessionUser(BaseModel):
    id: uuid.UUID
    full_name: str
    username: Optional[str]
    email: EmailStr
    contact_no: Optional[str]
    user_type: str
    force_password_change: bool


class SessionResponse(BaseModel):
    user: SessionUser
    projects: List[SessionProject]
