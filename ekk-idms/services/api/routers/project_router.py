from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from auth import verify_token
from models.project import Project

router = APIRouter()

@router.get("/", summary="List all projects")
def list_projects(
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    projects = db.query(Project).all()
    return [
        {
            "id": str(p.id),
            "project_code": p.project_code,
            "name": p.name,
            "client": p.client,
            "location": p.location,
        }
        for p in projects
    ]

@router.get("/{project_id}", summary="Get single project")
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": str(p.id),
        "project_code": p.project_code,
        "name": p.name,
        "client": p.client,
        "location": p.location,
    }