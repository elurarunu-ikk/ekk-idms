from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from auth import ensure_project_action, get_accessible_projects_for_user, get_current_user
from models.site_data import SiteDataTransaction
from models.user import User
from schemas.capture import (
    ManualCaptureRequest,
    CaptureWithResourcesRequest,
    ApproveRequest,
    RejectRequest,
    CaptureEntryResponse,
    CaptureWithResourcesResponse,
    CaptureListResponse,
)

router = APIRouter()


@router.post("/", response_model=CaptureEntryResponse, summary="Submit a new field capture entry")
def create_capture(
    payload: ManualCaptureRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, payload.project_id, "capture", "add")
    entry = _build_base_entry(payload, user)
    entry.source = "manual"
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid project_id. Seed or create the project before submitting captures.",
        ) from exc
    db.refresh(entry)
    return entry


@router.get("/", response_model=CaptureListResponse, summary="List capture entries with optional filters")
def list_captures(
    project_id: Optional[uuid.UUID] = Query(None),
    approved: Optional[bool] = Query(None),
    rejected: Optional[bool] = Query(None),
    stage: Optional[str] = Query(None),
    # Extended filter params
    work_type: Optional[str] = Query(None),
    layer_code: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    contractor: Optional[str] = Query(None),
    chainage_min: Optional[float] = Query(None),
    chainage_max: Optional[float] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import or_, asc, desc

    q = db.query(SiteDataTransaction)

    if user.user_type not in {"SUPER ADMIN", "ADMIN"}:
        allowed_ids = [project.id for project, _ in get_accessible_projects_for_user(db, user)]
        q = q.filter(SiteDataTransaction.project_id.in_(allowed_ids))

    if project_id:
        ensure_project_action(db, user, project_id, "capture", "view")
        q = q.filter(SiteDataTransaction.project_id == project_id)
    if approved is not None:
        q = q.filter(SiteDataTransaction.approved == approved)
    if rejected is not None:
        q = q.filter(SiteDataTransaction.rejected == rejected)
    if stage:
        q = q.filter(SiteDataTransaction.stage == stage)
    if work_type:
        q = q.filter(SiteDataTransaction.work_type == work_type)
    if layer_code:
        q = q.filter(SiteDataTransaction.layer_code == layer_code)
    if contractor:
        q = q.filter(SiteDataTransaction.contractor_name.ilike(f"%{contractor}%"))
    if search:
        q = q.filter(or_(
            SiteDataTransaction.activity_code.ilike(f"%{search}%"),
            SiteDataTransaction.contractor_name.ilike(f"%{search}%"),
            SiteDataTransaction.stage.ilike(f"%{search}%"),
        ))
    if chainage_min is not None:
        q = q.filter(SiteDataTransaction.chainage_from >= chainage_min)
    if chainage_max is not None:
        q = q.filter(SiteDataTransaction.chainage_to <= chainage_max)
    if date_from:
        try:
            from datetime import date
            q = q.filter(SiteDataTransaction.entry_date >= date.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import date
            q = q.filter(SiteDataTransaction.entry_date <= date.fromisoformat(date_to))
        except ValueError:
            pass

    # Sorting
    sort_col_map = {
        "created_at":    SiteDataTransaction.created_at,
        "activity_code": SiteDataTransaction.activity_code,
        "work_type":     SiteDataTransaction.work_type,
        "chainage_from": SiteDataTransaction.chainage_from,
        "quantity_lm":   SiteDataTransaction.quantity_lm,
        "entry_date":    SiteDataTransaction.entry_date,
    }
    col = sort_col_map.get(sort_by, SiteDataTransaction.created_at)
    q = q.order_by(asc(col) if sort_order == "asc" else desc(col))

    total = q.count()
    entries = q.offset(skip).limit(limit).all()

    return CaptureListResponse(total=total, entries=entries)


@router.get("/pending", response_model=CaptureListResponse, summary="List entries pending approval")
def list_pending(
    project_id: Optional[uuid.UUID] = Query(None),
    work_type: Optional[str] = Query(None),
    layer_code: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    contractor: Optional[str] = Query(None),
    chainage_min: Optional[float] = Query(None),
    chainage_max: Optional[float] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("asc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import or_, asc, desc

    q = db.query(SiteDataTransaction).filter(
        SiteDataTransaction.approved == False,
        SiteDataTransaction.rejected == False,
    )
    if user.user_type not in {"SUPER ADMIN", "ADMIN"}:
        allowed_ids = [project.id for project, _ in get_accessible_projects_for_user(db, user)]
        q = q.filter(SiteDataTransaction.project_id.in_(allowed_ids))
    if project_id:
        ensure_project_action(db, user, project_id, "approvals", "view")
        q = q.filter(SiteDataTransaction.project_id == project_id)
    if work_type:
        q = q.filter(SiteDataTransaction.work_type == work_type)
    if layer_code:
        q = q.filter(SiteDataTransaction.layer_code == layer_code)
    if contractor:
        q = q.filter(SiteDataTransaction.contractor_name.ilike(f"%{contractor}%"))
    if search:
        q = q.filter(or_(
            SiteDataTransaction.activity_code.ilike(f"%{search}%"),
            SiteDataTransaction.contractor_name.ilike(f"%{search}%"),
            SiteDataTransaction.stage.ilike(f"%{search}%"),
        ))
    if chainage_min is not None:
        q = q.filter(SiteDataTransaction.chainage_from >= chainage_min)
    if chainage_max is not None:
        q = q.filter(SiteDataTransaction.chainage_to <= chainage_max)

    sort_col_map = {
        "created_at":    SiteDataTransaction.created_at,
        "activity_code": SiteDataTransaction.activity_code,
        "chainage_from": SiteDataTransaction.chainage_from,
        "quantity_lm":   SiteDataTransaction.quantity_lm,
    }
    col = sort_col_map.get(sort_by, SiteDataTransaction.created_at)
    q = q.order_by(asc(col) if sort_order == "asc" else desc(col))

    total = q.count()
    entries = q.offset(skip).limit(limit).all()
    return CaptureListResponse(total=total, entries=entries)


@router.get("/{entry_id}", response_model=CaptureWithResourcesResponse, summary="Get a single capture entry")
def get_capture(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_project_action(db, user, entry.project_id, "capture", "view")
    return entry


@router.put("/{entry_id}", response_model=CaptureWithResourcesResponse, summary="Update a capture entry")
def update_capture(
    entry_id: uuid.UUID,
    payload: CaptureWithResourcesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_project_action(db, user, entry.project_id, "capture", "edit")
    if entry.approved:
        raise HTTPException(status_code=400, detail="Cannot edit an approved entry")

    entry.activity_code   = payload.activity_code
    entry.chainage_from   = payload.chainage_from
    entry.chainage_to     = payload.chainage_to
    entry.stage           = payload.stage
    entry.quantity_lm     = payload.quantity_lm
    entry.quantity        = payload.quantity
    entry.unit            = payload.unit
    entry.work_type       = payload.work_type
    entry.structure_type  = payload.structure_type
    entry.layer_code      = payload.layer_code or payload.layer
    entry.element_code    = payload.element_code or payload.element
    entry.length_m        = payload.length_m
    entry.width_m         = payload.width_m
    entry.depth_m         = payload.depth_m
    entry.count           = payload.count if payload.count is not None else 1
    entry.contractor_name = payload.contractor_name
    entry.road_side       = payload.road_side
    entry.rfi_number      = payload.rfi_number
    entry.layer_section   = payload.layer_section
    entry.weather_code    = payload.weather_code
    entry.progress_status = payload.progress_status
    entry.remarks         = payload.remarks
    if payload.entry_date:
        entry.entry_date  = payload.entry_date
    # Update 3M resources if provided (None means "don't overwrite")
    if payload.materials_used is not None:
        entry.materials_used = [m.model_dump() for m in payload.materials_used]
    if payload.machines_deployed is not None:
        entry.machines_deployed = [m.model_dump() for m in payload.machines_deployed]
    if payload.manpower_deployed is not None:
        entry.manpower_deployed = [m.model_dump() for m in payload.manpower_deployed]

    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/approve", response_model=CaptureEntryResponse, summary="Approve a capture entry")
def approve_capture(
    entry_id: uuid.UUID,
    payload: ApproveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_project_action(db, user, entry.project_id, "approvals", "approve")
    if entry.rejected:
        raise HTTPException(status_code=400, detail="Cannot approve a rejected entry")

    entry.approved = True
    entry.approved_by = payload.approved_by
    entry.approved_at = datetime.utcnow()
    entry.rejected = False
    entry.reject_reason = None

    # Update BOQ quantity actuals (non-blocking)
    try:
        from routers.boq_router import update_boq_qty_on_approval
        from models.project import Project
        project = db.query(Project).filter(Project.id == entry.project_id).first()
        project_code = project.project_code if project else None
        if project_code:
            update_boq_qty_on_approval(db, entry, project_code)
    except Exception as _boq_exc:
        import logging
        logging.getLogger(__name__).warning(
            f"BOQ qty update failed for entry {entry.id}: {_boq_exc}"
        )

    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/reject", response_model=CaptureEntryResponse, summary="Reject a capture entry")
def reject_capture(
    entry_id: uuid.UUID,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_project_action(db, user, entry.project_id, "approvals", "approve")
    if entry.approved:
        raise HTTPException(status_code=400, detail="Cannot reject an approved entry")

    entry.rejected = True
    entry.reject_reason = payload.reason
    entry.rejected_by = user.full_name or user.username or user.email
    entry.approved = False
    entry.approved_by = None
    entry.approved_at = None

    db.commit()
    db.refresh(entry)
    return entry


# ── 3M helpers ────────────────────────────────────────────────────────────────

def _check_boq_balance(
    db: Session,
    project_id: uuid.UUID,
    activity_code: str,
    quantity: float,
    unit: str,
) -> list[str]:
    """Return warning strings if the submitted quantity exceeds BOQ balance."""
    from models.plan_data import PlanData
    from sqlalchemy import func

    warnings: list[str] = []
    try:
        boq_total = (
            db.query(func.sum(PlanData.planned_qty_lm))
            .filter(
                PlanData.project_id == project_id,
                PlanData.activity_code == activity_code,
                PlanData.is_active == True,
            )
            .scalar()
        ) or 0.0

        executed_total = (
            db.query(func.sum(SiteDataTransaction.quantity_lm))
            .filter(
                SiteDataTransaction.project_id == project_id,
                SiteDataTransaction.activity_code == activity_code,
                SiteDataTransaction.rejected == False,
            )
            .scalar()
        ) or 0.0

        balance = float(boq_total) - float(executed_total)
        if balance > 0 and quantity > balance:
            warnings.append(
                f"Quantity {quantity} {unit} exceeds remaining BOQ balance "
                f"{balance:.3f} LM for activity {activity_code}."
            )
    except Exception:
        pass  # BOQ check is advisory; never block submission

    return warnings


def _build_base_entry(payload: ManualCaptureRequest, user: "User") -> SiteDataTransaction:
    """Construct a SiteDataTransaction ORM object from a capture payload."""
    entered_by = user.full_name or user.username or user.email
    return SiteDataTransaction(
        id=uuid.uuid4(),
        project_id=payload.project_id,
        source="manual",
        activity_code=payload.activity_code,
        chainage_from=payload.chainage_from,
        chainage_to=payload.chainage_to,
        stage=payload.stage,
        quantity_lm=payload.quantity_lm,
        quantity=payload.quantity,
        unit=payload.unit,
        work_type=payload.work_type,
        structure_type=payload.structure_type,
        layer_code=payload.layer_code or payload.layer,
        element_code=payload.element_code or payload.element,
        length_m=payload.length_m,
        width_m=payload.width_m,
        depth_m=payload.depth_m,
        count=payload.count if payload.count is not None else 1,
        contractor_name=payload.contractor_name,
        road_side=payload.road_side,
        rfi_number=payload.rfi_number,
        layer_section=payload.layer_section,
        remarks=payload.remarks,
        gps_start_lat=payload.gps_start_lat,
        gps_start_lng=payload.gps_start_lng,
        gps_end_lat=payload.gps_end_lat,
        gps_end_lng=payload.gps_end_lng,
        gps_accuracy_m=payload.gps_accuracy_m,
        weather_code=payload.weather_code,
        progress_status=payload.progress_status,
        approved=False,
        rejected=False,
        payment_qualifies=False,
        entry_date=payload.entry_date or datetime.utcnow(),
        entered_by=entered_by,
    )


# ── New 3M endpoint ───────────────────────────────────────────────────────────

@router.post(
    "/with-resources",
    response_model=CaptureWithResourcesResponse,
    summary="Submit capture with 3M resource data (Materials, Machines, Manpower)",
)
def create_capture_with_resources(
    payload: CaptureWithResourcesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Submit a field capture entry that includes optional resource tracking.

    Supports three input modes (combinable):
    - **Voice-only**: send `voice_transcript`; 3M data is auto-extracted.
    - **Manual-only**: send `materials_used`, `machines_deployed`, `manpower_deployed` arrays.
    - **Hybrid**: send `voice_transcript` to pre-fill, then override with manual arrays.

    All 3M fields are optional — the endpoint is fully backward-compatible with
    the basic `/capture/` endpoint.
    """
    ensure_project_action(db, user, payload.project_id, "capture", "add")

    # BOQ advisory check (non-blocking)
    boq_warnings: list[str] = []
    if payload.quantity and payload.quantity_lm and payload.activity_code:
        boq_warnings = _check_boq_balance(
            db,
            payload.project_id,
            payload.activity_code,
            float(payload.quantity_lm),
            payload.unit or "",
        )

    # Build base entry
    entry = _build_base_entry(payload, user)
    entry.source = "voice" if payload.voice_transcript else "manual"

    # Attach 3M data as JSONB
    if payload.materials_used:
        entry.materials_used = [m.model_dump() for m in payload.materials_used]
        if payload.material_test_refs:
            entry.material_test_refs = payload.material_test_refs

    if payload.machines_deployed:
        entry.machines_deployed = [m.model_dump() for m in payload.machines_deployed]
        if payload.machine_log_refs:
            entry.machine_log_refs = payload.machine_log_refs

    if payload.manpower_deployed:
        entry.manpower_deployed = [m.model_dump() for m in payload.manpower_deployed]
        if payload.attendance_sheet_ref:
            entry.attendance_sheet_ref = payload.attendance_sheet_ref

    # Voice metadata
    if payload.voice_transcript:
        entry.voice_transcript = payload.voice_transcript
        entry.voice_confidence_score = payload.voice_confidence
        if payload.voice_audio_url:
            entry.voice_audio_url = payload.voice_audio_url

    if payload.thickness_mm is not None:
        entry.thickness_mm = payload.thickness_mm

    db.add(entry)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid project_id. Seed or create the project before submitting captures.",
        ) from exc
    db.refresh(entry)

    response = CaptureWithResourcesResponse.model_validate(entry)
    response.boq_warnings = boq_warnings or None
    return response


@router.delete("/{entry_id}", summary="Delete a capture entry")
def delete_capture(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    ensure_project_action(db, user, entry.project_id, "capture", "delete")
    if entry.approved:
        raise HTTPException(status_code=400, detail="Cannot delete an approved entry")

    db.delete(entry)
    db.commit()
    return {"deleted": True, "id": str(entry_id)}