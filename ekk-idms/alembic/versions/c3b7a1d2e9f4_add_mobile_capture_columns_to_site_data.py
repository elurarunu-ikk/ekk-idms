"""add mobile capture columns to site data transactions

Revision ID: c3b7a1d2e9f4
Revises: 9c2f4b1e8d33
Create Date: 2026-04-28
"""

from alembic import op
import sqlalchemy as sa


revision = "c3b7a1d2e9f4"
down_revision = "9c2f4b1e8d33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "site_data_transactions",
        sa.Column("work_type", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("structure_type", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("layer_code", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("element_code", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("length_m", sa.Numeric(precision=12, scale=3), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("width_m", sa.Numeric(precision=12, scale=3), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("depth_m", sa.Numeric(precision=12, scale=3), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("site_data_transactions", "depth_m")
    op.drop_column("site_data_transactions", "width_m")
    op.drop_column("site_data_transactions", "length_m")
    op.drop_column("site_data_transactions", "element_code")
    op.drop_column("site_data_transactions", "layer_code")
    op.drop_column("site_data_transactions", "structure_type")
    op.drop_column("site_data_transactions", "work_type")
