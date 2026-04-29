import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_accessible_projects_for_user, get_current_user, require_roles
from database import get_db
from models.company import Company
from models.project import Project
from models.user import User
from schemas.admin import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter()


def _to_response(project: Project, company_name: str | None):
    return ProjectResponse(
        id=project.id,
        project_code=project.project_code,
        name=project.name,
        company_id=project.company_id,
        company_name=company_name,
        site_type=project.site_type or project.project_type,
        department_type=project.department_type or "Private",
        address_line_1=project.address_line_1,
        address_line_2=project.address_line_2,
        city=project.city,
        pincode=project.pincode,
        state=project.state,
        country=project.country,
        primary_contact_name=project.primary_contact_name,
        primary_contact_phone=project.primary_contact_phone,
        primary_contact_email=project.primary_contact_email,
        is_active=project.is_active,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/", response_model=list[ProjectResponse], summary="List all projects")
def list_projects(
    search: str | None = Query(None),
    site_type: str | None = Query(None),
    department_type: str | None = Query(None),
    include_inactive: bool = Query(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.user_type in {"SUPER ADMIN", "ADMIN"}:
        query = db.query(Project, Company.name).outerjoin(Company, Company.id == Project.company_id)
        if not include_inactive:
            query = query.filter(Project.is_active == True)
        if search:
            like = f"%{search.strip()}%"
            query = query.filter((Project.project_code.ilike(like)) | (Project.name.ilike(like)))
        if site_type:
            query = query.filter(Project.site_type == site_type)
        if department_type:
            query = query.filter(Project.department_type == department_type)
        return [_to_response(project, company_name) for project, company_name in query.order_by(Project.name.asc()).all()]

    accessible = get_accessible_projects_for_user(db, user)
    projects = []
    for project, _ in accessible:
        if search and search.strip().lower() not in f"{project.project_code} {project.name}".lower():
            continue
        if site_type and project.site_type != site_type:
            continue
        if department_type and project.department_type != department_type:
            continue
        if not include_inactive and not project.is_active:
            continue
        company_name = db.query(Company.name).filter(Company.id == project.company_id).scalar()
        projects.append(_to_response(project, company_name))
    return projects


@router.post("/", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreate,
    user: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    duplicate = db.query(Project).filter(Project.project_code == payload.project_code).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Project code already exists")
    project = Project(
        project_code=payload.project_code,
        name=payload.name,
        company_id=payload.company_id,
        client=db.query(Company.name).filter(Company.id == payload.company_id).scalar() if payload.company_id else None,
        project_type=payload.site_type,
        site_type=payload.site_type,
        department_type=payload.department_type,
        address_line_1=payload.address_line_1,
        address_line_2=payload.address_line_2,
        city=payload.city,
        pincode=payload.pincode,
        state=payload.state,
        country=payload.country,
        location=", ".join([part for part in [payload.city, payload.state, payload.country] if part]),
        primary_contact_name=payload.primary_contact_name,
        primary_contact_phone=payload.primary_contact_phone,
        primary_contact_email=payload.primary_contact_email,
        is_active=payload.is_active,
        created_by=user.email,
        updated_by=user.email,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    company_name = db.query(Company.name).filter(Company.id == project.company_id).scalar()
    return _to_response(project, company_name)


@router.get("/{project_id}", response_model=ProjectResponse, summary="Get single project")
def get_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.user_type not in {"SUPER ADMIN", "ADMIN"}:
        allowed_ids = {p.id for p, _ in get_accessible_projects_for_user(db, user)}
        if project.id not in allowed_ids:
            raise HTTPException(status_code=403, detail="Project access denied")
    company_name = db.query(Company.name).filter(Company.id == project.company_id).scalar()
    return _to_response(project, company_name)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    user: User = Depends(require_roles("SUPER ADMIN", "ADMIN")),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    updates = payload.model_dump(exclude_unset=True)
    if "project_code" in updates:
        duplicate = db.query(Project).filter(Project.project_code == updates["project_code"], Project.id != project_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="Project code already exists")
    for key, value in updates.items():
        if key == "site_type":
            project.site_type = value
            project.project_type = value
        else:
            setattr(project, key, value)
    if "company_id" in updates:
        project.client = db.query(Company.name).filter(Company.id == project.company_id).scalar() if project.company_id else None
    project.location = ", ".join([part for part in [project.city, project.state, project.country] if part])
    project.updated_by = user.email
    db.commit()
    db.refresh(project)
    company_name = db.query(Company.name).filter(Company.id == project.company_id).scalar()
    return _to_response(project, company_name)