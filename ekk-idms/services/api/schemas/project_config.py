from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


class ProjectLayerConfigCreate(BaseModel):
    project_id      : str
    layer_code      : str
    layer_desc      : Optional[str] = None
    road_type       : Optional[str] = None
    thickness_mm    : Optional[int] = None
    camber_type     : Optional[str] = None
    lhs_offsets     : Optional[List[float]] = None
    rhs_offsets     : Optional[List[float]] = None
    total_width_lhs : Optional[float] = None
    total_width_rhs : Optional[float] = None
    layer_sequence  : Optional[int] = None
    chainage_from   : Optional[int] = None
    chainage_to     : Optional[int] = None
    effective_from  : Optional[date] = None


class ProjectLayerConfigResponse(BaseModel):
    id              : UUID
    project_id      : str
    layer_code      : str
    layer_desc      : Optional[str] = None
    road_type       : Optional[str] = None
    thickness_mm    : Optional[int] = None
    camber_type     : Optional[str] = None
    lhs_offsets     : Optional[List] = None
    rhs_offsets     : Optional[List] = None
    total_width_lhs : Optional[float] = None
    total_width_rhs : Optional[float] = None
    layer_sequence  : Optional[int] = None
    chainage_from   : Optional[int] = None
    chainage_to     : Optional[int] = None
    version         : int
    is_active       : bool
    created_at      : datetime
    model_config = ConfigDict(from_attributes=True)


class ProjectLayerConfigListResponse(BaseModel):
    total   : int
    entries : List[ProjectLayerConfigResponse]


class GradientConfigCreate(BaseModel):
    project_id    : str
    chainage_from : int
    chainage_to   : int
    gradient_pct  : Optional[float] = None
    gradient_type : Optional[str] = None    # RISING / FALLING / FLAT
    vpi_chainage  : Optional[int] = None
    curve_length  : Optional[float] = None
    road_side     : Optional[str] = "BOTH"  # L / R / BOTH
    notes         : Optional[str] = None
    effective_from: Optional[date] = None


class GradientConfigResponse(BaseModel):
    id            : UUID
    project_id    : str
    chainage_from : int
    chainage_to   : int
    gradient_pct  : Optional[float] = None
    gradient_type : Optional[str] = None
    vpi_chainage  : Optional[int] = None
    curve_length  : Optional[float] = None
    road_side     : str
    notes         : Optional[str] = None
    version       : int
    is_active     : bool
    created_at    : datetime
    model_config = ConfigDict(from_attributes=True)


class GradientConfigListResponse(BaseModel):
    total   : int
    entries : List[GradientConfigResponse]


class GradientAtChainageResponse(BaseModel):
    found         : bool
    chainage      : int
    gradient_pct  : Optional[float] = None
    gradient_type : Optional[str]   = None
    vpi_chainage  : Optional[int]   = None
    curve_length  : Optional[float] = None
    notes         : Optional[str]   = None
    version       : int             = 0
