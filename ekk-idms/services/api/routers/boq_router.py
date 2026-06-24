from datetime import datetime
from decimal import Decimal
from typing import List, Optional
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

import json

from auth import get_current_user
from database import get_db
from models.boq import BoqActivityMapping, BoqItem, BoqItemChange, BoqQtyActual, BoqVersion
from models.master_data import (
    MasterWorkType, MasterLayer, MasterActivity, MasterElement,
    MasterStructureType, MasterActivityLayer, MasterActivityWorkType,
    MasterStructureElementActivity,
)
from models.site_data import SiteDataTransaction
from models.user import User

router = APIRouter()

_ZERO = Decimal("0")
_VALID_CHANGE_TYPES = {"QTY_REVISED", "RATE_REVISED", "BOTH", "NEW_ITEM", "DELETED"}


def natural_sort_key(item: BoqItem) -> list:
    parts = re.split(r'(\d+)', item.item_code or '')
    return [int(p) if p.isdigit() else p.lower() for p in parts]


# ── Schemas ────────────────────────────────────────────────────────────────────

class BoqVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    version_no: int
    state: str
    label: Optional[str] = None
    is_locked: Optional[bool] = None
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: Optional[datetime] = None
    item_count: int


class BoqItemOut(BaseModel):
    id: uuid.UUID
    item_code: str
    bill_no: Optional[str] = None
    bill_description: Optional[str] = None
    description: str
    item_type: str
    unit: Optional[str] = None
    adjusted_rate: Optional[Decimal] = None
    expected_scope: Optional[Decimal] = None
    revised_scope: Optional[Decimal] = None
    wtg: Optional[Decimal] = None
    is_active: Optional[bool] = None
    version_no: int
    approval_status: Optional[str] = None
    v0_qty: Optional[Decimal] = None
    v0_rate: Optional[Decimal] = None
    delta_qty: Optional[Decimal] = None
    delta_rate: Optional[Decimal] = None
    delta_amount: Optional[Decimal] = None
    change_flag: Optional[str] = None


class BoqRegisterResponse(BaseModel):
    version_no: int
    state: str
    is_locked: Optional[bool] = None
    project_id: str
    total_items: int
    boq_item_count: int
    non_boq_count: int
    contract_value_v0: Optional[Decimal] = None
    working_value: Optional[Decimal] = None
    cumulative_variation_pct: Optional[Decimal] = None
    items: List[BoqItemOut]


class ChangeRequestBody(BaseModel):
    project_id: str
    boq_item_id: uuid.UUID
    change_type: str
    new_qty: Optional[Decimal] = None
    new_rate: Optional[Decimal] = None
    reason_code: Optional[str] = None
    remarks: Optional[str] = None
    doc_ref: Optional[str] = None


class ApproveBody(BaseModel):
    project_id: str
    level: int


class RejectBody(BaseModel):
    project_id: str
    rejection_reason: str


class ChangeRequestOut(BaseModel):
    id: uuid.UUID
    boq_item_id: uuid.UUID
    item_code: Optional[str] = None
    description: Optional[str] = None
    bill_no: Optional[str] = None
    change_type: str
    old_qty: Optional[Decimal] = None
    new_qty: Optional[Decimal] = None
    old_rate: Optional[Decimal] = None
    new_rate: Optional[Decimal] = None
    delta_qty: Optional[Decimal] = None
    delta_amount: Optional[Decimal] = None
    reason_code: Optional[str] = None
    remarks: Optional[str] = None
    doc_ref: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approval_status: Optional[str] = None
    l1_approved_by: Optional[str] = None
    l1_approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_change_out(change: BoqItemChange, item: Optional[BoqItem] = None) -> ChangeRequestOut:
    delta_qty: Optional[Decimal] = None
    delta_amount: Optional[Decimal] = None
    if change.old_qty is not None and change.new_qty is not None:
        delta_qty = change.new_qty - change.old_qty
    if delta_qty is not None and change.old_rate is not None:
        delta_amount = delta_qty * change.old_rate
    return ChangeRequestOut(
        id=change.id,
        boq_item_id=change.boq_item_id,
        item_code=item.item_code if item else None,
        description=item.description if item else None,
        bill_no=item.bill_no if item else None,
        change_type=change.change_type,
        old_qty=change.old_qty,
        new_qty=change.new_qty,
        old_rate=change.old_rate,
        new_rate=change.new_rate,
        delta_qty=delta_qty,
        delta_amount=delta_amount,
        reason_code=change.reason_code,
        remarks=change.remarks,
        doc_ref=change.doc_ref,
        submitted_by=change.submitted_by,
        submitted_at=change.submitted_at,
        approval_status=change.approval_status,
        l1_approved_by=change.l1_approved_by,
        l1_approved_at=change.l1_approved_at,
        approved_by=change.approved_by,
        approved_at=change.approved_at,
        rejected_by=change.rejected_by,
        rejected_at=change.rejected_at,
        rejection_reason=change.rejection_reason,
    )


def _compare_to_v0(item: BoqItem, v0_item: Optional[BoqItem]) -> dict:
    v0_qty  = v0_item.revised_scope  if v0_item else None
    v0_rate = v0_item.adjusted_rate  if v0_item else None

    dq: Optional[Decimal] = None
    dr: Optional[Decimal] = None
    da: Optional[Decimal] = None

    if item.revised_scope is not None and v0_qty is not None:
        dq = item.revised_scope - v0_qty
    if item.adjusted_rate is not None and v0_rate is not None:
        dr = item.adjusted_rate - v0_rate
    if dq is not None and item.adjusted_rate is not None:
        da = dq * item.adjusted_rate

    if v0_item is None:
        flag = "NEW_ITEM"
    elif dq is not None and dq != 0 and dr is not None and dr != 0:
        flag = "BOTH_CHANGED"
    elif dq is not None and dq != 0:
        flag = "QTY_CHANGED"
    elif dr is not None and dr != 0:
        flag = "RATE_CHANGED"
    else:
        flag = "NO_CHANGE"

    return {"v0_qty": v0_qty, "v0_rate": v0_rate, "delta_qty": dq, "delta_rate": dr, "delta_amount": da, "change_flag": flag}


def _apply_to_working_version(
    db: Session,
    project_id: str,
    source_item: BoqItem,
    change: BoqItemChange,
    actor: str,
) -> None:
    working_ver = db.query(BoqVersion).filter(
        BoqVersion.project_id == project_id,
        BoqVersion.state == "WORKING",
        BoqVersion.is_locked == False,
        BoqVersion.is_deleted == False,
    ).first()

    if not working_ver:
        max_vno = db.query(func.max(BoqVersion.version_no)).filter(
            BoqVersion.project_id == project_id
        ).scalar() or 0
        working_ver = BoqVersion(
            project_id=project_id,
            version_no=max_vno + 1,
            state="WORKING",
            is_locked=False,
            created_by=actor,
        )
        db.add(working_ver)
        db.flush()

    existing = db.query(BoqItem).filter(
        BoqItem.version_id == working_ver.id,
        BoqItem.item_code == source_item.item_code,
        BoqItem.is_deleted == False,
    ).first()

    if existing:
        if change.new_qty is not None:
            existing.revised_scope = change.new_qty
        if change.new_rate is not None:
            existing.adjusted_rate = change.new_rate
        if change.change_type == "DELETED":
            existing.is_deleted = True
    else:
        db.add(BoqItem(
            version_id=working_ver.id,
            uid=source_item.uid,
            item_code=source_item.item_code,
            bill_no=source_item.bill_no,
            bill_description=source_item.bill_description,
            description=source_item.description,
            item_type=source_item.item_type,
            unit=source_item.unit,
            adjusted_rate=change.new_rate if change.new_rate is not None else source_item.adjusted_rate,
            expected_scope=source_item.expected_scope,
            revised_scope=change.new_qty if change.new_qty is not None else source_item.revised_scope,
            wtg=source_item.wtg,
        ))


# ── Endpoint 1: GET /register ──────────────────────────────────────────────────

@router.get("/register", response_model=BoqRegisterResponse, summary="List BOQ items for a project version")
def get_boq_register(
    project_id: str = Query(...),
    version_no: Optional[int] = Query(None),
    compare_v0: bool = Query(False),
    bill_no: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if version_no is not None:
        version = db.query(BoqVersion).filter(
            BoqVersion.project_id == project_id,
            BoqVersion.version_no == version_no,
            BoqVersion.is_deleted == False,
        ).first()
    else:
        version = db.query(BoqVersion).filter(
            BoqVersion.project_id == project_id,
            BoqVersion.is_deleted == False,
        ).order_by(BoqVersion.version_no.desc()).first()

    if not version:
        raise HTTPException(status_code=404, detail="No BOQ version found for this project")

    q = db.query(BoqItem).filter(
        BoqItem.version_id == version.id,
        BoqItem.is_deleted == False,
    )
    if bill_no:
        q = q.filter(BoqItem.bill_no == bill_no)
    if item_type:
        q = q.filter(BoqItem.item_type == item_type)
    if search:
        q = q.filter(BoqItem.description.ilike(f"%{search}%"))
    all_items: List[BoqItem] = q.all()
    all_items.sort(key=natural_sort_key)  # Fix 2: natural numeric order

    total_items     = len(all_items)
    boq_item_count  = sum(1 for i in all_items if i.item_type == "BOQ_ITEM")
    non_boq_count   = total_items - boq_item_count

    # Fix 1: use explicit float casts; skip rows missing either value
    working_value = 0.0
    for i in all_items:
        if i.item_type == "BOQ_ITEM" and i.revised_scope is not None and i.adjusted_rate is not None:
            working_value += float(i.revised_scope) * float(i.adjusted_rate)

    v0: Optional[BoqVersion] = None
    v0_map: dict = {}
    contract_value_v0: Optional[float] = None

    # Always load v0 so contract_value_v0 is populated even when viewing v0 itself
    v0 = db.query(BoqVersion).filter(
        BoqVersion.project_id == project_id,
        BoqVersion.version_no == 0,
        BoqVersion.is_deleted == False,
    ).first()

    if v0:
        v0_boq_items = db.query(BoqItem).filter(
            BoqItem.version_id == v0.id,
            BoqItem.item_type == "BOQ_ITEM",
            BoqItem.is_deleted == False,
        ).all()
        contract_value_v0 = 0.0
        for i in v0_boq_items:
            if i.revised_scope is not None and i.adjusted_rate is not None:
                contract_value_v0 += float(i.revised_scope) * float(i.adjusted_rate)

        if compare_v0:
            v0_map = {
                i.item_code: i
                for i in db.query(BoqItem).filter(
                    BoqItem.version_id == v0.id,
                    BoqItem.is_deleted == False,
                ).all()
            }

    cumulative_variation_pct: Optional[float] = None
    if version.version_no == 0:
        # Viewing v0 itself: working_value equals contract_value_v0, variation is zero
        working_value = contract_value_v0 if contract_value_v0 is not None else 0.0
        cumulative_variation_pct = 0.0
    elif contract_value_v0 and contract_value_v0 > 0:
        cumulative_variation_pct = round(
            ((working_value - contract_value_v0) / contract_value_v0) * 100, 4
        )

    # Pending change status per item
    pending_status: dict = {}
    item_ids = [i.id for i in all_items]
    if item_ids:
        for c in db.query(BoqItemChange).filter(
            BoqItemChange.boq_item_id.in_(item_ids),
            BoqItemChange.approval_status == "PENDING",
            BoqItemChange.is_deleted == False,
        ).all():
            pending_status[c.boq_item_id] = c.approval_status

    items_out: List[BoqItemOut] = []
    current_codes: set = {i.item_code for i in all_items}

    for item in all_items:
        extra = _compare_to_v0(item, v0_map.get(item.item_code)) if compare_v0 else {}
        items_out.append(BoqItemOut(
            id=item.id,
            item_code=item.item_code,
            bill_no=item.bill_no,
            bill_description=item.bill_description,
            description=item.description,
            item_type=item.item_type,
            unit=item.unit,
            adjusted_rate=item.adjusted_rate,
            expected_scope=item.expected_scope,
            revised_scope=item.revised_scope,
            wtg=item.wtg,
            is_active=item.is_active,
            version_no=version.version_no,
            approval_status=pending_status.get(item.id),
            **extra,
        ))

    # Append items that exist in v0 but not in the current version → DELETED
    if compare_v0 and v0_map:
        for code, v0i in v0_map.items():
            if code not in current_codes:
                items_out.append(BoqItemOut(
                    id=v0i.id,
                    item_code=v0i.item_code,
                    bill_no=v0i.bill_no,
                    bill_description=v0i.bill_description,
                    description=v0i.description,
                    item_type=v0i.item_type,
                    unit=v0i.unit,
                    adjusted_rate=v0i.adjusted_rate,
                    expected_scope=v0i.expected_scope,
                    revised_scope=v0i.revised_scope,
                    wtg=v0i.wtg,
                    is_active=False,
                    version_no=0,
                    approval_status=None,
                    v0_qty=v0i.revised_scope,
                    v0_rate=v0i.adjusted_rate,
                    change_flag="DELETED",
                ))

    return BoqRegisterResponse(
        version_no=version.version_no,
        state=version.state,
        is_locked=version.is_locked,
        project_id=project_id,
        total_items=total_items,
        boq_item_count=boq_item_count,
        non_boq_count=non_boq_count,
        contract_value_v0=contract_value_v0,
        working_value=working_value,
        cumulative_variation_pct=cumulative_variation_pct,
        items=items_out[skip : skip + limit],
    )


# ── Endpoint 2: GET /versions ──────────────────────────────────────────────────

@router.get("/versions", response_model=List[BoqVersionOut], summary="List all BOQ versions for a project")
def get_boq_versions(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    versions = db.query(BoqVersion).filter(
        BoqVersion.project_id == project_id,
        BoqVersion.is_deleted == False,
    ).order_by(BoqVersion.version_no).all()

    counts: dict = {}
    if versions:
        for vid, cnt in db.query(BoqItem.version_id, func.count(BoqItem.id)).filter(
            BoqItem.version_id.in_([v.id for v in versions]),
            BoqItem.is_deleted == False,
        ).group_by(BoqItem.version_id).all():
            counts[vid] = cnt

    return [
        BoqVersionOut(
            id=v.id,
            version_no=v.version_no,
            state=v.state,
            label=v.label,
            is_locked=v.is_locked,
            created_by=v.created_by,
            approved_by=v.approved_by,
            created_at=v.created_at,
            item_count=counts.get(v.id, 0),
        )
        for v in versions
    ]


# ── Endpoint 3: POST /change-request ──────────────────────────────────────────

@router.post("/change-request", response_model=ChangeRequestOut, summary="Raise a BOQ change request")
def create_change_request(
    payload: ChangeRequestBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.change_type not in _VALID_CHANGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid change_type. Must be one of: {', '.join(sorted(_VALID_CHANGE_TYPES))}",
        )
    if payload.change_type == "QTY_REVISED" and payload.new_qty is None:
        raise HTTPException(status_code=400, detail="new_qty is required for QTY_REVISED")
    if payload.change_type == "RATE_REVISED" and payload.new_rate is None:
        raise HTTPException(status_code=400, detail="new_rate is required for RATE_REVISED")
    if payload.change_type == "BOTH" and (payload.new_qty is None or payload.new_rate is None):
        raise HTTPException(status_code=400, detail="Both new_qty and new_rate are required for BOTH")

    item = db.query(BoqItem).filter(
        BoqItem.id == payload.boq_item_id,
        BoqItem.is_deleted == False,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="BOQ item not found")

    version = db.query(BoqVersion).filter(BoqVersion.id == item.version_id).first()
    if version and version.is_locked:
        raise HTTPException(
            status_code=400,
            detail="Cannot raise a change request against a locked version. Work against a WORKING version.",
        )

    existing = db.query(BoqItemChange).filter(
        BoqItemChange.boq_item_id == payload.boq_item_id,
        BoqItemChange.approval_status == "PENDING",
        BoqItemChange.is_deleted == False,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A pending change request already exists for this item")

    change = BoqItemChange(
        boq_item_id=payload.boq_item_id,
        change_type=payload.change_type,
        old_qty=item.revised_scope,
        new_qty=payload.new_qty,
        old_rate=item.adjusted_rate,
        new_rate=payload.new_rate,
        reason_code=payload.reason_code,
        remarks=payload.remarks,
        doc_ref=payload.doc_ref,
        submitted_by=user.username,
    )
    db.add(change)
    db.commit()
    db.refresh(change)
    return _build_change_out(change, item)


# ── Endpoint 4: GET /change-requests ──────────────────────────────────────────

@router.get("/change-requests", response_model=List[ChangeRequestOut], summary="List BOQ change requests")
def list_change_requests(
    project_id: str = Query(...),
    approval_status: Optional[str] = Query("PENDING"),
    submitted_by: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = (
        db.query(BoqItemChange, BoqItem)
        .join(BoqItem, BoqItemChange.boq_item_id == BoqItem.id)
        .join(BoqVersion, BoqItem.version_id == BoqVersion.id)
        .filter(
            BoqVersion.project_id == project_id,
            BoqItemChange.is_deleted == False,
        )
    )
    if approval_status:
        q = q.filter(BoqItemChange.approval_status == approval_status)
    if submitted_by:
        q = q.filter(BoqItemChange.submitted_by == submitted_by)

    rows = q.order_by(BoqItemChange.submitted_at.desc()).offset(skip).limit(limit).all()
    return [_build_change_out(change, item) for change, item in rows]


# ── Endpoint 5: POST /change-request/{change_id}/approve ──────────────────────

@router.post("/change-request/{change_id}/approve", response_model=ChangeRequestOut, summary="Approve a BOQ change request")
def approve_change_request(
    change_id: uuid.UUID,
    payload: ApproveBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    change = db.query(BoqItemChange).filter(
        BoqItemChange.id == change_id,
        BoqItemChange.is_deleted == False,
    ).first()
    if not change:
        raise HTTPException(status_code=404, detail="Change request not found")

    if payload.level not in (1, 2):
        raise HTTPException(status_code=400, detail="level must be 1 or 2")

    if payload.level == 1:
        if change.approval_status != "PENDING":
            raise HTTPException(status_code=400, detail="Only PENDING changes can receive L1 approval")
        change.l1_approved_by  = user.username
        change.l1_approved_at  = datetime.utcnow()
        change.approval_status = "L1_APPROVED"

    else:
        if change.approval_status not in ("PENDING", "L1_APPROVED"):
            raise HTTPException(status_code=400, detail="Change is not in an approvable state")
        change.approved_by     = user.username
        change.approved_at     = datetime.utcnow()
        change.approval_status = "APPROVED"

        source_item = db.query(BoqItem).filter(BoqItem.id == change.boq_item_id).first()
        if source_item:
            _apply_to_working_version(db, payload.project_id, source_item, change, user.username)

    db.commit()
    db.refresh(change)
    item = db.query(BoqItem).filter(BoqItem.id == change.boq_item_id).first()
    return _build_change_out(change, item)


# ── Endpoint 6: POST /change-request/{change_id}/reject ───────────────────────

@router.post("/change-request/{change_id}/reject", response_model=ChangeRequestOut, summary="Reject a BOQ change request")
def reject_change_request(
    change_id: uuid.UUID,
    payload: RejectBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    change = db.query(BoqItemChange).filter(
        BoqItemChange.id == change_id,
        BoqItemChange.is_deleted == False,
    ).first()
    if not change:
        raise HTTPException(status_code=404, detail="Change request not found")

    if change.approval_status not in ("PENDING", "L1_APPROVED"):
        raise HTTPException(status_code=400, detail="Only PENDING or L1_APPROVED changes can be rejected")

    change.rejected_by      = user.username
    change.rejected_at      = datetime.utcnow()
    change.rejection_reason = payload.rejection_reason
    change.approval_status  = "REJECTED"

    db.commit()
    db.refresh(change)
    item = db.query(BoqItem).filter(BoqItem.id == change.boq_item_id).first()
    return _build_change_out(change, item)


# ── Schemas: activity mapping + qty actuals ────────────────────────────────────

class ActivityMappingBody(BaseModel):
    project_id:      str
    work_type:       Optional[str] = None
    layer_code:      Optional[str] = None
    structure_type:  Optional[str] = None
    element_code:    Optional[str] = None
    activity_code:   Optional[str] = None
    boq_item_code:   str
    volume_formula:  str = "LxWxD"
    unit_conversion: Optional[float] = 1.0


class ActivityMappingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:              uuid.UUID
    project_id:      str
    work_type:       Optional[str] = None
    layer_code:      Optional[str] = None
    structure_type:  Optional[str] = None
    element_code:    Optional[str] = None
    activity_code:   Optional[str] = None
    boq_item_code:   str
    volume_formula:  str
    unit_conversion: Optional[float] = None
    is_active:       Optional[bool] = None
    created_at:      Optional[datetime] = None


class QtyActualOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    boq_item_code:         str
    description:           Optional[str] = None
    unit:                  Optional[str] = None
    revised_scope:         Optional[float] = None
    cumulative_actual_qty: Optional[float] = None
    approved_qty:          Optional[float] = None
    pct_complete:          Optional[float] = None
    balance_qty:           Optional[float] = None
    dpr_entry_count:       Optional[int] = None
    last_updated_at:       Optional[datetime] = None


# ── DPR qty helpers (internal, not endpoints) ─────────────────────────────────

def compute_dpr_qty(entry: SiteDataTransaction, formula: str) -> float:
    ch_from = float(entry.chainage_from or 0)
    ch_to   = float(entry.chainage_to or 0)
    length  = ch_to - ch_from
    width   = float(entry.width_m or 0)
    depth   = float(entry.depth_m or 0)

    if formula == "LxWxD":
        vol = length * width * depth
        if vol <= 0 and (entry.quantity or 0) > 0:
            import logging
            logging.getLogger(__name__).warning(
                f"LxWxD gave 0 for entry {entry.id}, "
                f"falling back to quantity field"
            )
            return float(entry.quantity)
        return vol
    elif formula == "LxW":
        return length * width
    elif formula == "LENGTH":
        return length
    elif formula == "QUANTITY":
        return float(entry.quantity or entry.quantity_lm or 0)
    return 0.0


def _find_mapping(db: Session, project_code: str, entry) -> Optional[BoqActivityMapping]:
    """Priority cascade lookup — most specific match first."""
    wt = (entry.work_type or '').strip()
    lc = (entry.layer_code or '').strip()
    st = (entry.structure_type or '').strip()
    ec = (entry.element_code or '').strip()
    ac = (entry.activity_code or '').strip()

    base = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == project_code,
        BoqActivityMapping.is_active == True,
        BoqActivityMapping.is_deleted == False,
    )

    def try_filter(**kwargs):
        q = base
        for col, val in kwargs.items():
            attr = getattr(BoqActivityMapping, col)
            if val:
                q = q.filter(attr == val)
            else:
                q = q.filter(attr == None)
        return q.first()

    # P1: ROAD — work_type + layer_code + activity_code
    if wt and lc and ac:
        m = try_filter(work_type=wt, layer_code=lc,
                       structure_type=None, element_code=None,
                       activity_code=ac)
        if m: return m

    # P2: ROAD — work_type + layer_code (any activity)
    if wt and lc:
        m = try_filter(work_type=wt, layer_code=lc,
                       structure_type=None, element_code=None,
                       activity_code=None)
        if m: return m

    # P3: STRUCTURE — work_type + structure_type + element_code + activity_code
    if wt and st and ec and ac:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=st, element_code=ec,
                       activity_code=ac)
        if m: return m

    # P4: STRUCTURE — work_type + structure_type + element_code (any activity)
    if wt and st and ec:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=st, element_code=ec,
                       activity_code=None)
        if m: return m

    # P5: DRAIN/ANCILLARY/MISC — work_type + activity_code
    if wt and ac:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=None, element_code=None,
                       activity_code=ac)
        if m: return m

    # P6: catch-all — work_type only
    if wt:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=None, element_code=None,
                       activity_code=None)
        if m: return m

    return None


def update_boq_qty_on_approval(
    db: Session,
    entry: SiteDataTransaction,
    project_code: str,
) -> None:
    mapping = _find_mapping(db, project_code, entry)

    if not mapping:
        return

    qty = compute_dpr_qty(entry, mapping.volume_formula)
    if qty <= 0:
        return

    qty *= float(mapping.unit_conversion or 1.0)

    actual = db.query(BoqQtyActual).filter(
        BoqQtyActual.project_id == project_code,
        BoqQtyActual.boq_item_code == mapping.boq_item_code,
        BoqQtyActual.is_deleted == False,
    ).first()

    if actual:
        actual.cumulative_actual_qty = float(actual.cumulative_actual_qty or 0) + qty
        actual.approved_qty          = float(actual.approved_qty or 0) + qty
        actual.last_dpr_id           = entry.id
        actual.last_updated_at       = datetime.utcnow()
        actual.dpr_entry_count       = (actual.dpr_entry_count or 0) + 1
    else:
        v0 = db.query(BoqVersion).filter(
            BoqVersion.project_id == project_code,
            BoqVersion.version_no == 0,
            BoqVersion.is_deleted == False,
        ).first()
        boq_item_id = None
        if v0:
            v0_item = db.query(BoqItem).filter(
                BoqItem.version_id == v0.id,
                BoqItem.item_code == mapping.boq_item_code,
                BoqItem.is_deleted == False,
            ).first()
            if v0_item:
                boq_item_id = v0_item.id

        actual = BoqQtyActual(
            project_id=project_code,
            boq_item_id=boq_item_id,
            boq_item_code=mapping.boq_item_code,
            cumulative_actual_qty=qty,
            approved_qty=qty,
            last_dpr_id=entry.id,
            last_updated_at=datetime.utcnow(),
            dpr_entry_count=1,
        )
        db.add(actual)


# ── Endpoint 7: GET /qty-actuals ──────────────────────────────────────────────

@router.get("/qty-actuals", response_model=List[QtyActualOut], summary="BOQ items with actual vs planned quantities")
def get_qty_actuals(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    v0 = db.query(BoqVersion).filter(
        BoqVersion.project_id == project_id,
        BoqVersion.version_no == 0,
        BoqVersion.is_deleted == False,
    ).first()
    if not v0:
        raise HTTPException(status_code=404, detail="v0 BOQ not found for this project")

    actuals = db.query(BoqQtyActual).filter(
        BoqQtyActual.project_id == project_id,
        BoqQtyActual.is_deleted == False,
    ).all()

    item_map: dict = {}
    if actuals:
        codes = [a.boq_item_code for a in actuals]
        items = db.query(BoqItem).filter(
            BoqItem.version_id == v0.id,
            BoqItem.item_code.in_(codes),
            BoqItem.item_type == "BOQ_ITEM",
            BoqItem.is_deleted == False,
        ).all()
        item_map = {i.item_code: i for i in items}

    results = []
    for actual in actuals:
        boq_item = item_map.get(actual.boq_item_code)
        revised  = float(boq_item.revised_scope) if boq_item and boq_item.revised_scope is not None else None
        approved = float(actual.approved_qty or 0)
        pct      = round((approved / revised) * 100, 2) if revised and revised > 0 else None
        balance  = round(revised - approved, 3) if revised is not None else None

        results.append(QtyActualOut(
            boq_item_code=actual.boq_item_code,
            description=boq_item.description if boq_item else None,
            unit=boq_item.unit if boq_item else None,
            revised_scope=revised,
            cumulative_actual_qty=float(actual.cumulative_actual_qty or 0),
            approved_qty=approved,
            pct_complete=pct,
            balance_qty=balance,
            dpr_entry_count=actual.dpr_entry_count or 0,
            last_updated_at=actual.last_updated_at,
        ))

    results.sort(key=lambda r: r.pct_complete or 0, reverse=True)
    return results


# ── Endpoint 8: POST /activity-mapping ────────────────────────────────────────

@router.post("/activity-mapping", response_model=ActivityMappingOut, summary="Create a layer→BOQ activity mapping")
def create_activity_mapping(
    payload: ActivityMappingBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == payload.project_id,
        BoqActivityMapping.work_type == payload.work_type,
        BoqActivityMapping.layer_code == payload.layer_code,
        BoqActivityMapping.structure_type == payload.structure_type,
        BoqActivityMapping.element_code == payload.element_code,
        BoqActivityMapping.activity_code == payload.activity_code,
        BoqActivityMapping.is_deleted == False,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Mapping already exists for this combination")

    mapping = BoqActivityMapping(
        project_id=payload.project_id,
        work_type=payload.work_type,
        layer_code=payload.layer_code,
        structure_type=payload.structure_type,
        element_code=payload.element_code,
        activity_code=payload.activity_code,
        boq_item_code=payload.boq_item_code,
        volume_formula=payload.volume_formula,
        unit_conversion=payload.unit_conversion,
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


# ── Endpoint 9: GET /activity-mapping ─────────────────────────────────────────

@router.get("/activity-mapping", response_model=List[ActivityMappingOut], summary="List activity→BOQ mappings for a project")
def list_activity_mappings(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == project_id,
        BoqActivityMapping.is_active == True,
        BoqActivityMapping.is_deleted == False,
    ).order_by(BoqActivityMapping.layer_code).all()


# ── Schemas: suggest + bulk-confirm ───────────────────────────────────────────

class MappingSuggestion(BaseModel):
    work_type:       Optional[str] = None
    layer_code:      Optional[str] = None
    structure_type:  Optional[str] = None
    element_code:    Optional[str] = None
    activity_code:   Optional[str] = None
    boq_item_code:   str
    boq_description: str
    volume_formula:  str
    unit_conversion: float
    confidence:      str  # high / medium / low
    reasoning:       str


class SuggestResponse(BaseModel):
    suggestions:    List[MappingSuggestion]
    total:          int
    already_mapped: int
    error:          Optional[str] = None


class BulkConfirmBody(BaseModel):
    project_id:  str
    suggestions: List[MappingSuggestion]


class BulkConfirmResponse(BaseModel):
    created: int
    skipped: int


# ── Endpoint 10: POST /activity-mapping/suggest ───────────────────────────────

@router.post("/activity-mapping/suggest", response_model=SuggestResponse,
             summary="AI-suggest BOQ activity mappings for a project")
def suggest_activity_mappings(
    project_id: str = Query(...),
    force_test_confidence: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os
    import openai

    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    # 1. Load BOQ items (latest version, BOQ_ITEM only)
    version = db.query(BoqVersion).filter(
        BoqVersion.project_id == project_id,
        BoqVersion.is_deleted == False,
    ).order_by(BoqVersion.version_no.desc()).first()
    if not version:
        raise HTTPException(status_code=404, detail="No BOQ version found for this project")

    boq_items = db.query(BoqItem).filter(
        BoqItem.version_id == version.id,
        BoqItem.item_type == "BOQ_ITEM",
        BoqItem.is_deleted == False,
    ).all()

    # 2. Load master combinations
    work_types  = db.query(MasterWorkType).filter(MasterWorkType.is_active == True).all()
    layers      = db.query(MasterLayer).filter(MasterLayer.is_active == True).all()
    activities  = db.query(MasterActivity).filter(MasterActivity.is_active == True).all()
    elements    = db.query(MasterElement).filter(MasterElement.is_active == True).all()
    struct_types = db.query(MasterStructureType).filter(MasterStructureType.is_active == True).all()
    act_layers  = db.query(MasterActivityLayer).all()
    act_wt      = db.query(MasterActivityWorkType).all()
    sea         = db.query(MasterStructureElementActivity).all()

    # 3. Load existing confirmed mappings
    existing_mappings = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == project_id,
        BoqActivityMapping.is_active == True,
        BoqActivityMapping.is_deleted == False,
    ).all()

    existing_keys = set()
    existing_boq_codes = set()
    for m in existing_mappings:
        existing_keys.add((
            m.work_type or '',
            m.layer_code or '',
            m.structure_type or '',
            m.element_code or '',
            m.activity_code or '',
        ))
        existing_boq_codes.add(m.boq_item_code)

    # 4. Build prompt text blocks
    boq_items_text = "\n".join(
        f"{i.item_code} | {i.description} | {i.unit or ''} | Bill {i.bill_no or ''}: {i.bill_description or ''}"
        for i in boq_items
    )

    wt_map  = {w.code: w.label for w in work_types}
    lyr_map = {l.code: l.label for l in layers}
    act_map = {a.code: a.label for a in activities}
    el_map  = {e.code: e.label for e in elements}
    st_map  = {s.code: s.label for s in struct_types}

    # Build all master combo keys to calculate already_mapped accurately
    all_master_keys: set = set()
    combo_lines = []
    # ROAD combos: work_type + layer + activity
    for al in act_layers:
        for awt in act_wt:
            if awt.activity_code == al.activity_code:
                key = (awt.work_type_code or '', al.layer_code or '', '', '', al.activity_code or '')
                all_master_keys.add(key)
                if key not in existing_keys:
                    combo_lines.append(
                        f"{wt_map.get(awt.work_type_code, awt.work_type_code)} | "
                        f"{lyr_map.get(al.layer_code, al.layer_code)} | - | - | "
                        f"{act_map.get(al.activity_code, al.activity_code)}"
                    )
    # STRUCTURE combos: work_type + structure_type + element + activity
    for row in sea:
        for awt in act_wt:
            if awt.activity_code == row.activity_code:
                key = (awt.work_type_code or '', '', row.structure_type_code or '', row.element_code or '', row.activity_code or '')
                all_master_keys.add(key)
                if key not in existing_keys:
                    combo_lines.append(
                        f"{wt_map.get(awt.work_type_code, awt.work_type_code)} | - | "
                        f"{st_map.get(row.structure_type_code, row.structure_type_code)} | "
                        f"{el_map.get(row.element_code, row.element_code)} | "
                        f"{act_map.get(row.activity_code, row.activity_code)}"
                    )
    combinations_text = "\n".join(combo_lines) if combo_lines else "(none — all combinations already mapped)"

    existing_mappings_text = "\n".join(
        f"{m.work_type} | {m.layer_code} | {m.structure_type} | {m.element_code} | "
        f"{m.activity_code} → {m.boq_item_code}"
        for m in existing_mappings
    ) or "(none)"

    system_prompt = """You are a construction BOQ mapping expert for
Indian highway EPC projects. Your job is to match field DPR capture
combinations to the correct BOQ line items.

Rules:
- Match based on construction activity meaning, not just text similarity
- A DPR combination maps to exactly ONE BOQ item
- Consider the work type hierarchy: ROAD uses layers, STRUCTURE uses
  structure_type + element_code, DRAIN/ANCILLARY use activity_code
- For ROAD pavement layers: match layer material to BOQ description
- For STRUCTURE: match structure type + element + activity to BOQ item
- volume_formula rules:
  ROAD pavement (LM captures): use LxWxD
  STRUCTURE concrete/RCC: use QUANTITY (engineer enters Cum directly)
  STRUCTURE reinforcement: use QUANTITY (engineer enters MT)
  STRUCTURE shuttering: use QUANTITY (engineer enters Sqm)
  DRAIN concrete: use QUANTITY
  Linear items (drain, kerb): use LENGTH or LxW
- Confidence scoring:
  high: description clearly matches, unit matches
  medium: likely match but BOQ has multiple similar items
  low: uncertain, multiple candidates
- Return ONLY valid JSON, no explanation text"""

    user_prompt = f"""
Project: {project_id}

BOQ ITEMS (item_code | description | unit | bill):
{boq_items_text}

MASTER DPR COMBINATIONS (work_type | layer | structure_type | element | activity):
{combinations_text}

ALREADY MAPPED (skip these):
{existing_mappings_text}

Return a JSON array of mapping suggestions:
[
  {{
    "work_type": "ROAD",
    "layer_code": "WEARING",
    "structure_type": null,
    "element_code": null,
    "activity_code": "BC",
    "boq_item_code": "4.05",
    "boq_description": "Bituminous Concrete - VG 40",
    "volume_formula": "LxWxD",
    "unit_conversion": 1.0,
    "confidence": "high",
    "reasoning": "BC activity on WEARING layer = Bituminous Concrete"
  }}
]

Map ALL combinations that have a clear BOQ match.
Skip combinations with no reasonable BOQ match.
"""

    # 5. Call OpenAI API
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=4000,
        temperature=0,
    )

    # 6. Parse and return
    raw = response.choices[0].message.content.strip()
    # Strip markdown code fences if Claude wraps in ```json
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
        suggestions = [MappingSuggestion(**item) for item in data]
    except Exception as exc:
        return SuggestResponse(suggestions=[], total=0, already_mapped=0,
                               error=f"Failed to parse OpenAI response: {exc}")

    # Fix 1: load master code sets for normalisation
    layer_codes          = {r.code for r in db.query(MasterLayer).all()}
    structure_type_codes = {r.code for r in db.query(MasterStructureType).all()}
    element_codes        = {r.code for r in db.query(MasterElement).all()}
    activity_codes       = {r.code for r in db.query(MasterActivity).all()}

    normalised = []
    for s in suggestions:
        d = s.model_dump()
        if d.get('layer_code') and d['layer_code'] not in layer_codes:
            d['layer_code'] = None
        if d.get('structure_type') and d['structure_type'] not in structure_type_codes:
            d['structure_type'] = None
        if d.get('element_code') and d['element_code'] not in element_codes:
            d['element_code'] = None
        if d.get('activity_code') and d['activity_code'] not in activity_codes:
            d['activity_code'] = None
        normalised.append(MappingSuggestion(**d))

    # Level 1: filter out suggestions whose 5-tuple key is already in the DB
    filtered = [
        s for s in normalised
        if (s.work_type or '', s.layer_code or '', s.structure_type or '',
            s.element_code or '', s.activity_code or '')
        not in existing_keys
    ]

    # Level 2: filter out suggestions whose BOQ item code is already mapped
    filtered = [
        s for s in filtered
        if s.boq_item_code not in existing_boq_codes
    ]

    # Compute already_mapped from GPT suggestions (post-normalisation)
    all_suggestions = normalised
    already_mapped = sum(
        1 for s in all_suggestions
        if s.boq_item_code in existing_boq_codes
        or (s.work_type or '', s.layer_code or '', s.structure_type or '',
            s.element_code or '', s.activity_code or '') in existing_keys
    )

    # Deduplicate within the batch itself
    seen: set = set()
    deduped = []
    for s in filtered:
        key = (s.work_type or '', s.layer_code or '', s.structure_type or '',
               s.element_code or '', s.activity_code or '')
        if key not in seen:
            seen.add(key)
            deduped.append(s)
    suggestions = deduped

    # Test helper: override first three confidences so UI states can be verified
    if force_test_confidence and suggestions:
        overrides = ["high", "medium", "low"]
        for i, conf in enumerate(overrides):
            if i < len(suggestions):
                suggestions[i] = suggestions[i].model_copy(update={"confidence": conf})

    return SuggestResponse(
        suggestions=suggestions,
        total=len(suggestions),
        already_mapped=already_mapped,
    )


# ── Endpoint 10b: DELETE /activity-mapping/{mapping_id} ──────────────────────

@router.delete("/activity-mapping/{mapping_id}", summary="Deactivate a BOQ activity mapping")
def deactivate_activity_mapping(
    mapping_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mapping = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.id == mapping_id,
        BoqActivityMapping.is_deleted == False,
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    mapping.is_active = False
    db.commit()
    return {"ok": True}


# ── Endpoint 11: POST /activity-mapping/bulk-confirm ─────────────────────────

@router.post("/activity-mapping/bulk-confirm", response_model=BulkConfirmResponse,
             summary="Confirm and save approved AI mapping suggestions")
def bulk_confirm_activity_mappings(
    payload: BulkConfirmBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Load master code sets for normalisation
    layer_codes          = {r.code for r in db.query(MasterLayer).all()}
    structure_type_codes = {r.code for r in db.query(MasterStructureType).all()}
    element_codes        = {r.code for r in db.query(MasterElement).all()}
    activity_codes       = {r.code for r in db.query(MasterActivity).all()}

    # Build existing key set using '' for None (consistent with suggest endpoint)
    existing = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == payload.project_id,
        BoqActivityMapping.is_deleted == False,
    ).all()
    existing_keys = {
        (m.work_type or '', m.layer_code or '', m.structure_type or '',
         m.element_code or '', m.activity_code or '')
        for m in existing
    }

    created = 0
    skipped = 0
    seen_this_batch: set = set()

    for s in payload.suggestions:
        # Normalise: discard GPT labels that aren't valid codes
        lc  = s.layer_code     if s.layer_code     in layer_codes          else None
        st  = s.structure_type if s.structure_type  in structure_type_codes else None
        ec  = s.element_code   if s.element_code    in element_codes        else None
        ac  = s.activity_code  if s.activity_code   in activity_codes       else None

        key = (s.work_type or '', lc or '', st or '', ec or '', ac or '')

        if key in existing_keys or key in seen_this_batch:
            skipped += 1
            continue

        seen_this_batch.add(key)
        db.add(BoqActivityMapping(
            project_id=payload.project_id,
            work_type=s.work_type,
            layer_code=lc,
            structure_type=st,
            element_code=ec,
            activity_code=ac,
            boq_item_code=s.boq_item_code,
            volume_formula=s.volume_formula,
            unit_conversion=s.unit_conversion,
        ))
        created += 1

    db.commit()
    return BulkConfirmResponse(created=created, skipped=skipped)


# ── Endpoint 12: POST /activity-mapping/cleanup-duplicates ───────────────────

@router.post("/activity-mapping/cleanup-duplicates", summary="Remove duplicate mappings, keeping the most recent")
def cleanup_duplicate_mappings(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_active = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == project_id,
        BoqActivityMapping.is_active == True,
        BoqActivityMapping.is_deleted == False,
    ).order_by(BoqActivityMapping.created_at.desc()).all()

    # Group by 5-tuple key; first item per group (newest) is the keeper
    groups: dict = {}
    for m in all_active:
        key = (
            m.work_type or '',
            m.layer_code or '',
            m.structure_type or '',
            m.element_code or '',
            m.activity_code or '',
        )
        groups.setdefault(key, []).append(m)

    cleaned = 0
    for key, rows in groups.items():
        for duplicate in rows[1:]:  # skip the newest (rows[0])
            duplicate.is_active = False
            cleaned += 1

    db.commit()
    return {"cleaned": cleaned}
