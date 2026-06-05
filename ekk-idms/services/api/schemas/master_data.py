from pydantic import BaseModel, ConfigDict
from typing import Optional, List
import uuid

# ── Base response schemas (read) ─────────────────────────────────────────────

class WorkTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool

class LayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    work_type_code: Optional[str]
    sort_order: int
    is_active: bool

class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    default_unit: Optional[str]
    sort_order: int
    is_active: bool
    # Populated by the API endpoint from junction tables:
    work_types: List[str] = []   # list of work_type_codes
    layers: List[str] = []       # list of layer_codes (ROAD activities only)

class ElementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool

class StructureTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool

# ── Write schemas (create/update) ─────────────────────────────────────────────

class WorkTypeCreate(BaseModel):
    code: str
    label: str
    sort_order: int = 0

class WorkTypeUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class LayerCreate(BaseModel):
    code: str
    label: str
    work_type_code: Optional[str] = "ROAD"
    sort_order: int = 0

class LayerUpdate(BaseModel):
    label: Optional[str] = None
    work_type_code: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class ActivityCreate(BaseModel):
    code: str
    label: str
    default_unit: Optional[str] = None
    sort_order: int = 0
    work_type_codes: List[str] = []   # junction rows to create
    layer_codes: List[str] = []       # junction rows for ROAD activities

class ActivityUpdate(BaseModel):
    label: Optional[str] = None
    default_unit: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    work_type_codes: Optional[List[str]] = None  # replace all if provided
    layer_codes: Optional[List[str]] = None       # replace all if provided

class ElementCreate(BaseModel):
    code: str
    label: str
    sort_order: int = 0

class ElementUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class StructureTypeCreate(BaseModel):
    code: str
    label: str
    sort_order: int = 0

class StructureTypeUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

# ── Materials ──────────────────────────────────────────────────────────────────

class MaterialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    default_unit: Optional[str]
    category: Optional[str]
    sort_order: int
    is_active: bool

class MaterialCreate(BaseModel):
    code: str
    label: str
    default_unit: Optional[str] = None
    category: Optional[str] = None
    sort_order: int = 0

class MaterialUpdate(BaseModel):
    label: Optional[str] = None
    default_unit: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

# ── Equipment ──────────────────────────────────────────────────────────────────

class EquipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    category: Optional[str]
    sort_order: int
    is_active: bool

class EquipmentCreate(BaseModel):
    code: str
    label: str
    category: Optional[str] = None
    sort_order: int = 0

class EquipmentUpdate(BaseModel):
    label: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

# ── Manpower Categories ────────────────────────────────────────────────────────

class ManpowerCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool

class ManpowerCategoryCreate(BaseModel):
    code: str
    label: str
    sort_order: int = 0

class ManpowerCategoryUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
