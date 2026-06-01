"""
HR Service — employee cache lookup, CSV/XLSX import, role suggestion.
"""
from __future__ import annotations
import io
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user_mgmt_models import HREmployeeCache
from schemas.user_schemas import HREmployeeResponse


def lookup_employee(db: Session, q: str) -> List[HREmployeeResponse]:
    """Search hr_employee_cache by emp_id (exact) or full_name (ILIKE). Max 10."""
    rows = (
        db.query(HREmployeeCache)
        .filter(
            (HREmployeeCache.emp_id == q) |
            HREmployeeCache.full_name.ilike(f"%{q}%")
        )
        .filter(HREmployeeCache.is_active == True)
        .limit(10)
        .all()
    )
    return [HREmployeeResponse.model_validate(r) for r in rows]


def import_hr_csv(db: Session, file_content: bytes, uploader_id: UUID) -> dict:
    """Parse CSV/XLSX. Upsert into hr_employee_cache. Return summary."""
    try:
        import pandas as pd
        try:
            df = pd.read_excel(io.BytesIO(file_content))
        except Exception:
            df = pd.read_csv(io.BytesIO(file_content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot parse file: {e}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    required = {"emp_id", "full_name"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}")

    inserted = updated = skipped = 0
    errors = []

    for _, row in df.iterrows():
        emp_id = str(row.get("emp_id", "")).strip()
        full_name = str(row.get("full_name", "")).strip()
        if not emp_id or not full_name or emp_id == "nan":
            skipped += 1
            continue
        try:
            existing = db.query(HREmployeeCache).filter(HREmployeeCache.emp_id == emp_id).first()
            if existing:
                existing.full_name   = full_name
                existing.department  = str(row.get("department", "") or "").strip() or None
                existing.designation = str(row.get("designation", "") or "").strip() or None
                existing.email       = str(row.get("email", "") or "").strip() or None
                existing.phone       = str(row.get("phone", "") or "").strip() or None
                updated += 1
            else:
                db.add(HREmployeeCache(
                    emp_id=emp_id, full_name=full_name,
                    department=str(row.get("department", "") or "").strip() or None,
                    designation=str(row.get("designation", "") or "").strip() or None,
                    email=str(row.get("email", "") or "").strip() or None,
                    phone=str(row.get("phone", "") or "").strip() or None,
                ))
                inserted += 1
        except Exception as e:
            errors.append({"emp_id": emp_id, "error": str(e)})

    db.commit()
    return {"inserted": inserted, "updated": updated, "skipped": skipped, "errors": errors}


def get_role_suggestion(db: Session, designation: str, department: str) -> dict:
    """Rules-based role recommender. Returns most common user_type for this designation."""
    from models.user import User
    from sqlalchemy import func

    rows = (
        db.query(User.user_type, func.count(User.id).label("cnt"))
        .filter(User.designation == designation, User.is_active == True)
        .group_by(User.user_type)
        .order_by(func.count(User.id).desc())
        .limit(3)
        .all()
    )
    if not rows:
        return {"user_type": "USER", "module_ids": [], "confidence": 0.0,
                "reason": "No matching designation found — defaulting to USER"}

    top_type, top_count = rows[0]
    total = sum(r.cnt for r in rows)
    confidence = round(top_count / total, 2) if total else 0.0

    return {
        "user_type": top_type,
        "module_ids": [],
        "confidence": confidence,
        "reason": f"Based on {top_count}/{total} users with designation '{designation}'",
    }
