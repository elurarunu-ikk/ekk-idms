"""add progress status to site data transactions

Revision ID: 9c2f4b1e8d33
Revises: 7f315f7a67ae
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa


revision = "9c2f4b1e8d33"
down_revision = "7f315f7a67ae"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "site_data_transactions",
        sa.Column("progress_status", sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("site_data_transactions", "progress_status")
