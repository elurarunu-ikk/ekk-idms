import os
import shutil
import tempfile
import uuid
from typing import List

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from grade_sheet_parser import (
    compute_ogl_analysis,
    parse_gps_sheet,
    parse_layer_sheet,
    parse_ogl_sheet,
)
from models.gps_coordinates import GPSCoordinates
from models.level_register import LevelRegister
from models.ogl import OGL
from models.ogl_analysis import OGLAnalysis
from models.user import User
from schemas.level_register import GradeSheetUploadResponse, SheetUploadSummary

router = APIRouter()

LAYER_SHEETS = ["BC", "DBM", "WMM", "CTB", "CTSB", "GSB", "SUBGRADE", "EMBANKMENT TOP", "EMBANKMENT"]


@router.post(
    "/upload-grade-sheet",
    response_model=GradeSheetUploadResponse,
    summary="Upload Grade Sheet Excel — auto-parses all layer, OGL and GPS sheets",
)
def upload_grade_sheet(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files accepted")

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    uploaded_by = user.email
    summaries: List[SheetUploadSummary] = []
    total_inserted = 0

    try:
        wb = openpyxl.load_workbook(tmp_path, read_only=True)
        sheet_names = wb.sheetnames
        wb.close()

        # ── Layer sheets ──────────────────────────────────────────────────────
        for sheet_name in LAYER_SHEETS:
            if sheet_name not in sheet_names:
                continue

            records, error = parse_layer_sheet(tmp_path, sheet_name, project_id, uploaded_by)

            if error:
                summaries.append(SheetUploadSummary(
                    sheet_name=sheet_name, layer_code="UNKNOWN",
                    inserted=0, skipped=0, errors=[error],
                ))
                continue

            if not records:
                summaries.append(SheetUploadSummary(
                    sheet_name=sheet_name, layer_code="",
                    inserted=0, skipped=0, errors=[],
                ))
                continue

            layer_code = records[0]["layer_code"]
            inserted = skipped = 0
            errors = []

            for rec in records:
                try:
                    existing = (
                        db.query(LevelRegister)
                        .filter(
                            LevelRegister.project_id == project_id,
                            LevelRegister.layer_code == rec["layer_code"],
                            LevelRegister.chainage == rec["chainage"],
                            LevelRegister.road_side == rec["road_side"],
                            LevelRegister.is_active == True,
                        )
                        .first()
                    )
                    if existing:
                        rec["version"] = existing.version + 1
                        existing.is_active = False

                    db.add(LevelRegister(id=uuid.uuid4(), **rec))
                    inserted += 1
                except Exception as exc:
                    skipped += 1
                    errors.append(f"CH {rec.get('chainage')} {rec.get('road_side')}: {exc}")

            summaries.append(SheetUploadSummary(
                sheet_name=sheet_name, layer_code=layer_code,
                inserted=inserted, skipped=skipped, errors=errors[:10],
            ))
            total_inserted += inserted

        # ── OGL sheet ─────────────────────────────────────────────────────────
        if "OGL" in sheet_names:
            records, error = parse_ogl_sheet(tmp_path, project_id, uploaded_by)

            if error:
                summaries.append(SheetUploadSummary(
                    sheet_name="OGL", layer_code="OGL",
                    inserted=0, skipped=0, errors=[error],
                ))
            else:
                inserted = skipped = 0
                errors = []
                for rec in records:
                    try:
                        existing = (
                            db.query(OGL)
                            .filter(
                                OGL.project_id == project_id,
                                OGL.chainage == rec["chainage"],
                                OGL.road_side == rec["road_side"],
                                OGL.is_active == True,
                            )
                            .first()
                        )
                        if existing:
                            rec["version"] = existing.version + 1
                            existing.is_active = False

                        db.add(OGL(id=uuid.uuid4(), **rec))
                        inserted += 1
                    except Exception as exc:
                        skipped += 1
                        errors.append(f"CH {rec.get('chainage')} {rec.get('road_side')}: {exc}")

                summaries.append(SheetUploadSummary(
                    sheet_name="OGL", layer_code="OGL",
                    inserted=inserted, skipped=skipped, errors=errors[:10],
                ))
                total_inserted += inserted

        # ── GPS sheet ─────────────────────────────────────────────────────────
        if "GPS" in sheet_names:
            records, error = parse_gps_sheet(tmp_path, project_id, uploaded_by)

            if error:
                summaries.append(SheetUploadSummary(
                    sheet_name="GPS", layer_code="GPS",
                    inserted=0, skipped=0, errors=[error],
                ))
            else:
                inserted = skipped = 0
                errors = []
                for rec in records:
                    try:
                        existing = (
                            db.query(GPSCoordinates)
                            .filter(
                                GPSCoordinates.project_id == project_id,
                                GPSCoordinates.chainage_from == rec["chainage_from"],
                                GPSCoordinates.chainage_to == rec["chainage_to"],
                            )
                            .first()
                        )
                        if existing:
                            skipped += 1
                            continue

                        db.add(GPSCoordinates(id=uuid.uuid4(), **rec))
                        inserted += 1
                    except Exception as exc:
                        skipped += 1
                        errors.append(f"CH {rec.get('chainage_from')}-{rec.get('chainage_to')}: {exc}")

                summaries.append(SheetUploadSummary(
                    sheet_name="GPS", layer_code="GPS",
                    inserted=inserted, skipped=skipped, errors=errors[:10],
                ))
                total_inserted += inserted

        # ── Commit all inserts ────────────────────────────────────────────────
        db.commit()

        # ── OGL Analysis ──────────────────────────────────────────────────────
        ogl_computed = False
        ogl_count = db.query(OGL).filter(OGL.project_id == project_id).count()
        emb_count = (
            db.query(LevelRegister)
            .filter(
                LevelRegister.project_id == project_id,
                LevelRegister.layer_code == "EMB",
            )
            .count()
        )

        if ogl_count > 0 and emb_count > 0:
            db.query(OGLAnalysis).filter(OGLAnalysis.project_id == project_id).delete()
            analysis_records = compute_ogl_analysis(project_id, db)
            for rec in analysis_records:
                db.add(OGLAnalysis(id=uuid.uuid4(), **rec))
            db.commit()
            ogl_computed = True

    finally:
        os.unlink(tmp_path)

    layer_count = sum(1 for s in summaries if s.layer_code not in ("", "OGL", "GPS", "UNKNOWN"))
    return GradeSheetUploadResponse(
        project_id=project_id,
        sheets=summaries,
        total_records=total_inserted,
        ogl_computed=ogl_computed,
        message=f"Upload complete. {total_inserted} records inserted across {layer_count} layers.",
    )
