"""master_data_tables

Revision ID: ffd5897ee2d0
Revises: a1b2c3d4e5f6
Create Date: 2026-06-04 07:51:36.201273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = 'ffd5897ee2d0'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create tables ────────────────────────────────────────────────────────

    op.create_table("master_work_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table("master_layers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("work_type_code", sa.String(50),
                  sa.ForeignKey("master_work_types.code"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table("master_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(150), nullable=False),
        sa.Column("default_unit", sa.String(20), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table("master_activity_work_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("activity_code", sa.String(50),
                  sa.ForeignKey("master_activities.code"), nullable=False),
        sa.Column("work_type_code", sa.String(50),
                  sa.ForeignKey("master_work_types.code"), nullable=False),
        sa.UniqueConstraint("activity_code", "work_type_code",
                            name="uq_activity_work_type"),
    )

    op.create_table("master_activity_layers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("activity_code", sa.String(50),
                  sa.ForeignKey("master_activities.code"), nullable=False),
        sa.Column("layer_code", sa.String(50),
                  sa.ForeignKey("master_layers.code"), nullable=False),
        sa.UniqueConstraint("activity_code", "layer_code", name="uq_activity_layer"),
    )

    op.create_table("master_elements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table("master_structure_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table("master_structure_element_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("structure_type_code", sa.String(50),
                  sa.ForeignKey("master_structure_types.code"), nullable=False),
        sa.Column("element_code", sa.String(50),
                  sa.ForeignKey("master_elements.code"), nullable=False),
        sa.Column("activity_code", sa.String(50),
                  sa.ForeignKey("master_activities.code"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint(
            "structure_type_code", "element_code", "activity_code",
            name="uq_structure_element_activity"
        ),
    )

    # ── Seed data ────────────────────────────────────────────────────────────
    # All data copied exactly from ekk-mobile/constants/data.js

    now = datetime.utcnow()

    # Work Types
    op.bulk_insert(
        sa.table("master_work_types",
            sa.column("id"), sa.column("code"), sa.column("label"),
            sa.column("sort_order"), sa.column("is_active"),
            sa.column("created_at"), sa.column("updated_at"),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "ROAD",      "label": "Road",      "sort_order": 1, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "STRUCTURE", "label": "Structure", "sort_order": 2, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DRAIN",     "label": "Drain",     "sort_order": 3, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "ANCILLARY", "label": "Ancillary", "sort_order": 4, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MISC",      "label": "Misc",      "sort_order": 5, "is_active": True, "created_at": now, "updated_at": now},
        ]
    )

    # Layers (all ROAD)
    op.bulk_insert(
        sa.table("master_layers",
            sa.column("id"), sa.column("code"), sa.column("label"),
            sa.column("work_type_code"), sa.column("sort_order"),
            sa.column("is_active"), sa.column("created_at"), sa.column("updated_at"),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "EMBANKMENT", "label": "Embankment",           "work_type_code": "ROAD", "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SUBGRADE",   "label": "Subgrade",             "work_type_code": "ROAD", "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "GSB",        "label": "GSB",                  "work_type_code": "ROAD", "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CTSB",       "label": "CTSB",                 "work_type_code": "ROAD", "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CTB",        "label": "CTB",                  "work_type_code": "ROAD", "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WMM",        "label": "WMM",                  "work_type_code": "ROAD", "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BASE",       "label": "Base Course",          "work_type_code": "ROAD", "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BINDER",     "label": "Binder Course (DBM)",  "work_type_code": "ROAD", "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WEARING",    "label": "Wearing Course (BC)",  "work_type_code": "ROAD", "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PRIME",      "label": "Prime Coat",           "work_type_code": "ROAD", "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "TACK",       "label": "Tack Coat",            "work_type_code": "ROAD", "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SHOULDER",   "label": "Shoulder",             "work_type_code": "ROAD", "sort_order": 12, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MEDIAN",     "label": "Median",               "work_type_code": "ROAD", "sort_order": 13, "is_active": True, "created_at": now, "updated_at": now},
        ]
    )

    # Activities (with default_unit from ACTIVITY_CONFIG)
    op.bulk_insert(
        sa.table("master_activities",
            sa.column("id"), sa.column("code"), sa.column("label"),
            sa.column("default_unit"), sa.column("sort_order"),
            sa.column("is_active"), sa.column("created_at"), sa.column("updated_at"),
        ),
        [
            # ROAD activities
            {"id": str(uuid.uuid4()), "code": "EARTHWORK",     "label": "Earthwork",             "default_unit": "CUM", "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "COMPACTION",    "label": "Compaction",            "default_unit": "CUM", "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "GSB_LAY",       "label": "GSB Laying",            "default_unit": "CUM", "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SPREADING",     "label": "Spreading",             "default_unit": "CUM", "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "ROLLING",       "label": "Rolling",               "default_unit": "LM",  "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WMM_LAY",       "label": "WMM Laying",            "default_unit": "CUM", "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DLC",           "label": "DLC",                   "default_unit": "CUM", "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DBM",           "label": "DBM",                   "default_unit": "TON", "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BC",            "label": "BC",                    "default_unit": "TON", "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SDBC",          "label": "SDBC",                  "default_unit": "TON", "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PRIME_COAT",    "label": "Prime Coat",            "default_unit": "LTR", "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "TACK_COAT",     "label": "Tack Coat",             "default_unit": "LTR", "sort_order": 12, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SHOULDER_PREP", "label": "Shoulder Preparation",  "default_unit": "CUM", "sort_order": 13, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MEDIAN_WORK",   "label": "Median Work",           "default_unit": "LM",  "sort_order": 14, "is_active": True, "created_at": now, "updated_at": now},
            # STRUCTURE + DRAIN activities
            {"id": str(uuid.uuid4()), "code": "RCC",           "label": "RCC",                   "default_unit": "CUM", "sort_order": 15, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PCC",           "label": "PCC",                   "default_unit": "CUM", "sort_order": 16, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "EXCAVATION",    "label": "Excavation",            "default_unit": "CUM", "sort_order": 17, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CASTING",       "label": "Casting",               "default_unit": "CUM", "sort_order": 18, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "ERECTION",      "label": "Erection",              "default_unit": "NOS", "sort_order": 19, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "LAUNCHING",     "label": "Launching",             "default_unit": "NOS", "sort_order": 20, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "INSTALLATION",  "label": "Installation",          "default_unit": "NOS", "sort_order": 21, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "REINF",         "label": "Reinforcement",         "default_unit": "KG",  "sort_order": 22, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SHUTTER",       "label": "Shuttering",            "default_unit": "SQM", "sort_order": 23, "is_active": True, "created_at": now, "updated_at": now},
            # ANCILLARY
            {"id": str(uuid.uuid4()), "code": "KERB",          "label": "Kerb",                  "default_unit": "LM",  "sort_order": 24, "is_active": True, "created_at": now, "updated_at": now},
            # DRAIN
            {"id": str(uuid.uuid4()), "code": "DRAIN",         "label": "Drain Work",            "default_unit": "LM",  "sort_order": 25, "is_active": True, "created_at": now, "updated_at": now},
            # MISC
            {"id": str(uuid.uuid4()), "code": "MISC",          "label": "Misc",                  "default_unit": None,  "sort_order": 26, "is_active": True, "created_at": now, "updated_at": now},
        ]
    )

    # Activity ↔ Work Type junction (from ACTIVITIES[].workTypes)
    act_work_type_rows = [
        # ROAD activities
        ("EARTHWORK",     "ROAD"),   ("COMPACTION",    "ROAD"),
        ("GSB_LAY",       "ROAD"),   ("SPREADING",     "ROAD"),
        ("ROLLING",       "ROAD"),   ("WMM_LAY",       "ROAD"),
        ("DLC",           "ROAD"),   ("DBM",           "ROAD"),
        ("BC",            "ROAD"),   ("SDBC",          "ROAD"),
        ("PRIME_COAT",    "ROAD"),   ("TACK_COAT",     "ROAD"),
        ("SHOULDER_PREP", "ROAD"),   ("MEDIAN_WORK",   "ROAD"),
        # STRUCTURE activities
        ("RCC",           "STRUCTURE"), ("PCC",        "STRUCTURE"),
        ("EXCAVATION",    "STRUCTURE"), ("CASTING",    "STRUCTURE"),
        ("ERECTION",      "STRUCTURE"), ("LAUNCHING",  "STRUCTURE"),
        ("INSTALLATION",  "STRUCTURE"), ("REINF",      "STRUCTURE"),
        ("SHUTTER",       "STRUCTURE"),
        # DRAIN activities
        ("RCC",           "DRAIN"),  ("PCC",           "DRAIN"),
        ("DRAIN",         "DRAIN"),
        # ANCILLARY
        ("KERB",          "ANCILLARY"),
        # MISC
        ("MISC",          "MISC"),
    ]
    op.bulk_insert(
        sa.table("master_activity_work_types",
            sa.column("id"), sa.column("activity_code"), sa.column("work_type_code"),
        ),
        [{"id": str(uuid.uuid4()), "activity_code": a, "work_type_code": w}
         for a, w in act_work_type_rows]
    )

    # Activity ↔ Layer junction (from ROAD_ACTIVITY_LAYER_MAP)
    act_layer_rows = [
        ("EARTHWORK",     "EMBANKMENT"), ("EARTHWORK",     "SUBGRADE"),
        ("COMPACTION",    "EMBANKMENT"), ("COMPACTION",    "SUBGRADE"),
        ("COMPACTION",    "WMM"),        ("COMPACTION",    "CTSB"),
        ("COMPACTION",    "CTB"),
        ("GSB_LAY",       "GSB"),
        ("SPREADING",     "GSB"),        ("SPREADING",     "CTSB"),
        ("SPREADING",     "CTB"),
        ("ROLLING",       "GSB"),        ("ROLLING",       "CTSB"),
        ("ROLLING",       "CTB"),
        ("WMM_LAY",       "WMM"),        ("WMM_LAY",       "BASE"),
        ("DLC",           "BASE"),       ("DLC",           "CTSB"),
        ("DLC",           "CTB"),
        ("DBM",           "BINDER"),
        ("BC",            "WEARING"),
        ("SDBC",          "WEARING"),
        ("PRIME_COAT",    "PRIME"),
        ("TACK_COAT",     "TACK"),
        ("SHOULDER_PREP", "SHOULDER"),
        ("MEDIAN_WORK",   "MEDIAN"),
    ]
    op.bulk_insert(
        sa.table("master_activity_layers",
            sa.column("id"), sa.column("activity_code"), sa.column("layer_code"),
        ),
        [{"id": str(uuid.uuid4()), "activity_code": a, "layer_code": l}
         for a, l in act_layer_rows]
    )

    # Elements
    op.bulk_insert(
        sa.table("master_elements",
            sa.column("id"), sa.column("code"), sa.column("label"),
            sa.column("sort_order"), sa.column("is_active"),
            sa.column("created_at"), sa.column("updated_at"),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "FOUNDATION",      "label": "Foundation",       "sort_order": 1,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "FOOTING",         "label": "Footing",          "sort_order": 2,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PIER",            "label": "Pier",             "sort_order": 3,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "PIER_CAP",        "label": "Pier Cap",         "sort_order": 4,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "ABUTMENT",        "label": "Abutment",         "sort_order": 5,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "DECK",            "label": "Deck Slab",        "sort_order": 6,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "GIRDER",          "label": "Girder",           "sort_order": 7,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "SLAB",            "label": "Slab",             "sort_order": 8,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "WING_WALL",       "label": "Wing Wall",        "sort_order": 9,  "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "BEARING",         "label": "Bearing",          "sort_order": 10, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "EXPANSION_JOINT", "label": "Expansion Joint", "sort_order": 11, "is_active": True, "created_at": now, "updated_at": now},
        ]
    )

    # Structure Types
    op.bulk_insert(
        sa.table("master_structure_types",
            sa.column("id"), sa.column("code"), sa.column("label"),
            sa.column("sort_order"), sa.column("is_active"),
            sa.column("created_at"), sa.column("updated_at"),
        ),
        [
            {"id": str(uuid.uuid4()), "code": "MINOR_BRIDGE", "label": "Minor Bridge", "sort_order": 1, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "MAJOR_BRIDGE", "label": "Major Bridge", "sort_order": 2, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "CULVERT",      "label": "Culvert",      "sort_order": 3, "is_active": True, "created_at": now, "updated_at": now},
            {"id": str(uuid.uuid4()), "code": "FLYOVER",      "label": "Flyover",      "sort_order": 4, "is_active": True, "created_at": now, "updated_at": now},
        ]
    )

    # Structure Type ↔ Element ↔ Activity junction (from STRUCTURE_ELEMENT_ACTIVITY_MAP)
    sea_rows = [
        # CULVERT
        ("CULVERT", "FOUNDATION", "EXCAVATION", 1), ("CULVERT", "FOUNDATION", "PCC", 2),
        ("CULVERT", "ABUTMENT",   "RCC", 1),        ("CULVERT", "ABUTMENT",   "REINF", 2),
        ("CULVERT", "ABUTMENT",   "SHUTTER", 3),
        ("CULVERT", "SLAB",       "RCC", 1),        ("CULVERT", "SLAB",       "REINF", 2),
        ("CULVERT", "SLAB",       "SHUTTER", 3),
        ("CULVERT", "WING_WALL",  "RCC", 1),        ("CULVERT", "WING_WALL",  "REINF", 2),
        ("CULVERT", "WING_WALL",  "SHUTTER", 3),
        # MINOR_BRIDGE
        ("MINOR_BRIDGE", "FOUNDATION", "EXCAVATION", 1), ("MINOR_BRIDGE", "FOUNDATION", "PCC", 2),
        ("MINOR_BRIDGE", "FOUNDATION", "RCC", 3),
        ("MINOR_BRIDGE", "FOOTING",    "RCC", 1),   ("MINOR_BRIDGE", "FOOTING",  "REINF", 2),
        ("MINOR_BRIDGE", "FOOTING",    "SHUTTER", 3),
        ("MINOR_BRIDGE", "PIER",       "RCC", 1),   ("MINOR_BRIDGE", "PIER",     "REINF", 2),
        ("MINOR_BRIDGE", "PIER",       "SHUTTER", 3),
        ("MINOR_BRIDGE", "ABUTMENT",   "RCC", 1),   ("MINOR_BRIDGE", "ABUTMENT", "REINF", 2),
        ("MINOR_BRIDGE", "ABUTMENT",   "SHUTTER", 3),
        ("MINOR_BRIDGE", "DECK",       "RCC", 1),   ("MINOR_BRIDGE", "DECK",     "REINF", 2),
        ("MINOR_BRIDGE", "DECK",       "SHUTTER", 3),
        # MAJOR_BRIDGE
        ("MAJOR_BRIDGE", "FOUNDATION",      "EXCAVATION", 1), ("MAJOR_BRIDGE", "FOUNDATION", "PCC", 2),
        ("MAJOR_BRIDGE", "FOUNDATION",      "RCC", 3),
        ("MAJOR_BRIDGE", "FOOTING",         "RCC", 1),   ("MAJOR_BRIDGE", "FOOTING",   "REINF", 2),
        ("MAJOR_BRIDGE", "FOOTING",         "SHUTTER", 3),
        ("MAJOR_BRIDGE", "PIER",            "RCC", 1),   ("MAJOR_BRIDGE", "PIER",      "REINF", 2),
        ("MAJOR_BRIDGE", "PIER",            "SHUTTER", 3),
        ("MAJOR_BRIDGE", "PIER_CAP",        "RCC", 1),   ("MAJOR_BRIDGE", "PIER_CAP",  "REINF", 2),
        ("MAJOR_BRIDGE", "PIER_CAP",        "SHUTTER", 3),
        ("MAJOR_BRIDGE", "GIRDER",          "CASTING", 1), ("MAJOR_BRIDGE", "GIRDER",   "ERECTION", 2),
        ("MAJOR_BRIDGE", "DECK",            "RCC", 1),   ("MAJOR_BRIDGE", "DECK",      "REINF", 2),
        ("MAJOR_BRIDGE", "DECK",            "SHUTTER", 3),
        ("MAJOR_BRIDGE", "ABUTMENT",        "RCC", 1),   ("MAJOR_BRIDGE", "ABUTMENT",  "REINF", 2),
        ("MAJOR_BRIDGE", "ABUTMENT",        "SHUTTER", 3),
        ("MAJOR_BRIDGE", "BEARING",         "INSTALLATION", 1),
        ("MAJOR_BRIDGE", "EXPANSION_JOINT", "INSTALLATION", 1),
        # FLYOVER
        ("FLYOVER", "FOUNDATION",      "EXCAVATION", 1), ("FLYOVER", "FOUNDATION", "PCC", 2),
        ("FLYOVER", "FOUNDATION",      "RCC", 3),
        ("FLYOVER", "FOOTING",         "RCC", 1),   ("FLYOVER", "FOOTING",   "REINF", 2),
        ("FLYOVER", "FOOTING",         "SHUTTER", 3),
        ("FLYOVER", "PIER",            "RCC", 1),   ("FLYOVER", "PIER",      "REINF", 2),
        ("FLYOVER", "PIER",            "SHUTTER", 3),
        ("FLYOVER", "PIER_CAP",        "RCC", 1),   ("FLYOVER", "PIER_CAP",  "REINF", 2),
        ("FLYOVER", "PIER_CAP",        "SHUTTER", 3),
        ("FLYOVER", "GIRDER",          "CASTING", 1), ("FLYOVER", "GIRDER",   "ERECTION", 2),
        ("FLYOVER", "GIRDER",          "LAUNCHING", 3),
        ("FLYOVER", "DECK",            "RCC", 1),   ("FLYOVER", "DECK",      "REINF", 2),
        ("FLYOVER", "DECK",            "SHUTTER", 3),
        ("FLYOVER", "ABUTMENT",        "RCC", 1),   ("FLYOVER", "ABUTMENT",  "REINF", 2),
        ("FLYOVER", "ABUTMENT",        "SHUTTER", 3),
        ("FLYOVER", "BEARING",         "INSTALLATION", 1),
        ("FLYOVER", "EXPANSION_JOINT", "INSTALLATION", 1),
    ]
    op.bulk_insert(
        sa.table("master_structure_element_activities",
            sa.column("id"), sa.column("structure_type_code"),
            sa.column("element_code"), sa.column("activity_code"),
            sa.column("sort_order"),
        ),
        [{"id": str(uuid.uuid4()), "structure_type_code": s,
          "element_code": e, "activity_code": a, "sort_order": o}
         for s, e, a, o in sea_rows]
    )


def downgrade() -> None:
    op.drop_table("master_structure_element_activities")
    op.drop_table("master_structure_types")
    op.drop_table("master_elements")
    op.drop_table("master_activity_layers")
    op.drop_table("master_activity_work_types")
    op.drop_table("master_activities")
    op.drop_table("master_layers")
    op.drop_table("master_work_types")
