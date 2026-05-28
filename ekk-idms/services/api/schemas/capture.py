from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid


# ── 3M sub-models ─────────────────────────────────────────────────────────────

class MaterialUsed(BaseModel):
    material_code: str
    material_name: Optional[str] = None
    quantity:      Optional[float] = None
    unit:          Optional[str] = None
    source:        Optional[str] = None    # supplier / quarry / crusher
    test_ref:      Optional[str] = None    # lab test report reference

    @field_validator("unit", mode="before")
    @classmethod
    def normalise_unit(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        from voice_parser import normalise_unit
        return normalise_unit(str(v))

    @field_validator("quantity", mode="before")
    @classmethod
    def positive_qty(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        val = float(v)
        if val < 0:
            raise ValueError("quantity must be non-negative")
        return val


class MachineDeployed(BaseModel):
    machine_code:  str
    machine_name:  Optional[str] = None
    count:         int = 1
    hours:         Optional[float] = None   # hours worked this entry
    operator_name: Optional[str] = None
    log_ref:       Optional[str] = None     # logbook / hire challan reference

    @field_validator("hours", mode="before")
    @classmethod
    def positive_hours(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        val = float(v)
        if val < 0 or val > 24:
            raise ValueError("hours must be between 0 and 24")
        return val

    @field_validator("count", mode="before")
    @classmethod
    def positive_count(cls, v: Any) -> int:
        val = int(v)
        if val < 1:
            raise ValueError("count must be at least 1")
        return val


class ManpowerDeployed(BaseModel):
    category:    str                  # SKILLED / UNSKILLED / MASON etc.
    subcategory: Optional[str] = None
    count:       Optional[int] = None
    shift_hours: float = 8.0
    shift_type:  str = "DAY"          # DAY / NIGHT / GENERAL

    @field_validator("shift_type", mode="before")
    @classmethod
    def upper_shift(cls, v: Any) -> str:
        return str(v).upper()

    @field_validator("count", mode="before")
    @classmethod
    def positive_count(cls, v: Any) -> Optional[int]:
        if v is None:
            return None
        val = int(v)
        if val < 0:
            raise ValueError("count must be non-negative")
        return val


# ── Existing request (unchanged — backward compatible) ────────────────────────

class ManualCaptureRequest(BaseModel):
    project_id:       uuid.UUID
    activity_code:    str
    chainage_from:    Optional[float] = None
    chainage_to:      Optional[float] = None
    stage:            Optional[str] = None
    quantity_lm:      Optional[float] = None
    quantity:         Optional[float] = None
    unit:             Optional[str] = None
    work_type:        Optional[str] = None
    structure_type:   Optional[str] = None
    layer_code:       Optional[str] = None
    element_code:     Optional[str] = None
    chainage_from_km: Optional[int] = None
    chainage_from_m:  Optional[int] = None
    chainage_to_km:   Optional[int] = None
    chainage_to_m:    Optional[int] = None
    length_m:         Optional[float] = None
    width_m:          Optional[float] = None
    depth_m:          Optional[float] = None
    element:          Optional[str] = None
    layer:            Optional[str] = None
    materials:        Optional[List[str]] = None
    contractor_name:  str = "Self"
    road_side:        Optional[str] = None
    rfi_number:       Optional[int] = None
    layer_section:    Optional[str] = None
    remarks:          Optional[str] = None
    gps_start_lat:    Optional[float] = None
    gps_start_lng:    Optional[float] = None
    gps_end_lat:      Optional[float] = None
    gps_end_lng:      Optional[float] = None
    gps_accuracy_m:   Optional[float] = None
    weather_code:     Optional[str] = None
    progress_status:  Optional[str] = None
    entry_date:       Optional[datetime] = None


# ── Extended 3M request ───────────────────────────────────────────────────────

class CaptureWithResourcesRequest(ManualCaptureRequest):
    """Extends ManualCaptureRequest with optional 3M resource fields and voice input."""

    # Voice input — triggers auto-parsing when provided
    voice_transcript: Optional[str] = None
    voice_audio_url:  Optional[str] = None

    # Manual 3M arrays (override / supplement voice-parsed data)
    materials_used:    Optional[List[MaterialUsed]] = None
    machines_deployed: Optional[List[MachineDeployed]] = None
    manpower_deployed: Optional[List[ManpowerDeployed]] = None

    # Extra dimension
    thickness_mm: Optional[float] = None

    # Reference fields
    material_test_refs:   Optional[List[str]] = None
    machine_log_refs:     Optional[List[str]] = None
    attendance_sheet_ref: Optional[str] = None

    @model_validator(mode="after")
    def auto_parse_voice(self) -> "CaptureWithResourcesRequest":
        """If voice_transcript provided and 3M arrays empty, auto-fill from parser."""
        if not self.voice_transcript:
            return self

        from voice_parser import parse_voice_transcript
        parsed = parse_voice_transcript(self.voice_transcript)

        if self.materials_used is None and parsed["materials"]:
            self.materials_used = [MaterialUsed(**m) for m in parsed["materials"]]

        if self.machines_deployed is None and parsed["machines"]:
            self.machines_deployed = [MachineDeployed(**m) for m in parsed["machines"]]

        if self.manpower_deployed is None and parsed["manpower"]:
            self.manpower_deployed = [ManpowerDeployed(**m) for m in parsed["manpower"]]

        object.__setattr__(self, "_voice_confidence", parsed["confidence"])
        return self

    @property
    def voice_confidence(self) -> float:
        return getattr(self, "_voice_confidence", 0.0)

    @field_validator("thickness_mm", mode="before")
    @classmethod
    def positive_thickness(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        val = float(v)
        if val < 0:
            raise ValueError("thickness_mm must be non-negative")
        return val


# ── Response models ───────────────────────────────────────────────────────────

class CaptureEntryResponse(BaseModel):
    id:               uuid.UUID
    project_id:       uuid.UUID
    source:           Optional[str] = None
    report_date:      Optional[datetime] = None
    activity_code:    Optional[str] = None
    chainage_from:    Optional[float] = None
    chainage_to:      Optional[float] = None
    stage:            Optional[str] = None
    quantity_lm:      Optional[float] = None
    quantity:         Optional[float] = None
    unit:             Optional[str] = None
    work_type:        Optional[str] = None
    structure_type:   Optional[str] = None
    layer_code:       Optional[str] = None
    element_code:     Optional[str] = None
    length_m:         Optional[float] = None
    width_m:          Optional[float] = None
    depth_m:          Optional[float] = None
    cost:             Optional[float] = None
    payment_qualifies: Optional[bool] = None
    approved:         Optional[bool] = None
    rejected:         Optional[bool] = None
    approved_by:      Optional[str] = None
    approved_at:      Optional[datetime] = None
    reject_reason:    Optional[str] = None
    contractor_name:  Optional[str] = None
    road_side:        Optional[str] = None
    rfi_number:       Optional[int] = None
    layer_section:    Optional[str] = None
    remarks:          Optional[str] = None
    gps_start_lat:    Optional[float] = None
    gps_start_lng:    Optional[float] = None
    gps_end_lat:      Optional[float] = None
    gps_end_lng:      Optional[float] = None
    gps_accuracy_m:   Optional[float] = None
    weather_code:     Optional[str] = None
    progress_status:  Optional[str] = None
    created_at:       Optional[datetime] = None

    class Config:
        from_attributes = True


class CaptureWithResourcesResponse(CaptureEntryResponse):
    """Extended response including 3M fields and voice metadata."""
    materials_used:         Optional[List[Dict]] = None
    machines_deployed:      Optional[List[Dict]] = None
    manpower_deployed:      Optional[List[Dict]] = None
    voice_transcript:       Optional[str] = None
    voice_confidence_score: Optional[float] = None
    voice_audio_url:        Optional[str] = None
    thickness_mm:           Optional[float] = None
    material_test_refs:     Optional[List[str]] = None
    machine_log_refs:       Optional[List[str]] = None
    attendance_sheet_ref:   Optional[str] = None
    boq_warnings:           Optional[List[str]] = None  # not persisted

    class Config:
        from_attributes = True


class CaptureListResponse(BaseModel):
    total:   int
    entries: List[CaptureEntryResponse]


class ApproveRequest(BaseModel):
    approved_by: str


class RejectRequest(BaseModel):
    reason: str
