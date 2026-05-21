from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class LevelRegisterRow(BaseModel):
    id            : UUID
    project_id    : str
    layer_code    : str
    layer_desc    : Optional[str]   = None
    thickness_mm  : Optional[int]   = None
    chainage      : int
    road_side     : str
    frl_center    : Optional[float] = None
    camber_pct    : Optional[float] = None
    camber_type   : Optional[str]   = None
    road_width_m  : Optional[float] = None
    offset_widths : Optional[list]  = None
    rl_values     : Optional[dict]  = None
    rl_at_0m      : Optional[float] = None
    rl_at_2m      : Optional[float] = None
    rl_at_6m      : Optional[float] = None
    rl_at_9_5m    : Optional[float] = None
    rl_at_11m     : Optional[float] = None
    rl_at_edge    : Optional[float] = None
    tcs_ref       : Optional[str]   = None
    version       : int
    is_active     : bool
    uploaded_at   : datetime
    model_config = ConfigDict(from_attributes=True)


class LevelRegisterListResponse(BaseModel):
    total   : int
    entries : List[LevelRegisterRow]


class LevelRegisterSummaryRow(BaseModel):
    layer_code    : str
    total_records : int
    chainage_min  : int
    chainage_max  : int
    frl_min       : Optional[float] = None
    frl_max       : Optional[float] = None


class LevelRegisterSummaryResponse(BaseModel):
    project_id : str
    layers     : List[LevelRegisterSummaryRow]


class OGLRow(BaseModel):
    id            : UUID
    project_id    : str
    chainage      : int
    road_side     : str
    ogl_cl        : Optional[float] = None
    frl_center    : Optional[float] = None
    offset_widths : Optional[list]  = None
    rl_values     : Optional[dict]  = None
    rl_at_2m      : Optional[float] = None
    rl_at_6m      : Optional[float] = None
    rl_at_edge    : Optional[float] = None
    version       : int
    uploaded_at   : datetime
    model_config = ConfigDict(from_attributes=True)


class OGLListResponse(BaseModel):
    total   : int
    entries : List[OGLRow]


class GPSRow(BaseModel):
    id            : UUID
    project_id    : str
    chainage_from : int
    chainage_to   : int
    nh_number     : Optional[str]   = None
    state         : Optional[str]   = None
    district      : Optional[str]   = None
    piu           : Optional[str]   = None
    lat_start     : Optional[float] = None
    lon_start     : Optional[float] = None
    alt_start_m   : Optional[float] = None
    lat_end       : Optional[float] = None
    lon_end       : Optional[float] = None
    alt_end_m     : Optional[float] = None
    uploaded_at   : datetime
    model_config = ConfigDict(from_attributes=True)


class GPSListResponse(BaseModel):
    total   : int
    entries : List[GPSRow]


class OGLAnalysisRow(BaseModel):
    id             : UUID
    project_id     : str
    chainage       : int
    road_side      : str
    ogl_rl         : Optional[float] = None
    emb_frl        : Optional[float] = None
    cut_fill_m     : Optional[float] = None
    cut_fill_type  : Optional[str]   = None
    cross_area_sqm : Optional[float] = None
    volume_cum     : Optional[float] = None
    computed_at    : datetime
    model_config = ConfigDict(from_attributes=True)


class OGLAnalysisListResponse(BaseModel):
    total          : int
    entries        : List[OGLAnalysisRow]
    cut_chainages  : int
    fill_chainages : int
    zero_chainages : int


class OGLAnalysisPagedResponse(BaseModel):
    total          : int
    cut_chainages  : int
    fill_chainages : int
    zero_chainages : int
    entries        : List[OGLAnalysisRow]


class SheetUploadSummary(BaseModel):
    sheet_name : str
    layer_code : str
    inserted   : int
    skipped    : int
    errors     : List[str]


class GradeSheetUploadResponse(BaseModel):
    project_id    : str
    sheets        : List[SheetUploadSummary]
    total_records : int
    ogl_computed  : bool
    message       : str
