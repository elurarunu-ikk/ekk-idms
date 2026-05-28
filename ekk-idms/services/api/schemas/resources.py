from pydantic import BaseModel, Field, field_validator
from typing import Optional
from decimal import Decimal
import uuid
from datetime import datetime


# ── Material Master ────────────────────────────────────────────────────────────

class MaterialMasterCreate(BaseModel):
    project_id: uuid.UUID
    material_code: str = Field(..., max_length=50)
    material_name: str = Field(..., max_length=200)
    unit: str = Field(..., max_length=20)
    rate_per_unit: Optional[Decimal] = None
    supplier_name: Optional[str] = Field(None, max_length=200)

    @field_validator("material_code")
    @classmethod
    def upper_code(cls, v: str) -> str:
        return v.strip().upper()


class MaterialMasterUpdate(BaseModel):
    material_name: Optional[str] = Field(None, max_length=200)
    unit: Optional[str] = Field(None, max_length=20)
    rate_per_unit: Optional[Decimal] = None
    supplier_name: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None


class MaterialMasterResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    material_code: str
    material_name: str
    unit: str
    rate_per_unit: Optional[Decimal]
    supplier_name: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Machine Master ─────────────────────────────────────────────────────────────

class MachineMasterCreate(BaseModel):
    project_id: uuid.UUID
    machine_code: str = Field(..., max_length=50)
    machine_name: str = Field(..., max_length=200)
    machine_type: Optional[str] = Field(None, max_length=100)
    rate_per_hour: Optional[Decimal] = None

    @field_validator("machine_code")
    @classmethod
    def upper_code(cls, v: str) -> str:
        return v.strip().upper()


class MachineMasterUpdate(BaseModel):
    machine_name: Optional[str] = Field(None, max_length=200)
    machine_type: Optional[str] = Field(None, max_length=100)
    rate_per_hour: Optional[Decimal] = None
    is_active: Optional[bool] = None


class MachineMasterResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    machine_code: str
    machine_name: str
    machine_type: Optional[str]
    rate_per_hour: Optional[Decimal]
    is_active: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Manpower Categories ────────────────────────────────────────────────────────

class ManpowerCategoryResponse(BaseModel):
    id: uuid.UUID
    category_code: str
    category_name: str
    subcategory: Optional[str]
    rate_per_day: Optional[Decimal]
    is_active: bool

    model_config = {"from_attributes": True}
