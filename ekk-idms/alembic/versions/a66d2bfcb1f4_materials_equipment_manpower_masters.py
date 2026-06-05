"""materials_equipment_manpower_masters

Revision ID: a66d2bfcb1f4
Revises: ffd5897ee2d0
Create Date: 2026-06-05 09:46:40.305338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = 'a66d2bfcb1f4'
down_revision: Union[str, Sequence[str], None] = 'ffd5897ee2d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    now = datetime.utcnow()

    op.create_table(
        "master_materials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("default_unit", sa.String(20), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "master_equipment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "master_manpower_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    # ── Seed Materials (21 rows) ───────────────────────────────────────────────
    op.bulk_insert(
        sa.table(
            "master_materials",
            sa.column("id", sa.String),
            sa.column("code", sa.String),
            sa.column("label", sa.String),
            sa.column("default_unit", sa.String),
            sa.column("category", sa.String),
            sa.column("sort_order", sa.Integer),
            sa.column("is_active", sa.Boolean),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "CEMENT",    "label": "Cement",             "default_unit": "BAG",  "category": "BINDING",    "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "STEEL",     "label": "Steel",              "default_unit": "KG",   "category": "STRUCTURAL", "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "AGGREGATE", "label": "Aggregate",          "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SAND",      "label": "Sand",               "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WATER",     "label": "Water",              "default_unit": "LTR",  "category": "OTHER",      "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BITUMEN",   "label": "Bitumen",            "default_unit": "MT",   "category": "BINDER",     "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "EMULSION",  "label": "Bitumen Emulsion",   "default_unit": "LTR",  "category": "BINDER",     "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WMM",       "label": "WMM Mix",            "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "GSB",       "label": "GSB Material",       "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DBM",       "label": "DBM Mix",            "default_unit": "MT",   "category": "BINDER",     "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BC",        "label": "BC Mix",             "default_unit": "MT",   "category": "BINDER",     "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SDBC",      "label": "SDBC Mix",           "default_unit": "MT",   "category": "BINDER",     "sort_order": 12, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CTB",       "label": "CTB Mix",            "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 13, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CTSB",      "label": "CTSB Material",      "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 14, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "RMC",       "label": "Ready Mix Concrete", "default_unit": "CUM",  "category": "BINDING",    "sort_order": 15, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "STONE",     "label": "Stone",              "default_unit": "CUM",  "category": "GRANULAR",   "sort_order": 16, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "LIME",      "label": "Lime",               "default_unit": "KG",   "category": "BINDING",    "sort_order": 17, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "FLY_ASH",   "label": "Fly Ash",            "default_unit": "KG",   "category": "BINDING",    "sort_order": 18, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "HDPE_PIPE", "label": "HDPE Pipe",          "default_unit": "LM",   "category": "OTHER",      "sort_order": 19, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PAINT",     "label": "Paint",              "default_unit": "LTR",  "category": "OTHER",      "sort_order": 20, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "OTHER",     "label": "Other",              "default_unit": None,   "category": "OTHER",      "sort_order": 99, "is_active": True, "created_at": now, "updated_at": now},
        ],
    )

    # ── Seed Equipment (20 rows) ───────────────────────────────────────────────
    op.bulk_insert(
        sa.table(
            "master_equipment",
            sa.column("id", sa.String),
            sa.column("code", sa.String),
            sa.column("label", sa.String),
            sa.column("category", sa.String),
            sa.column("sort_order", sa.Integer),
            sa.column("is_active", sa.Boolean),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "ROLLER",          "label": "Roller",           "category": "COMPACTION", "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "VIB_ROLLER",      "label": "Vibratory Roller", "category": "COMPACTION", "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PNEU_ROLLER",     "label": "Pneumatic Roller", "category": "COMPACTION", "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PAVER",           "label": "Paver",            "category": "PAVING",     "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "COMPACTOR",       "label": "Compactor",        "category": "COMPACTION", "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PLATE_COMPACTOR", "label": "Plate Compactor",  "category": "COMPACTION", "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "EXCAVATOR",       "label": "Excavator",        "category": "EARTHWORK",  "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "TIPPER",          "label": "Tipper",           "category": "TRANSPORT",  "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DUMPER",          "label": "Dumper",           "category": "TRANSPORT",  "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "GRADER",          "label": "Motor Grader",     "category": "EARTHWORK",  "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "LOADER",          "label": "Loader",           "category": "EARTHWORK",  "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CRANE",           "label": "Crane",            "category": "LIFTING",    "sort_order": 12, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "HYDRA_CRANE",     "label": "Hydra Crane",      "category": "LIFTING",    "sort_order": 13, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "TRANSIT_MIXER",   "label": "Transit Mixer",    "category": "CONCRETE",   "sort_order": 14, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CONCRETE_PUMP",   "label": "Concrete Pump",    "category": "CONCRETE",   "sort_order": 15, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CONCRETE_MIXER",  "label": "Concrete Mixer",   "category": "CONCRETE",   "sort_order": 16, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WATER_TANKER",    "label": "Water Tanker",     "category": "TRANSPORT",  "sort_order": 17, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "GENERATOR",       "label": "Generator",        "category": "POWER",      "sort_order": 18, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "TOTAL_STATION",   "label": "Total Station",    "category": "SURVEY",     "sort_order": 19, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "OTHER",           "label": "Other",            "category": "OTHER",      "sort_order": 99, "is_active": True, "created_at": now, "updated_at": now},
        ],
    )

    # ── Seed Manpower Categories (11 rows) ────────────────────────────────────
    op.bulk_insert(
        sa.table(
            "master_manpower_categories",
            sa.column("id", sa.String),
            sa.column("code", sa.String),
            sa.column("label", sa.String),
            sa.column("sort_order", sa.Integer),
            sa.column("is_active", sa.Boolean),
            sa.column("created_at", sa.DateTime),
            sa.column("updated_at", sa.DateTime),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "SKILLED",     "label": "Skilled",      "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SEMISKILLED",  "label": "Semi-Skilled", "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "UNSKILLED",    "label": "Unskilled",    "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MASON",        "label": "Mason",        "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CARPENTER",    "label": "Carpenter",    "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "ELECTRICIAN",  "label": "Electrician",  "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WELDER",       "label": "Welder",       "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "HELPER",       "label": "Helper",       "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "OPERATOR",     "label": "Operator",     "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SUPERVISOR",   "label": "Supervisor",   "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "ENGINEER",     "label": "Engineer",     "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
        ],
    )


def downgrade() -> None:
    op.drop_table("master_manpower_categories")
    op.drop_table("master_equipment")
    op.drop_table("master_materials")
