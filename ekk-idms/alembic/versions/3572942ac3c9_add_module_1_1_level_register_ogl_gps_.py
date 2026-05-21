"""add_module_1_1_level_register_ogl_gps_analysis

Revision ID: 3572942ac3c9
Revises: a6ba9292cb09
Create Date: 2026-05-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "3572942ac3c9"
down_revision: Union[str, Sequence[str], None] = "a6ba9292cb09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── level_register ────────────────────────────────────────────────────────
    op.create_table(
        "level_register",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.String(100), nullable=False),
        sa.Column("layer_code", sa.String(10), nullable=False),
        sa.Column("layer_desc", sa.String(200), nullable=True),
        sa.Column("thickness_mm", sa.Integer(), nullable=True),
        sa.Column("chainage", sa.Integer(), nullable=False),
        sa.Column("road_side", sa.String(1), nullable=False),
        sa.Column("frl_center", sa.Numeric(10, 4), nullable=True),
        sa.Column("camber_pct", sa.Numeric(8, 4), nullable=True),
        sa.Column("camber_type", sa.String(20), nullable=True),
        sa.Column("road_width_m", sa.Numeric(8, 4), nullable=True),
        sa.Column("offset_widths", postgresql.JSONB(), nullable=True),
        sa.Column("rl_values", postgresql.JSONB(), nullable=True),
        sa.Column("rl_at_0m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_2m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_6m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_9_5m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_11m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_edge", sa.Numeric(10, 4), nullable=True),
        sa.Column("tcs_ref", sa.String(50), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("uploaded_by", sa.String(200), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_level_register_project_id", "level_register", ["project_id"])
    op.create_index("ix_level_register_chainage", "level_register", ["chainage"])
    op.create_index(
        "ix_lr_project_layer_chainage_side",
        "level_register",
        ["project_id", "layer_code", "chainage", "road_side"],
    )

    # ── ogl ───────────────────────────────────────────────────────────────────
    op.create_table(
        "ogl",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.String(100), nullable=False),
        sa.Column("layer_code", sa.String(10), nullable=False, server_default=sa.text("'OGL'")),
        sa.Column("chainage", sa.Integer(), nullable=False),
        sa.Column("road_side", sa.String(1), nullable=False),
        sa.Column("ogl_cl", sa.Numeric(10, 4), nullable=True),
        sa.Column("frl_center", sa.Numeric(10, 4), nullable=True),
        sa.Column("road_width_m", sa.Numeric(8, 4), nullable=True),
        sa.Column("offset_widths", postgresql.JSONB(), nullable=True),
        sa.Column("rl_values", postgresql.JSONB(), nullable=True),
        sa.Column("rl_at_2m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_6m", sa.Numeric(10, 4), nullable=True),
        sa.Column("rl_at_edge", sa.Numeric(10, 4), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("uploaded_by", sa.String(200), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ogl_project_id", "ogl", ["project_id"])
    op.create_index("ix_ogl_chainage", "ogl", ["chainage"])
    op.create_index("ix_ogl_project_chainage_side", "ogl", ["project_id", "chainage", "road_side"])

    # ── gps_coordinates ───────────────────────────────────────────────────────
    op.create_table(
        "gps_coordinates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.String(100), nullable=False),
        sa.Column("chainage_from", sa.Integer(), nullable=False),
        sa.Column("chainage_to", sa.Integer(), nullable=False),
        sa.Column("nh_number", sa.String(50), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("district", sa.String(100), nullable=True),
        sa.Column("ro", sa.String(100), nullable=True),
        sa.Column("piu", sa.String(100), nullable=True),
        sa.Column("lat_start", sa.Numeric(12, 8), nullable=True),
        sa.Column("lon_start", sa.Numeric(12, 8), nullable=True),
        sa.Column("alt_start_m", sa.Numeric(10, 3), nullable=True),
        sa.Column("lat_end", sa.Numeric(12, 8), nullable=True),
        sa.Column("lon_end", sa.Numeric(12, 8), nullable=True),
        sa.Column("alt_end_m", sa.Numeric(10, 3), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gps_coordinates_project_id", "gps_coordinates", ["project_id"])
    op.create_index("ix_gps_project_chainage_from", "gps_coordinates", ["project_id", "chainage_from"])

    # ── ogl_analysis ──────────────────────────────────────────────────────────
    op.create_table(
        "ogl_analysis",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.String(100), nullable=False),
        sa.Column("chainage", sa.Integer(), nullable=False),
        sa.Column("road_side", sa.String(1), nullable=False),
        sa.Column("ogl_rl", sa.Numeric(10, 4), nullable=True),
        sa.Column("emb_frl", sa.Numeric(10, 4), nullable=True),
        sa.Column("cut_fill_m", sa.Numeric(10, 4), nullable=True),
        sa.Column("cut_fill_type", sa.String(10), nullable=True),
        sa.Column("cross_area_sqm", sa.Numeric(12, 4), nullable=True),
        sa.Column("volume_cum", sa.Numeric(12, 4), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("computed_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ogl_analysis_project_id", "ogl_analysis", ["project_id"])
    op.create_index("ix_ogla_project_chainage_side", "ogl_analysis", ["project_id", "chainage", "road_side"])


def downgrade() -> None:
    op.drop_index("ix_ogla_project_chainage_side", table_name="ogl_analysis")
    op.drop_index("ix_ogl_analysis_project_id", table_name="ogl_analysis")
    op.drop_table("ogl_analysis")

    op.drop_index("ix_gps_project_chainage_from", table_name="gps_coordinates")
    op.drop_index("ix_gps_coordinates_project_id", table_name="gps_coordinates")
    op.drop_table("gps_coordinates")

    op.drop_index("ix_ogl_project_chainage_side", table_name="ogl")
    op.drop_index("ix_ogl_chainage", table_name="ogl")
    op.drop_index("ix_ogl_project_id", table_name="ogl")
    op.drop_table("ogl")

    op.drop_index("ix_lr_project_layer_chainage_side", table_name="level_register")
    op.drop_index("ix_level_register_chainage", table_name="level_register")
    op.drop_index("ix_level_register_project_id", table_name="level_register")
    op.drop_table("level_register")
