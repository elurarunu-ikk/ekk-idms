"""add project layer and gradient config

Revision ID: a6ba9292cb09
Revises: e4d9b7c1a2f6
Create Date: 2026-05-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a6ba9292cb09"
down_revision: Union[str, Sequence[str], None] = "e4d9b7c1a2f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_layer_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.String(length=100), nullable=False),
        sa.Column("layer_code", sa.String(length=10), nullable=False),
        sa.Column("layer_desc", sa.String(length=200), nullable=True),
        sa.Column("road_type", sa.String(length=20), nullable=True),
        sa.Column("thickness_mm", sa.Integer(), nullable=True),
        sa.Column("camber_type", sa.String(length=20), nullable=True),
        sa.Column("lhs_offsets", postgresql.JSONB(), nullable=True),
        sa.Column("rhs_offsets", postgresql.JSONB(), nullable=True),
        sa.Column("total_width_lhs", sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column("total_width_rhs", sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column("layer_sequence", sa.Integer(), nullable=True),
        sa.Column("chainage_from", sa.Integer(), nullable=True),
        sa.Column("chainage_to", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("created_by", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_layer_config_project_id", "project_layer_config", ["project_id"])
    op.create_index("ix_plc_project_layer_active", "project_layer_config", ["project_id", "layer_code", "is_active"])

    op.create_table(
        "project_gradient_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.String(length=100), nullable=False),
        sa.Column("chainage_from", sa.Integer(), nullable=False),
        sa.Column("chainage_to", sa.Integer(), nullable=False),
        sa.Column("gradient_pct", sa.Numeric(precision=8, scale=4), nullable=True),
        sa.Column("gradient_type", sa.String(length=20), nullable=True),
        sa.Column("vpi_chainage", sa.Integer(), nullable=True),
        sa.Column("curve_length", sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column("road_side", sa.String(length=10), nullable=False, server_default=sa.text("'BOTH'")),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("created_by", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_gradient_config_project_id", "project_gradient_config", ["project_id"])
    op.create_index("ix_pgc_project_chainage", "project_gradient_config", ["project_id", "chainage_from", "chainage_to"])


def downgrade() -> None:
    op.drop_index("ix_pgc_project_chainage", table_name="project_gradient_config")
    op.drop_index("ix_project_gradient_config_project_id", table_name="project_gradient_config")
    op.drop_table("project_gradient_config")

    op.drop_index("ix_plc_project_layer_active", table_name="project_layer_config")
    op.drop_index("ix_project_layer_config_project_id", table_name="project_layer_config")
    op.drop_table("project_layer_config")
