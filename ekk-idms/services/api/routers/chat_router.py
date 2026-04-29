import json
import os
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from openai import OpenAI
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import ensure_project_action, get_current_user
from database import get_db
from models.user import User


router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    project_id: UUID
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    suggested_questions: list[str]


class ProjectSummary(BaseModel):
    overall_pct: float
    pending_count: int
    overdue_count: int


class ChatStartersResponse(BaseModel):
    project_summary: ProjectSummary
    starter_questions: list[str]


def _to_jsonable(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _rows_to_dicts(rows):
    output = []
    for row in rows:
        row_map = dict(row._mapping)
        output.append({key: _to_jsonable(val) for key, val in row_map.items()})
    return output


@router.post("/ask", response_model=ChatResponse)
def ask_chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, request.project_id, "chat", "view")
    try:
        try:
            stage_summary_sql = text(
                """
                SELECT
                  p.stage,
                  SUM(p.planned_qty_lm) AS planned_lm,
                  SUM(CASE WHEN s.approved = true THEN s.quantity_lm ELSE 0 END) AS approved_lm,
                  SUM(CASE WHEN s.approved = false AND s.rejected = false THEN s.quantity_lm ELSE 0 END) AS pending_lm,
                  COUNT(CASE WHEN s.rejected = true THEN 1 END) AS rejected_count,
                  COUNT(CASE WHEN s.approved = false AND s.rejected = false THEN 1 END) AS pending_count
                FROM plan_data p
                LEFT JOIN site_data_transactions s
                  ON s.project_id = p.project_id
                  AND s.activity_code = p.activity_code
                  AND s.stage = p.stage
                WHERE p.project_id = :project_id
                GROUP BY p.stage
                """
            )

            contractor_sql = text(
                """
                SELECT
                  s.contractor_name,
                  COUNT(*) AS total_entries,
                  SUM(CASE WHEN s.approved = true THEN 1 ELSE 0 END) AS approved_count,
                  SUM(CASE WHEN s.rejected = true THEN 1 ELSE 0 END) AS rejected_count,
                  SUM(CASE WHEN s.approved = true THEN s.quantity_lm ELSE 0 END) AS approved_lm
                FROM site_data_transactions s
                WHERE s.project_id = :project_id
                GROUP BY s.contractor_name
                """
            )

            project_meta_sql = text(
                """
                SELECT
                  id,
                  project_code,
                  name,
                  client,
                  location,
                  start_date,
                  end_date
                FROM projects
                WHERE id = :project_id
                LIMIT 1
                """
            )

            recent_activity_sql = text(
                """
                SELECT activity_code, stage, quantity_lm, approved,
                       rejected, contractor_name, created_at
                FROM site_data_transactions
                WHERE project_id = :project_id
                  AND created_at >= NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 20
                """
            )

            recent_activity_30d_sql = text(
                """
                SELECT activity_code, stage, quantity_lm, approved,
                       rejected, contractor_name, created_at
                FROM site_data_transactions
                WHERE project_id = :project_id
                  AND created_at >= NOW() - INTERVAL '30 days'
                ORDER BY created_at DESC
                LIMIT 50
                """
            )

            pending_entries_sql = text(
                """
                SELECT activity_code, stage, contractor_name,
                       quantity_lm, created_at
                FROM site_data_transactions
                WHERE project_id = :project_id
                  AND approved = false
                  AND rejected = false
                ORDER BY created_at DESC
                LIMIT 20
                """
            )

            rejection_reason_sql = text(
                """
                SELECT contractor_name, reject_reason,
                       COUNT(*) AS reject_count
                FROM site_data_transactions
                WHERE project_id = :project_id
                  AND rejected = true
                GROUP BY contractor_name, reject_reason
                ORDER BY reject_count DESC
                LIMIT 20
                """
            )

            overdue_items_sql = text(
                """
                SELECT p.activity_code, p.stage, p.chainage_from,
                       p.chainage_to, p.target_end, p.contractor_name
                FROM plan_data p
                WHERE p.project_id = :project_id
                  AND p.target_end < CURRENT_DATE
                  AND NOT EXISTS (
                    SELECT 1 FROM site_data_transactions s
                    WHERE s.project_id = p.project_id
                      AND s.activity_code = p.activity_code
                      AND s.stage = p.stage
                      AND s.approved = true
                  )
                ORDER BY p.target_end ASC
                LIMIT 10
                """
            )

            coverage_gap_sql = text(
                """
                SELECT p.activity_code,
                       p.stage,
                       p.contractor_name,
                       p.target_end,
                       COUNT(s.id) AS submission_count,
                       SUM(CASE WHEN s.approved = true THEN 1 ELSE 0 END) AS approved_count
                FROM plan_data p
                LEFT JOIN site_data_transactions s
                  ON s.project_id = p.project_id
                  AND s.activity_code = p.activity_code
                  AND s.stage = p.stage
                WHERE p.project_id = :project_id
                GROUP BY p.activity_code, p.stage, p.contractor_name, p.target_end
                ORDER BY p.target_end ASC
                LIMIT 100
                """
            )

            media_summary_sql = text(
                """
                SELECT s.stage,
                       s.contractor_name,
                       m.media_type,
                       COUNT(*) AS media_count
                FROM entry_media m
                JOIN site_data_transactions s
                  ON s.id = m.entry_id
                WHERE s.project_id = :project_id
                GROUP BY s.stage, s.contractor_name, m.media_type
                ORDER BY media_count DESC
                LIMIT 50
                """
            )

            params = {"project_id": request.project_id}
            project_meta_rows = db.execute(project_meta_sql, params).fetchall()
            project_meta = _rows_to_dicts(project_meta_rows)
            project_meta = project_meta[0] if project_meta else {}
            stage_summary = _rows_to_dicts(db.execute(stage_summary_sql, params).fetchall())
            contractor_performance = _rows_to_dicts(db.execute(contractor_sql, params).fetchall())
            recent_activity = _rows_to_dicts(db.execute(recent_activity_sql, params).fetchall())
            recent_activity_30d = _rows_to_dicts(db.execute(recent_activity_30d_sql, params).fetchall())
            pending_entries = _rows_to_dicts(db.execute(pending_entries_sql, params).fetchall())
            rejection_reasons = _rows_to_dicts(db.execute(rejection_reason_sql, params).fetchall())
            overdue_items = _rows_to_dicts(db.execute(overdue_items_sql, params).fetchall())
            coverage_gaps = _rows_to_dicts(db.execute(coverage_gap_sql, params).fetchall())
            media_summary = _rows_to_dicts(db.execute(media_summary_sql, params).fetchall())
        except Exception as db_error:
            print(f"chat_router db error: {db_error}")
            raise HTTPException(status_code=500, detail="Could not fetch project data")

        today = date.today().isoformat()
        recent_activity_7d_empty = len(recent_activity) == 0
        system_prompt = f"""
You are IDMS AI Assistant, an expert analyst for road construction
infrastructure projects. You help project managers and admin staff
understand project progress, identify issues, and make decisions.

You have access to real-time project data shown below.
ONLY use this data to answer questions. Do not make up numbers.
If something is not in the data, say "I don't have that information."

Be concise, specific, and use numbers. Format with bullet points
where helpful. Highlight risks or delays clearly.

Today's date: {today}

=== PROJECT PROGRESS DATA ===

PROJECT META:
{json.dumps(project_meta, indent=2)}

STAGE SUMMARY:
{json.dumps(stage_summary, indent=2)}

CONTRACTOR PERFORMANCE:
{json.dumps(contractor_performance, indent=2)}

RECENT ACTIVITY (last 7 days):
{json.dumps(recent_activity, indent=2)}

RECENT ACTIVITY (last 30 days fallback):
{json.dumps(recent_activity_30d, indent=2)}

PENDING ENTRIES:
{json.dumps(pending_entries, indent=2)}

REJECTION REASONS:
{json.dumps(rejection_reasons, indent=2)}

OVERDUE ITEMS (target passed, not yet approved):
{json.dumps(overdue_items, indent=2)}

COVERAGE GAPS (planned items with low or no submissions):
{json.dumps(coverage_gaps, indent=2)}

MEDIA SUMMARY:
{json.dumps(media_summary, indent=2)}

=== END OF DATA ===

When answering:
- Always mention the project name when project metadata is available
- Always mention specific numbers (LM, percentages, counts)
- If RECENT ACTIVITY (last 7 days) is empty and RECENT ACTIVITY (last 30 days fallback) has data, explicitly say there were no submissions in the last 7 days and use the 30-day data for trend/context
- Use PENDING ENTRIES to explain approval bottlenecks
- Use REJECTION REASONS to point out repeated quality issues
- Use COVERAGE GAPS to identify planned work with no submissions or no approvals
- Use MEDIA SUMMARY when the user asks about documentation completeness or evidence quality
- Flag any contractor with rejection rate above 20%
- Flag any stage below 50% completion if its target date has passed
- Suggest actions where relevant
- Keep responses under 300 words unless detailed analysis is requested

Recent activity 7-day block empty: {json.dumps(recent_activity_7d_empty)}
"""

        messages = [{"role": "system", "content": system_prompt}]

        for msg in request.history[-12:]:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": request.message})

        try:
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

            completion = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                messages=messages,
                max_tokens=600,
                temperature=0.3,
            )
            reply = completion.choices[0].message.content or "I don't have that information."

            suggestion_prompt = f"""
Based on this conversation about a road construction project,
suggest exactly 3 short follow-up questions the user might ask next.
Return ONLY a JSON array of 3 strings. No explanation. Example:
["Question 1?", "Question 2?", "Question 3?"]

User asked: {request.message}
Assistant replied: {reply[:200]}
"""

            suggestion_completion = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": suggestion_prompt}],
                max_tokens=150,
                temperature=0.5,
            )

            suggested_raw = suggestion_completion.choices[0].message.content or "[]"
            suggested = json.loads(suggested_raw)
            if not isinstance(suggested, list):
                raise ValueError("Suggested questions must be a list")
            suggested = [str(item) for item in suggested[:3]]
            if len(suggested) < 3:
                raise ValueError("Need exactly 3 suggestions")
        except HTTPException:
            raise
        except Exception as openai_error:
            print(f"chat_router openai error: {openai_error}")
            suggested = [
                "What is the overall completion percentage?",
                "Which contractor has the most rejections?",
                "Which stage is furthest behind schedule?",
            ]
            if "reply" not in locals():
                raise HTTPException(status_code=500, detail="AI service unavailable")

        return ChatResponse(reply=reply, suggested_questions=suggested)
    except HTTPException:
        raise
    except Exception as unexpected_error:
        print(f"chat_router unexpected error: {unexpected_error}")
        raise HTTPException(status_code=500, detail="AI service unavailable")


@router.get("/starters", response_model=ChatStartersResponse)
def get_chat_starters(
    project_id: UUID = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_project_action(db, user, project_id, "chat", "view")
    try:
        totals_sql = text(
            """
            SELECT
              COALESCE(SUM(planned_qty_lm), 0) AS total_planned
            FROM plan_data
            WHERE project_id = :project_id
            """
        )

        approved_sql = text(
            """
            SELECT
              COALESCE(SUM(quantity_lm), 0) AS total_approved
            FROM site_data_transactions
            WHERE project_id = :project_id
              AND approved = true
            """
        )

        pending_sql = text(
            """
            SELECT
              COUNT(*) AS pending_count
            FROM site_data_transactions
            WHERE project_id = :project_id
              AND approved = false
              AND rejected = false
            """
        )

        overdue_sql = text(
            """
            SELECT
              COUNT(*) AS overdue_count
            FROM plan_data p
            WHERE p.project_id = :project_id
              AND p.target_end < CURRENT_DATE
              AND NOT EXISTS (
                SELECT 1 FROM site_data_transactions s
                WHERE s.project_id = p.project_id
                  AND s.activity_code = p.activity_code
                  AND s.stage = p.stage
                  AND s.approved = true
              )
            """
        )

        params = {"project_id": project_id}
        total_planned = _to_jsonable(db.execute(totals_sql, params).scalar() or 0)
        total_approved = _to_jsonable(db.execute(approved_sql, params).scalar() or 0)
        pending_count = int(db.execute(pending_sql, params).scalar() or 0)
        overdue_count = int(db.execute(overdue_sql, params).scalar() or 0)

        overall_pct = 0.0
        if float(total_planned) > 0:
            overall_pct = round(float(total_approved) / float(total_planned) * 100.0, 1)

        return ChatStartersResponse(
            project_summary=ProjectSummary(
                overall_pct=overall_pct,
                pending_count=pending_count,
                overdue_count=overdue_count,
            ),
            starter_questions=[
                "What is the overall project completion status?",
                "Which stage is furthest behind schedule?",
                "How are the contractors performing?",
                "Are there any overdue items I should know about?",
                "What work was submitted in the last 7 days?",
                "Which entries are still pending approval?",
            ],
        )
    except Exception as db_error:
        print(f"chat_router starters db error: {db_error}")
        raise HTTPException(status_code=500, detail="Could not fetch project data")
