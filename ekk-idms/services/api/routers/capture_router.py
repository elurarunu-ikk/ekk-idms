from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime
import uuid

from database import get_db
from auth import verify_token
from models.site_data import SiteDataTransaction
from schemas.capture import (
    ManualCaptureRequest,
    ApproveRequest,
    RejectRequest,
    CaptureEntryResponse,
    CaptureListResponse,
)

router = APIRouter()


@router.post("/", response_model=CaptureEntryResponse, summary="Submit a new field capture entry")
def create_capture(
    payload: ManualCaptureRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    entry = SiteDataTransaction(
        id=uuid.uuid4(),
        project_id=payload.project_id,
        source="manual",
        activity_code=payload.activity_code,
        chainage_from=payload.chainage_from,
        chainage_to=payload.chainage_to,
        stage=payload.stage,
        quantity_lm=payload.quantity_lm,
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
        approved=False,
        rejected=False,
        payment_qualifies=False,
        entry_date=payload.entry_date or datetime.utcnow(),
    )
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
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    q = db.query(SiteDataTransaction)

    if project_id:
        q = q.filter(SiteDataTransaction.project_id == project_id)
    if approved is not None:
        q = q.filter(SiteDataTransaction.approved == approved)
    if rejected is not None:
        q = q.filter(SiteDataTransaction.rejected == rejected)
    if stage:
        q = q.filter(SiteDataTransaction.stage == stage)

    total = q.count()
    entries = q.order_by(SiteDataTransaction.created_at.desc()).offset(skip).limit(limit).all()

    return CaptureListResponse(total=total, entries=entries)


@router.get("/pending", response_model=CaptureListResponse, summary="List entries pending approval")
def list_pending(
    project_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    q = db.query(SiteDataTransaction).filter(
        SiteDataTransaction.approved == False,
        SiteDataTransaction.rejected == False,
    )
    if project_id:
        q = q.filter(SiteDataTransaction.project_id == project_id)

    total = q.count()
    entries = q.order_by(SiteDataTransaction.created_at.desc()).all()
    return CaptureListResponse(total=total, entries=entries)


@router.get("/{entry_id}", response_model=CaptureEntryResponse, summary="Get a single capture entry")
def get_capture(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.put("/{entry_id}", response_model=CaptureEntryResponse, summary="Update a capture entry")
def update_capture(
    entry_id: uuid.UUID,
    payload: ManualCaptureRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.approved:
        raise HTTPException(status_code=400, detail="Cannot edit an approved entry")

    entry.activity_code = payload.activity_code
    entry.chainage_from = payload.chainage_from
    entry.chainage_to = payload.chainage_to
    entry.stage = payload.stage
    entry.quantity_lm = payload.quantity_lm
    entry.contractor_name = payload.contractor_name
    entry.road_side = payload.road_side
    entry.rfi_number = payload.rfi_number
    entry.layer_section = payload.layer_section

    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/approve", response_model=CaptureEntryResponse, summary="Approve a capture entry")
def approve_capture(
    entry_id: uuid.UUID,
    payload: ApproveRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.rejected:
        raise HTTPException(status_code=400, detail="Cannot approve a rejected entry")

    entry.approved = True
    entry.approved_by = payload.approved_by
    entry.approved_at = datetime.utcnow()
    entry.rejected = False
    entry.reject_reason = None

    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/reject", response_model=CaptureEntryResponse, summary="Reject a capture entry")
def reject_capture(
    entry_id: uuid.UUID,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.approved:
        raise HTTPException(status_code=400, detail="Cannot reject an approved entry")

    entry.rejected = True
    entry.reject_reason = payload.reason
    entry.approved = False
    entry.approved_by = None
    entry.approved_at = None

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", summary="Delete a capture entry")
def delete_capture(
    entry_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    entry = db.query(SiteDataTransaction).filter(SiteDataTransaction.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.approved:
        raise HTTPException(status_code=400, detail="Cannot delete an approved entry")

    db.delete(entry)
    db.commit()
    return {"deleted": True, "id": str(entry_id)}