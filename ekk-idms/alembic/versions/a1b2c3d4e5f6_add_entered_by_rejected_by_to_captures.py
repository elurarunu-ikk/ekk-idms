"""add entered_by and rejected_by to site_data_transactions

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-06-03

Adds two audit columns so the web and mobile can display who submitted
and who rejected each capture entry.
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'site_data_transactions',
        sa.Column('entered_by', sa.String(200), nullable=True),
    )
    op.add_column(
        'site_data_transactions',
        sa.Column('rejected_by', sa.String(200), nullable=True),
    )


def downgrade():
    op.drop_column('site_data_transactions', 'rejected_by')
    op.drop_column('site_data_transactions', 'entered_by')
