"""
Master data CRUD for Materials, Machines, and Manpower Categories (3M).
All material/machine endpoints are project-scoped; manpower categories are global.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import uuid

from database import get_db
from auth import ensure_project_action, get_current_user
from models.resources import MaterialMaster, MachineMaster, ManpowerCategory
from models.user import User
from schemas.resources import (
    MaterialMasterCreate, MaterialMasterUpdate, MaterialMasterResponse,
    MachineMasterCreate, MachineMasterUpdate, MachineMasterResponse,
    ManpowerCategoryResponse,
)

router = APIRouter()


# ── Material Master ────────────────────────────────────────────────────────────

@router.post("/materials", response_model=MaterialMasterResponse, status_code=201,
             summary="Create a material master record")
def create_material(
    payload: MaterialMasterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, payload.project_id, "capture", "add")
    record = MaterialMaster(**payload.model_dump())
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Material code already exists for this project.")
    db.refresh(record)
    return record


@router.get("/materials", response_model=List[MaterialMasterResponse],
            summary="List material master records for a project")
def list_materials(
    project_id: uuid.UUID = Query(...),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, project_id, "capture", "view")
    q = db.query(MaterialMaster).filter(MaterialMaster.project_id == project_id)
    if active_only:
        q = q.filter(MaterialMaster.is_active == True)
    return q.order_by(MaterialMaster.material_code).all()


@router.get("/materials/{material_id}", response_model=MaterialMasterResponse,
            summary="Get a single material master record")
def get_material(
    material_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(MaterialMaster).filter(MaterialMaster.id == material_id).first()
    if not record:
        raise HTTPException(404, "Material not found.")
    ensure_project_action(db, user, record.project_id, "capture", "view")
    return record


@router.patch("/materials/{material_id}", response_model=MaterialMasterResponse,
              summary="Update a material master record")
def update_material(
    material_id: uuid.UUID,
    payload: MaterialMasterUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(MaterialMaster).filter(MaterialMaster.id == material_id).first()
    if not record:
        raise HTTPException(404, "Material not found.")
    ensure_project_action(db, user, record.project_id, "capture", "edit")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/materials/{material_id}", summary="Soft-delete a material master record")
def delete_material(
    material_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(MaterialMaster).filter(MaterialMaster.id == material_id).first()
    if not record:
        raise HTTPException(404, "Material not found.")
    ensure_project_action(db, user, record.project_id, "capture", "delete")
    record.is_active = False
    db.commit()
    return {"deactivated": True, "id": str(material_id)}


# ── Machine Master ─────────────────────────────────────────────────────────────

@router.post("/machines", response_model=MachineMasterResponse, status_code=201,
             summary="Create a machine master record")
def create_machine(
    payload: MachineMasterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, payload.project_id, "capture", "add")
    record = MachineMaster(**payload.model_dump())
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Machine code already exists for this project.")
    db.refresh(record)
    return record


@router.get("/machines", response_model=List[MachineMasterResponse],
            summary="List machine master records for a project")
def list_machines(
    project_id: uuid.UUID = Query(...),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, project_id, "capture", "view")
    q = db.query(MachineMaster).filter(MachineMaster.project_id == project_id)
    if active_only:
        q = q.filter(MachineMaster.is_active == True)
    return q.order_by(MachineMaster.machine_code).all()


@router.get("/machines/{machine_id}", response_model=MachineMasterResponse,
            summary="Get a single machine master record")
def get_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(MachineMaster).filter(MachineMaster.id == machine_id).first()
    if not record:
        raise HTTPException(404, "Machine not found.")
    ensure_project_action(db, user, record.project_id, "capture", "view")
    return record


@router.patch("/machines/{machine_id}", response_model=MachineMasterResponse,
              summary="Update a machine master record")
def update_machine(
    machine_id: uuid.UUID,
    payload: MachineMasterUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(MachineMaster).filter(MachineMaster.id == machine_id).first()
    if not record:
        raise HTTPException(404, "Machine not found.")
    ensure_project_action(db, user, record.project_id, "capture", "edit")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/machines/{machine_id}", summary="Soft-delete a machine master record")
def delete_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = db.query(MachineMaster).filter(MachineMaster.id == machine_id).first()
    if not record:
        raise HTTPException(404, "Machine not found.")
    ensure_project_action(db, user, record.project_id, "capture", "delete")
    record.is_active = False
    db.commit()
    return {"deactivated": True, "id": str(machine_id)}


# ── Manpower Categories (global, read-only from API) ──────────────────────────

@router.get("/manpower-categories", response_model=List[ManpowerCategoryResponse],
            summary="List all manpower categories")
def list_manpower_categories(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ManpowerCategory)
    if active_only:
        q = q.filter(ManpowerCategory.is_active == True)
    return q.order_by(ManpowerCategory.category_code).all()
