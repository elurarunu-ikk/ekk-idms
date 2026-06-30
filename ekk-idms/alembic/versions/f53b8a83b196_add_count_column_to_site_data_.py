"""add count column to site_data_transactions

Revision ID: f53b8a83b196
Revises: b2c3d4e5f6a7
Create Date: 2026-06-30 14:49:02.808411

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f53b8a83b196'
down_revision: Union[str, Sequence[str], None] = 'f2e3d4c5b6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_data_transactions',
        sa.Column('count', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('site_data_transactions', 'count')
