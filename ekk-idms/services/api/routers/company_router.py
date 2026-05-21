import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user, require_roles
from database import get_db
from models.company import Company
from models.user import User
from schemas.admin import CompanyCreate, CompanyResponse, CompanyUpdate


router = APIRouter()


@router.get("/", response_model=list[CompanyResponse])
def list_companies(
    search: str | None = Query(None),
    include_inactive: bool = Query(False),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Company)
    if not include_inactive:
        query = query.filter(Company.is_active == True)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter((Company.company_code.ilike(like)) | (Company.name.ilike(like)))
    return query.order_by(Company.name.asc()).all()


@router.post("/", response_model=CompanyResponse)
def create_company(
    payload: CompanyCreate,
    user: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    duplicate = db.query(Company).filter((Company.company_code == payload.company_code) | (Company.name == payload.name)).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Company code or name already exists")
    company = Company(**payload.model_dump(), created_by=user.email, updated_by=user.email)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: uuid.UUID,
    payload: CompanyUpdate,
    user: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    updates = payload.model_dump(exclude_unset=True)
    if "company_code" in updates:
        duplicate = db.query(Company).filter(Company.company_code == updates["company_code"], Company.id != company_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Company code already exists")
    if "name" in updates:
        duplicate = db.query(Company).filter(Company.name == updates["name"], Company.id != company_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Company name already exists")
    for key, value in updates.items():
        setattr(company, key, value)
    company.updated_by = user.email
    db.commit()
    db.refresh(company)
    return company