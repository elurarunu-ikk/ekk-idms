from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
import uuid

SCOPED_WORK_TYPES = {"ROAD", "STRUCTURE"}

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
    structure_mappings: List[dict] = []  # [{"structure_type": str, "element": str}]

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

def _validate_scoped_exclusivity(v):
    if v is None:
        return v
    scoped_selected = [wt for wt in v if wt.upper() in SCOPED_WORK_TYPES]
    if len(scoped_selected) > 1:
        raise ValueError(
            f"An activity cannot be valid for both Road and Structure simultaneously "
            f"(they use different scoping mappings — Layers vs Structure Type/Element). "
            f"Got: {scoped_selected}"
        )
    return v

class ActivityCreate(BaseModel):
    code: str
    label: str
    default_unit: Optional[str] = None
    sort_order: int = 0
    work_type_codes: List[str] = []   # junction rows to create
    layer_codes: List[str] = []       # junction rows for ROAD activities
    structure_type_codes: List[str] = []  # paired positionally with element_codes
    element_codes: List[str] = []

    @field_validator("work_type_codes")
    @classmethod
    def validate_scoped_exclusivity(cls, v):
        return _validate_scoped_exclusivity(v)

class ActivityUpdate(BaseModel):
    label: Optional[str] = None
    default_unit: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    work_type_codes: Optional[List[str]] = None  # replace all if provided
    layer_codes: Optional[List[str]] = None       # replace all if provided
    structure_type_codes: Optional[List[str]] = None  # replace all if both provided
    element_codes: Optional[List[str]] = None

    @field_validator("work_type_codes")
    @classmethod
    def validate_scoped_exclusivity(cls, v):
        return _validate_scoped_exclusivity(v)

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

# ── Road Sections ───────────────────────────────────────────────────────────────

class RoadSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool

class RoadSectionCreate(BaseModel):
    code: str
    label: str
    sort_order: int = 0

class RoadSectionUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

# ── Road Sides ───────────────────────────────────────────────────────────────────

class RoadSideResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool

class RoadSideCreate(BaseModel):
    code: str
    label: str
    sort_order: int = 0

class RoadSideUpdate(BaseModel):
    label: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
