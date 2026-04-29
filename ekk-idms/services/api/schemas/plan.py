from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import uuid


class PlanDataResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    activity_code: str
    chainage_from: float
    chainage_to: float
    stage: str
    planned_qty_lm: float
    target_start: date
    target_end: date
    contractor_name: str
    road_side: str
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PlanListResponse(BaseModel):
    total: int
    entries: List[PlanDataResponse]


class StageProgressItem(BaseModel):
    stage: str
    planned_lm: float
    submitted_lm: float
    approved_lm: float
    rejected_lm: float
    pending_count: int
    completion_pct: float
    on_track: bool


class ContractorProgressItem(BaseModel):
    contractor_name: str
    planned_lm: float
    approved_lm: float
    rejection_rate_pct: float
    completion_pct: float


class OverdueItem(BaseModel):
    activity_code: str
    stage: str
    chainage_from: float
    chainage_to: float
    target_end: date
    days_overdue: int
    status: str


class ProgressSummaryResponse(BaseModel):
    project_id: uuid.UUID
    overall_completion_pct: float
    total_planned_lm: float
    total_approved_lm: float
    total_pending_count: int
    total_rejected_count: int
    by_stage: List[StageProgressItem]
    by_contractor: List[ContractorProgressItem]
    overdue_entries: List[OverdueItem]
