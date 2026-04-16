from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class ManualCaptureRequest(BaseModel):
    project_id:      uuid.UUID
    activity_code:   str
    chainage_from:   float
    chainage_to:     float
    stage:           str
    quantity_lm:     float
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
    created_at:       Optional[datetime]

    class Config:
        from_attributes = True

class CaptureListResponse(BaseModel):
    total:   int
    entries: List[CaptureEntryResponse]