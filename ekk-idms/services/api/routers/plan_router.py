from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import uuid

from database import get_db
from auth import ensure_project_action, get_accessible_projects_for_user, get_current_user, normalize_user_type
from models.plan_data import PlanData
from models.site_data import SiteDataTransaction
from models.user import User
from schemas.plan import (
    PlanDataResponse,
    PlanListResponse,
    ProgressSummaryResponse,
    StageProgressItem,
    ContractorProgressItem,
    OverdueItem,
)

router = APIRouter()


@router.get(
    "/",
    response_model=PlanListResponse,
    summary="List plan data entries"
)
def list_plans(
    project_id: Optional[uuid.UUID] = Query(None),
    stage: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List plan data entries with optional filtering by project_id and stage.
    """
    query = db.query(PlanData)

    if normalize_user_type(user) not in {"SUPER ADMIN", "ADMIN"}:
        allowed_ids = [project.id for project, _ in get_accessible_projects_for_user(db, user)]
        query = query.filter(PlanData.project_id.in_(allowed_ids))
    
    if project_id:
        ensure_project_action(db, user, project_id, "dashboard", "view")
        query = query.filter(PlanData.project_id == project_id)
    
    if stage:
        query = query.filter(PlanData.stage == stage)
    
    entries = query.all()
    return PlanListResponse(total=len(entries), entries=entries)


@router.get(
    "/{entry_id}",
    response_model=PlanDataResponse,
    summary="Get a single plan data entry"
)
def get_plan(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a single plan data entry by ID.
    """
    entry = db.query(PlanData).filter(PlanData.id == entry_id).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Plan entry not found")

    ensure_project_action(db, user, entry.project_id, "dashboard", "view")
    
    return entry


@router.get(
    "/progress/summary",
    response_model=ProgressSummaryResponse,
    summary="Get project progress summary"
)
def get_progress_summary(
    project_id: uuid.UUID = Query(..., description="Project ID"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get comprehensive progress summary for a project by joining plan_data
    with site_data_transactions on project_id, activity_code, and stage.
    """

    ensure_project_action(db, user, project_id, "dashboard", "view")
    
    # Get all plan entries for the project
    plan_entries = db.query(PlanData).filter(
        PlanData.project_id == project_id
    ).all()
    
    if not plan_entries:
        # Return empty summary
        return ProgressSummaryResponse(
            project_id=project_id,
            overall_completion_pct=0.0,
            total_planned_lm=0.0,
            total_approved_lm=0.0,
            total_pending_count=0,
            total_rejected_count=0,
            by_stage=[],
            by_contractor=[],
            overdue_entries=[],
        )
    
    # Get all captures for the project
    captures = db.query(SiteDataTransaction).filter(
        SiteDataTransaction.project_id == project_id
    ).all()
    
    # Calculate totals
    total_planned_lm = sum(p.planned_qty_lm for p in plan_entries)
    
    # Build lookup for approved captures by activity_code + stage
    approved_captures = {}
    pending_captures = {}
    rejected_captures = {}
    
    for cap in captures:
        key = (cap.activity_code, cap.stage)
        qty = float(cap.quantity_lm) if cap.quantity_lm else 0.0
        
        if cap.approved:
            if key not in approved_captures:
                approved_captures[key] = 0.0
            approved_captures[key] += qty
        elif cap.rejected:
            if key not in rejected_captures:
                rejected_captures[key] = 0.0
            rejected_captures[key] += qty
        else:
            if key not in pending_captures:
                pending_captures[key] = 0
            pending_captures[key] += 1
    
    total_approved_lm = sum(approved_captures.values())
    total_pending_count = sum(pending_captures.values())
    total_rejected_count = len(rejected_captures)
    
    # Calculate overall completion percentage
    overall_completion_pct = (
        (total_approved_lm / total_planned_lm * 100)
        if total_planned_lm > 0
        else 0.0
    )
    overall_completion_pct = round(overall_completion_pct, 1)
    
    # Build by_stage summary
    by_stage = []
    stage_summary = {}
    
    for plan in plan_entries:
        stage = plan.stage
        if stage not in stage_summary:
            stage_summary[stage] = {
                "planned_lm": 0.0,
                "submitted_lm": 0.0,
                "approved_lm": 0.0,
                "rejected_lm": 0.0,
                "pending_count": 0,
                "target_end": None,
            }
        
        stage_summary[stage]["planned_lm"] += plan.planned_qty_lm
        
        # Find corresponding captures
        key = (plan.activity_code, plan.stage)
        if key in approved_captures:
            stage_summary[stage]["approved_lm"] += approved_captures[key]
        if key in rejected_captures:
            stage_summary[stage]["rejected_lm"] += rejected_captures[key]
        if key in pending_captures:
            stage_summary[stage]["pending_count"] += pending_captures[key]
        
        # Submitted = approved + rejected + pending quantity
        submitted = (
            approved_captures.get(key, 0.0)
            + rejected_captures.get(key, 0.0)
        )
        stage_summary[stage]["submitted_lm"] += submitted
    
    # Calculate expected completion based on date
    today = date.today()
    
    for stage, data in stage_summary.items():
        planned_lm = data["planned_lm"]
        approved_lm = data["approved_lm"]
        pending_count = data["pending_count"]
        rejected_lm = data["rejected_lm"]
        
        completion_pct = (
            (approved_lm / planned_lm * 100) if planned_lm > 0 else 0.0
        )
        completion_pct = round(completion_pct, 1)
        
        # Calculate expected progress (rough estimate)
        # This is a simple heuristic based on date position
        stage_plans = [p for p in plan_entries if p.stage == stage]
        if stage_plans:
            avg_target_end = sum(
                (p.target_end - today).days for p in stage_plans
            ) / len(stage_plans)
            expected_pct = max(0, 100 - (avg_target_end * 2))  # Simple linear decay
        else:
            expected_pct = 100.0
        
        on_track = completion_pct >= (expected_pct * 0.8)  # 80% of expected
        
        by_stage.append(
            StageProgressItem(
                stage=stage,
                planned_lm=round(planned_lm, 1),
                submitted_lm=round(data["submitted_lm"], 1),
                approved_lm=round(approved_lm, 1),
                rejected_lm=round(rejected_lm, 1),
                pending_count=pending_count,
                completion_pct=completion_pct,
                on_track=on_track,
            )
        )
    
    # Build by_contractor summary
    contractor_summary = {}
    
    for plan in plan_entries:
        contractor = plan.contractor_name
        if contractor not in contractor_summary:
            contractor_summary[contractor] = {
                "planned_lm": 0.0,
                "approved_lm": 0.0,
                "rejected_count": 0,
                "total_count": 0,
            }
        
        contractor_summary[contractor]["planned_lm"] += plan.planned_qty_lm
        
        key = (plan.activity_code, plan.stage)
        if key in approved_captures:
            contractor_summary[contractor]["approved_lm"] += approved_captures[key]
        if key in rejected_captures:
            contractor_summary[contractor]["rejected_count"] += 1
        
        contractor_summary[contractor]["total_count"] += 1
    
    by_contractor = []
    for contractor, data in contractor_summary.items():
        planned_lm = data["planned_lm"]
        approved_lm = data["approved_lm"]
        rejected_count = data["rejected_count"]
        total_count = data["total_count"]
        
        completion_pct = (
            (approved_lm / planned_lm * 100) if planned_lm > 0 else 0.0
        )
        completion_pct = round(completion_pct, 1)
        
        rejection_rate_pct = (
            (rejected_count / total_count * 100) if total_count > 0 else 0.0
        )
        rejection_rate_pct = round(rejection_rate_pct, 1)
        
        by_contractor.append(
            ContractorProgressItem(
                contractor_name=contractor,
                planned_lm=round(planned_lm, 1),
                approved_lm=round(approved_lm, 1),
                rejection_rate_pct=rejection_rate_pct,
                completion_pct=completion_pct,
            )
        )
    
    # Find overdue entries
    overdue_entries = []
    today = date.today()
    
    for plan in plan_entries:
        # Overdue = target_end < today AND no approved capture exists
        if plan.target_end < today:
            key = (plan.activity_code, plan.stage)
            if key not in approved_captures or approved_captures[key] == 0.0:
                days_overdue = (today - plan.target_end).days
                # Check if there's a pending capture
                status = "pending" if key in pending_captures else "not_started"
                
                overdue_entries.append(
                    OverdueItem(
                        activity_code=plan.activity_code,
                        stage=plan.stage,
                        chainage_from=plan.chainage_from,
                        chainage_to=plan.chainage_to,
                        target_end=plan.target_end,
                        days_overdue=days_overdue,
                        status=status,
                    )
                )
    
    return ProgressSummaryResponse(
        project_id=project_id,
        overall_completion_pct=overall_completion_pct,
        total_planned_lm=round(total_planned_lm, 1),
        total_approved_lm=round(total_approved_lm, 1),
        total_pending_count=total_pending_count,
        total_rejected_count=total_rejected_count,
        by_stage=by_stage,
        by_contractor=by_contractor,
        overdue_entries=overdue_entries,
    )
