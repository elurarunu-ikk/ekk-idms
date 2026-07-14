"""road_sections_road_sides_masters

Revision ID: f411c48f8af3
Revises: f53b8a83b196
Create Date: 2026-07-14 12:04:15.296711

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = 'f411c48f8af3'
down_revision: Union[str, Sequence[str], None] = 'f53b8a83b196'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    now = datetime.utcnow()

    op.create_table(
        "master_road_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(150), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "master_road_sides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(150), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    # ── Seed Road Sections (11 rows) ──────────────────────────────────────────
    op.bulk_insert(
        sa.table(
            "master_road_sections",
            sa.column("id", sa.String),
            sa.column("code", sa.String),
            sa.column("label", sa.String),
            sa.column("sort_order", sa.Integer),
            sa.column("is_active", sa.Boolean),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "MAIN_CARRIAGEWAY", "label": "Main Carriageway", "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SERVICE_ROAD",     "label": "Service Road",     "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SLIP_ROAD",        "label": "Slip Road",        "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "RAMP",             "label": "Ramp",             "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "LOOP",             "label": "Loop",             "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DIVERSION",        "label": "Diversion",        "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "APPROACH_ROAD",    "label": "Approach Road",    "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SHOULDER",         "label": "Shoulder",         "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MEDIAN",           "label": "Median",           "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "FOOTPATH",         "label": "Footpath",         "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CYCLE_TRACK",      "label": "Cycle Track",      "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
        ],
    )

    # ── Seed Road Sides (5 rows) ──────────────────────────────────────────────
    op.bulk_insert(
        sa.table(
            "master_road_sides",
            sa.column("id", sa.String),
            sa.column("code", sa.String),
            sa.column("label", sa.String),
            sa.column("sort_order", sa.Integer),
            sa.column("is_active", sa.Boolean),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "LHS",    "label": "LHS",    "sort_order": 1, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "RHS",    "label": "RHS",    "sort_order": 2, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BOTH",   "label": "Both",   "sort_order": 3, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MEDIAN", "label": "Median", "sort_order": 4, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "NA",     "label": "NA",     "sort_order": 5, "is_active": True, "created_at": now, "updated_at": now},
        ],
    )


def downgrade() -> None:
    op.drop_table("master_road_sides")
    op.drop_table("master_road_sections")
