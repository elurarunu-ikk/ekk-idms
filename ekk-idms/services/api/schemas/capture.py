from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class ManualCaptureRequest(BaseModel):
    project_id:      uuid.UUID
    activity_code:   str
    chainage_from:   Optional[float] = None
    chainage_to:     Optional[float] = None
    stage:           Optional[str] = None
    quantity_lm:     Optional[float] = None
    quantity:        Optional[float] = None
    unit:            Optional[str] = None
    work_type:       Optional[str] = None
    structure_type:  Optional[str] = None
    layer_code:      Optional[str] = None
    element_code:    Optional[str] = None
    chainage_from_km: Optional[int] = None
    chainage_from_m: Optional[int] = None
    chainage_to_km:   Optional[int] = None
    chainage_to_m:    Optional[int] = None
    length_m:        Optional[float] = None
    width_m:         Optional[float] = None
    depth_m:         Optional[float] = None
    element:         Optional[str] = None
    layer:           Optional[str] = None
    materials:       Optional[List[str]] = None
    contractor_name: str = "Self"
    road_side:       Optional[str]   = None
    rfi_number:      Optional[int]   = None
    layer_section:   Optional[str]   = None
    remarks:         Optional[str]   = None
    gps_start_lat:   Optional[float] = None
    gps_start_lng:   Optional[float] = None
    gps_end_lat:     Optional[float] = None
    gps_end_lng:     Optional[float] = None
    gps_accuracy_m:  Optional[float] = None
    weather_code:    Optional[str] = None
    progress_status: Optional[str] = None
    entry_date:     Optional[datetime] = None

class ApproveRequest(BaseModel):
    approved_by: str

class RejectRequest(BaseModel):
    reason: str

class CaptureEntryResponse(BaseModel):
    id:               uuid.UUID
    project_id:       uuid.UUID
    source:           Optional[str]
    report_date:      Optional[datetime]
    activity_code:    Optional[str]
    chainage_from:    Optional[float]
    chainage_to:      Optional[float]
    stage:            Optional[str]
    quantity_lm:      Optional[float]
    quantity:         Optional[float]
    unit:             Optional[str]
    work_type:        Optional[str]
    structure_type:   Optional[str]
    layer_code:       Optional[str]
    element_code:     Optional[str]
    length_m:         Optional[float]
    width_m:          Optional[float]
    depth_m:          Optional[float]
    cost:             Optional[float]
    payment_qualifies: Optional[bool]
    approved:         Optional[bool]
    rejected:         Optional[bool]
    approved_by:      Optional[str]
    approved_at:      Optional[datetime]
    reject_reason:    Optional[str]
    contractor_name:  Optional[str]
    road_side:        Optional[str]
    rfi_number:       Optional[int]
    layer_section:    Optional[str]
    remarks:          Optional[str]
    gps_start_lat:    Optional[float]
    gps_start_lng:    Optional[float]
    gps_end_lat:      Optional[float]
    gps_end_lng:      Optional[float]
    gps_accuracy_m:   Optional[float]
    weather_code:     Optional[str]
    progress_status:  Optional[str]
    created_at:       Optional[datetime]

    class Config:
        from_attributes = True

class CaptureListResponse(BaseModel):
    total:   int
    entries: List[CaptureEntryResponse]