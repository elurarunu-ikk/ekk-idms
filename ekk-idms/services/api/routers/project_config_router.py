from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid

from database import get_db
from auth import get_current_user
from models.user import User
from models.project_layer_config import ProjectLayerConfig
from models.project_gradient_config import ProjectGradientConfig
from schemas.project_config import (
    ProjectLayerConfigCreate,
    ProjectLayerConfigResponse,
    ProjectLayerConfigListResponse,
    GradientConfigCreate,
    GradientConfigResponse,
    GradientConfigListResponse,
    GradientAtChainageResponse,
)

router = APIRouter()

LAYER_SEQUENCE_MAP = {
    "EMB": 1,
    "SG":  2,
    "GSB": 3,
    "CTB": 4,
    "WMM": 5,
    "DBM": 6,
    "BC":  7,
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _create_layer(db: Session, payload: ProjectLayerConfigCreate, user: User) -> ProjectLayerConfig:
    layer_code = payload.layer_code.upper().strip()

    # Deactivate existing active record for same project+layer
    existing = (
        db.query(ProjectLayerConfig)
        .filter(
            ProjectLayerConfig.project_id == payload.project_id,
            ProjectLayerConfig.layer_code == layer_code,
            ProjectLayerConfig.is_active == True,
        )
        .first()
    )
    next_version = 1
    if existing:
        next_version = existing.version + 1
        existing.is_active = False

    # Auto-compute total widths if not provided
    lhs = payload.lhs_offsets or []
    rhs = payload.rhs_offsets or []
    total_lhs = payload.total_width_lhs if payload.total_width_lhs is not None else (max(lhs) if lhs else None)
    total_rhs = payload.total_width_rhs if payload.total_width_rhs is not None else (max(rhs) if rhs else None)

    # Auto-set layer_sequence from code if not provided
    seq = payload.layer_sequence if payload.layer_sequence is not None else LAYER_SEQUENCE_MAP.get(layer_code)

    record = ProjectLayerConfig(
        id=uuid.uuid4(),
        project_id=payload.project_id,
        layer_code=layer_code,
        layer_desc=payload.layer_desc,
        road_type=payload.road_type,
        thickness_mm=payload.thickness_mm,
        camber_type=payload.camber_type,
        lhs_offsets=lhs if lhs else None,
        rhs_offsets=rhs if rhs else None,
        total_width_lhs=total_lhs,
        total_width_rhs=total_rhs,
        layer_sequence=seq,
        chainage_from=payload.chainage_from,
        chainage_to=payload.chainage_to,
        version=next_version,
        is_active=True,
        effective_from=payload.effective_from,
        created_by=user.email,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    return record


# ── Layer Config Endpoints ────────────────────────────────────────────────────

@router.post("/layers/", response_model=ProjectLayerConfigResponse, summary="Create or update a project layer config")
def create_layer_config(
    payload: ProjectLayerConfigCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = _create_layer(db, payload, user)
    db.commit()
    db.refresh(record)
    return record


@router.post("/layers/bulk/", response_model=ProjectLayerConfigListResponse, summary="Bulk create/update up to 10 layer configs")
def bulk_create_layer_config(
    payloads: List[ProjectLayerConfigCreate],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if len(payloads) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 layers per bulk request")

    records = [_create_layer(db, p, user) for p in payloads]
    db.commit()
    for r in records:
        db.refresh(r)

    return ProjectLayerConfigListResponse(total=len(records), entries=records)


@router.get("/layers/full-stack/", response_model=ProjectLayerConfigListResponse, summary="Get the full active pavement layer stack for a project")
def get_full_stack(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entries = (
        db.query(ProjectLayerConfig)
        .filter(
            ProjectLayerConfig.project_id == project_id,
            ProjectLayerConfig.is_active == True,
        )
        .order_by(ProjectLayerConfig.layer_sequence.asc())
        .all()
    )
    return ProjectLayerConfigListResponse(total=len(entries), entries=entries)


@router.get("/layers/", response_model=ProjectLayerConfigListResponse, summary="List layer configs with optional filters")
def list_layer_configs(
    project_id: str = Query(...),
    layer_code: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ProjectLayerConfig).filter(ProjectLayerConfig.project_id == project_id)
    if layer_code:
        q = q.filter(ProjectLayerConfig.layer_code == layer_code.upper().strip())
    if is_active is not None:
        q = q.filter(ProjectLayerConfig.is_active == is_active)

    entries = q.order_by(ProjectLayerConfig.layer_sequence.asc()).all()
    return ProjectLayerConfigListResponse(total=len(entries), entries=entries)


@router.get("/layers/{record_id}", response_model=ProjectLayerConfigResponse, summary="Get a single layer config by ID")
def get_layer_config(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(ProjectLayerConfig).filter(ProjectLayerConfig.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Layer config not found")
    return record


@router.put("/layers/{record_id}", response_model=ProjectLayerConfigResponse, summary="Update a layer config (append new version)")
def update_layer_config(
    record_id: uuid.UUID,
    payload: ProjectLayerConfigCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    current = db.query(ProjectLayerConfig).filter(ProjectLayerConfig.id == record_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Layer config not found")

    # Mark current as inactive; _create_layer will handle versioning from the active record
    # Since we're targeting a specific record, mark it inactive first then insert new
    current.is_active = False
    db.flush()

    record = _create_layer(db, payload, user)
    db.commit()
    db.refresh(record)
    return record


# ── Gradient Config Endpoints ─────────────────────────────────────────────────

@router.post("/gradient/", response_model=GradientConfigResponse, summary="Add a gradient segment (with overlap check)")
def create_gradient_config(
    payload: GradientConfigCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.chainage_from >= payload.chainage_to:
        raise HTTPException(status_code=400, detail="chainage_from must be less than chainage_to")

    # Overlap check — any active segment that overlaps the new range?
    overlap = (
        db.query(ProjectGradientConfig)
        .filter(
            ProjectGradientConfig.project_id == payload.project_id,
            ProjectGradientConfig.is_active == True,
            ProjectGradientConfig.chainage_from < payload.chainage_to,
            ProjectGradientConfig.chainage_to > payload.chainage_from,
        )
        .first()
    )
    if overlap:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Segment conflict: CH {payload.chainage_from}–{payload.chainage_to} overlaps "
                f"existing active segment CH {overlap.chainage_from}–{overlap.chainage_to}. "
                f"Deactivate it first."
            ),
        )

    record = ProjectGradientConfig(
        id=uuid.uuid4(),
        project_id=payload.project_id,
        chainage_from=payload.chainage_from,
        chainage_to=payload.chainage_to,
        gradient_pct=payload.gradient_pct,
        gradient_type=payload.gradient_type,
        vpi_chainage=payload.vpi_chainage,
        curve_length=payload.curve_length,
        road_side=payload.road_side or "BOTH",
        notes=payload.notes,
        version=1,
        is_active=True,
        effective_from=payload.effective_from,
        created_by=user.email,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/gradient/at-chainage/", response_model=GradientAtChainageResponse, summary="Find the active gradient segment at a given chainage")
def get_gradient_at_chainage(
    project_id: str = Query(...),
    chainage: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = (
        db.query(ProjectGradientConfig)
        .filter(
            ProjectGradientConfig.project_id == project_id,
            ProjectGradientConfig.is_active == True,
            ProjectGradientConfig.chainage_from <= chainage,
            ProjectGradientConfig.chainage_to >= chainage,
        )
        .order_by(ProjectGradientConfig.version.desc())
        .first()
    )
    if not record:
        return GradientAtChainageResponse(found=False, chainage=chainage)

    return GradientAtChainageResponse(
        found=True,
        chainage=chainage,
        gradient_pct=float(record.gradient_pct) if record.gradient_pct is not None else None,
        gradient_type=record.gradient_type,
        vpi_chainage=record.vpi_chainage,
        curve_length=float(record.curve_length) if record.curve_length is not None else None,
        notes=record.notes,
        version=record.version,
    )


@router.get("/gradient/", response_model=GradientConfigListResponse, summary="List gradient segments for a project")
def list_gradient_configs(
    project_id: str = Query(...),
    is_active: Optional[bool] = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ProjectGradientConfig).filter(ProjectGradientConfig.project_id == project_id)
    if is_active is not None:
        q = q.filter(ProjectGradientConfig.is_active == is_active)

    entries = q.order_by(ProjectGradientConfig.chainage_from.asc()).all()
    return GradientConfigListResponse(total=len(entries), entries=entries)


@router.put("/gradient/{record_id}", response_model=GradientConfigResponse, summary="Update a gradient segment (append new version)")
def update_gradient_config(
    record_id: uuid.UUID,
    payload: GradientConfigCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    current = db.query(ProjectGradientConfig).filter(ProjectGradientConfig.id == record_id).first()
    if not current:
        raise HTTPException(status_code=404, detail="Gradient config not found")

    if payload.chainage_from >= payload.chainage_to:
        raise HTTPException(status_code=400, detail="chainage_from must be less than chainage_to")

    # Overlap check excluding the current record being replaced
    overlap = (
        db.query(ProjectGradientConfig)
        .filter(
            ProjectGradientConfig.project_id == payload.project_id,
            ProjectGradientConfig.is_active == True,
            ProjectGradientConfig.id != record_id,
            ProjectGradientConfig.chainage_from < payload.chainage_to,
            ProjectGradientConfig.chainage_to > payload.chainage_from,
        )
        .first()
    )
    if overlap:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Segment conflict: CH {payload.chainage_from}–{payload.chainage_to} overlaps "
                f"existing active segment CH {overlap.chainage_from}–{overlap.chainage_to}."
            ),
        )

    current.is_active = False
    next_version = current.version + 1

    record = ProjectGradientConfig(
        id=uuid.uuid4(),
        project_id=payload.project_id,
        chainage_from=payload.chainage_from,
        chainage_to=payload.chainage_to,
        gradient_pct=payload.gradient_pct,
        gradient_type=payload.gradient_type,
        vpi_chainage=payload.vpi_chainage,
        curve_length=payload.curve_length,
        road_side=payload.road_side or "BOTH",
        notes=payload.notes,
        version=next_version,
        is_active=True,
        effective_from=payload.effective_from,
        created_by=user.email,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/gradient/{record_id}", summary="Soft-delete a gradient segment")
def delete_gradient_config(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(ProjectGradientConfig).filter(ProjectGradientConfig.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Gradient config not found")

    record.is_active = False
    db.commit()
    return {"deactivated": True, "id": str(record_id)}
