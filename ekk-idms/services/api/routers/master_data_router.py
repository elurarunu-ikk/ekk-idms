"""
Master Data Router — CRUD for work types, layers, activities, elements, structure types.
GET endpoints: public (all authenticated users, used by CaptureForm + mobile)
POST/PUT/DELETE: SUPER_ADMIN and ADMIN only
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from database import get_db
from auth import get_current_user
from models.master_data import (
    MasterWorkType, MasterLayer, MasterActivity,
    MasterActivityWorkType, MasterActivityLayer,
    MasterElement, MasterStructureType, MasterStructureElementActivity,
    MasterMaterial, MasterEquipment, MasterManpowerCategory,
)
from models.user import User
from schemas.master_data import (
    WorkTypeResponse, WorkTypeCreate, WorkTypeUpdate,
    LayerResponse, LayerCreate, LayerUpdate,
    ActivityResponse, ActivityCreate, ActivityUpdate,
    ElementResponse, ElementCreate, ElementUpdate,
    StructureTypeResponse, StructureTypeCreate, StructureTypeUpdate,
    MaterialResponse, MaterialCreate, MaterialUpdate,
    EquipmentResponse, EquipmentCreate, EquipmentUpdate,
    ManpowerCategoryResponse, ManpowerCategoryCreate, ManpowerCategoryUpdate,
)

router = APIRouter()

ADMIN_TYPES = {"SUPER_ADMIN", "SUPER ADMIN", "ADMIN"}

def require_admin(user: User):
    if user.user_type not in ADMIN_TYPES:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── WORK TYPES ────────────────────────────────────────────────────────────────

@router.get("/work-types", response_model=List[WorkTypeResponse])
def list_work_types(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MasterWorkType)
    if active_only:
        q = q.filter(MasterWorkType.is_active == True)
    return q.order_by(MasterWorkType.sort_order).all()


@router.post("/work-types", response_model=WorkTypeResponse)
def create_work_type(
    payload: WorkTypeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterWorkType).filter(MasterWorkType.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Work type '{payload.code}' already exists")
    obj = MasterWorkType(code=payload.code.upper(), label=payload.label, sort_order=payload.sort_order)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/work-types/{code}", response_model=WorkTypeResponse)
def update_work_type(
    code: str,
    payload: WorkTypeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterWorkType).filter(MasterWorkType.code == code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Work type not found")
    if payload.label is not None:
        obj.label = payload.label
    if payload.sort_order is not None:
        obj.sort_order = payload.sort_order
    if payload.is_active is not None:
        obj.is_active = payload.is_active
    db.commit()
    db.refresh(obj)
    return obj


# ── LAYERS ────────────────────────────────────────────────────────────────────

@router.get("/layers", response_model=List[LayerResponse])
def list_layers(
    work_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MasterLayer)
    if active_only:
        q = q.filter(MasterLayer.is_active == True)
    if work_type:
        q = q.filter(MasterLayer.work_type_code == work_type.upper())
    return q.order_by(MasterLayer.sort_order).all()


@router.post("/layers", response_model=LayerResponse)
def create_layer(
    payload: LayerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterLayer).filter(MasterLayer.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Layer '{payload.code}' already exists")
    obj = MasterLayer(
        code=payload.code.upper(),
        label=payload.label,
        work_type_code=payload.work_type_code,
        sort_order=payload.sort_order,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/layers/{code}", response_model=LayerResponse)
def update_layer(
    code: str,
    payload: LayerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterLayer).filter(MasterLayer.code == code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Layer not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj


# ── ACTIVITIES ────────────────────────────────────────────────────────────────

def _enrich_activity(activity: MasterActivity, db: Session) -> ActivityResponse:
    """Add work_types and layers lists to an activity response."""
    work_types = [
        r.work_type_code for r in
        db.query(MasterActivityWorkType)
        .filter(MasterActivityWorkType.activity_code == activity.code).all()
    ]
    layers = [
        r.layer_code for r in
        db.query(MasterActivityLayer)
        .filter(MasterActivityLayer.activity_code == activity.code).all()
    ]
    resp = ActivityResponse.model_validate(activity)
    resp.work_types = work_types
    resp.layers = layers
    return resp


@router.get("/activities", response_model=List[ActivityResponse])
def list_activities(
    work_type: Optional[str] = Query(None),
    layer: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get activities, optionally filtered by work_type and/or layer.
    work_type filter: activities that belong to that work type (via junction)
    layer filter: ROAD activities valid for that layer (via junction)
    Both filters can be combined.
    """
    q = db.query(MasterActivity)
    if active_only:
        q = q.filter(MasterActivity.is_active == True)

    if work_type:
        codes = [
            r.activity_code for r in
            db.query(MasterActivityWorkType)
            .filter(MasterActivityWorkType.work_type_code == work_type.upper()).all()
        ]
        q = q.filter(MasterActivity.code.in_(codes))

    if layer:
        codes = [
            r.activity_code for r in
            db.query(MasterActivityLayer)
            .filter(MasterActivityLayer.layer_code == layer.upper()).all()
        ]
        q = q.filter(MasterActivity.code.in_(codes))

    activities = q.order_by(MasterActivity.sort_order).all()
    return [_enrich_activity(a, db) for a in activities]


@router.post("/activities", response_model=ActivityResponse)
def create_activity(
    payload: ActivityCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterActivity).filter(MasterActivity.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Activity '{payload.code}' already exists")

    obj = MasterActivity(
        code=payload.code.upper(),
        label=payload.label,
        default_unit=payload.default_unit,
        sort_order=payload.sort_order,
    )
    db.add(obj)
    db.flush()  # get obj.code before commit

    for wt in payload.work_type_codes:
        db.add(MasterActivityWorkType(activity_code=obj.code, work_type_code=wt.upper()))
    for lc in payload.layer_codes:
        db.add(MasterActivityLayer(activity_code=obj.code, layer_code=lc.upper()))

    db.commit()
    db.refresh(obj)
    return _enrich_activity(obj, db)


@router.put("/activities/{code}", response_model=ActivityResponse)
def update_activity(
    code: str,
    payload: ActivityUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterActivity).filter(MasterActivity.code == code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Activity not found")

    for field in ["label", "default_unit", "sort_order", "is_active"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(obj, field, val)

    if payload.work_type_codes is not None:
        db.query(MasterActivityWorkType).filter(
            MasterActivityWorkType.activity_code == obj.code
        ).delete()
        for wt in payload.work_type_codes:
            db.add(MasterActivityWorkType(activity_code=obj.code, work_type_code=wt.upper()))

    if payload.layer_codes is not None:
        db.query(MasterActivityLayer).filter(
            MasterActivityLayer.activity_code == obj.code
        ).delete()
        for lc in payload.layer_codes:
            db.add(MasterActivityLayer(activity_code=obj.code, layer_code=lc.upper()))

    db.commit()
    db.refresh(obj)
    return _enrich_activity(obj, db)


# ── ELEMENTS ──────────────────────────────────────────────────────────────────

@router.get("/elements", response_model=List[ElementResponse])
def list_elements(
    structure_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get elements. If structure_type provided, filter to elements valid for that type."""
    q = db.query(MasterElement)
    if active_only:
        q = q.filter(MasterElement.is_active == True)
    if structure_type:
        codes = [
            r.element_code for r in
            db.query(MasterStructureElementActivity.element_code)
            .filter(MasterStructureElementActivity.structure_type_code == structure_type.upper())
            .distinct().all()
        ]
        q = q.filter(MasterElement.code.in_(codes))
    return q.order_by(MasterElement.sort_order).all()


@router.post("/elements", response_model=ElementResponse)
def create_element(
    payload: ElementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterElement).filter(MasterElement.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Element '{payload.code}' already exists")
    obj = MasterElement(code=payload.code.upper(), label=payload.label, sort_order=payload.sort_order)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/elements/{code}", response_model=ElementResponse)
def update_element(
    code: str,
    payload: ElementUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterElement).filter(MasterElement.code == code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Element not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj


# ── STRUCTURE TYPES ───────────────────────────────────────────────────────────

@router.get("/structure-types", response_model=List[StructureTypeResponse])
def list_structure_types(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MasterStructureType)
    if active_only:
        q = q.filter(MasterStructureType.is_active == True)
    return q.order_by(MasterStructureType.sort_order).all()


@router.post("/structure-types", response_model=StructureTypeResponse)
def create_structure_type(
    payload: StructureTypeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterStructureType).filter(
        MasterStructureType.code == payload.code.upper()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Structure type '{payload.code}' already exists")
    obj = MasterStructureType(
        code=payload.code.upper(), label=payload.label, sort_order=payload.sort_order
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/structure-types/{code}", response_model=StructureTypeResponse)
def update_structure_type(
    code: str,
    payload: StructureTypeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterStructureType).filter(
        MasterStructureType.code == code.upper()
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Structure type not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj


# ── STRUCTURE ELEMENT ACTIVITIES (filtered query) ────────────────────────────

@router.get("/structure-activities")
def get_structure_activities(
    structure_type: str = Query(...),
    element: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get activities valid for a specific structure type + element combination.
    Used by CaptureForm and mobile when structure type + element are selected.
    Returns activity objects in sort_order.
    """
    rows = (
        db.query(MasterStructureElementActivity, MasterActivity)
        .join(MasterActivity,
              MasterStructureElementActivity.activity_code == MasterActivity.code)
        .filter(
            MasterStructureElementActivity.structure_type_code == structure_type.upper(),
            MasterStructureElementActivity.element_code == element.upper(),
            MasterActivity.is_active == True,
        )
        .order_by(MasterStructureElementActivity.sort_order)
        .all()
    )
    return [
        {"code": act.code, "label": act.label, "default_unit": act.default_unit}
        for _, act in rows
    ]


# ── MATERIALS ─────────────────────────────────────────────────────────────────

@router.get("/materials", response_model=List[MaterialResponse])
def list_materials(
    category: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MasterMaterial)
    if active_only:
        q = q.filter(MasterMaterial.is_active == True)
    if category:
        q = q.filter(MasterMaterial.category == category.upper())
    return q.order_by(MasterMaterial.sort_order).all()


@router.post("/materials", response_model=MaterialResponse)
def create_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterMaterial).filter(
        MasterMaterial.code == payload.code.upper()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Material '{payload.code}' already exists")
    obj = MasterMaterial(
        code=payload.code.upper(), label=payload.label,
        default_unit=payload.default_unit, category=payload.category,
        sort_order=payload.sort_order,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/materials/{code}", response_model=MaterialResponse)
def update_material(
    code: str, payload: MaterialUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterMaterial).filter(MasterMaterial.code == code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Material not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj


# ── EQUIPMENT ─────────────────────────────────────────────────────────────────

@router.get("/equipment", response_model=List[EquipmentResponse])
def list_equipment(
    category: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MasterEquipment)
    if active_only:
        q = q.filter(MasterEquipment.is_active == True)
    if category:
        q = q.filter(MasterEquipment.category == category.upper())
    return q.order_by(MasterEquipment.sort_order).all()


@router.post("/equipment", response_model=EquipmentResponse)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterEquipment).filter(
        MasterEquipment.code == payload.code.upper()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Equipment '{payload.code}' already exists")
    obj = MasterEquipment(
        code=payload.code.upper(), label=payload.label,
        category=payload.category, sort_order=payload.sort_order,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/equipment/{code}", response_model=EquipmentResponse)
def update_equipment(
    code: str, payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterEquipment).filter(MasterEquipment.code == code.upper()).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Equipment not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj


# ── MANPOWER CATEGORIES ───────────────────────────────────────────────────────

@router.get("/manpower-categories", response_model=List[ManpowerCategoryResponse])
def list_manpower_categories(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MasterManpowerCategory)
    if active_only:
        q = q.filter(MasterManpowerCategory.is_active == True)
    return q.order_by(MasterManpowerCategory.sort_order).all()


@router.post("/manpower-categories", response_model=ManpowerCategoryResponse)
def create_manpower_category(
    payload: ManpowerCategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    existing = db.query(MasterManpowerCategory).filter(
        MasterManpowerCategory.code == payload.code.upper()
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{payload.code}' already exists")
    obj = MasterManpowerCategory(
        code=payload.code.upper(), label=payload.label,
        sort_order=payload.sort_order,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/manpower-categories/{code}", response_model=ManpowerCategoryResponse)
def update_manpower_category(
    code: str, payload: ManpowerCategoryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_admin(user)
    obj = db.query(MasterManpowerCategory).filter(
        MasterManpowerCategory.code == code.upper()
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Manpower category not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj
