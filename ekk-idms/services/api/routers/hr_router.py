"""
HR Router — employee cache lookup and CSV/XLSX sync.
"""
from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from auth import get_current_user, verify_token
from database import get_db
from models.user import User
from schemas.user_schemas import HRLookupResponse
from services.hr_service import get_role_suggestion, import_hr_csv, lookup_employee

router = APIRouter(tags=["HR"])


@router.get("/lookup", response_model=HRLookupResponse)
def hr_lookup(
    q:  str     = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _: dict     = Depends(verify_token),
):
    """Search HR employee cache by emp_id (exact) or name (partial). Returns up to 10."""
    results = lookup_employee(db, q)
    return HRLookupResponse(results=results)


@router.post("/sync")
def hr_sync(
    file: UploadFile = File(...),
    db:   Session    = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload CSV/XLSX to refresh HR employee cache. SUPER_ADMIN only."""
    if (current_user.user_type or "") not in ("SUPER_ADMIN", "SUPER ADMIN"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Only SUPER_ADMIN can sync HR data")
    content = file.file.read()
    return import_hr_csv(db, content, current_user.id)


@router.get("/role-suggest")
def role_suggest(
    designation: str = Query(...),
    department:  str = Query(""),
    db: Session  = Depends(get_db),
    _: dict      = Depends(verify_token),
):
    """Rules-based role/module suggestion based on designation and department."""
    return get_role_suggestion(db, designation, department)
