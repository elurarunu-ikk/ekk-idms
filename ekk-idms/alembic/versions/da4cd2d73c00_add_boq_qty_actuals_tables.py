"""add_boq_qty_actuals_tables

Revision ID: da4cd2d73c00
Revises: 3bde9bfba1b9
Create Date: 2026-06-23 16:05:35.728673

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'da4cd2d73c00'
down_revision: Union[str, Sequence[str], None] = '3bde9bfba1b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'boq_activity_mapping',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.String(length=100), nullable=False),
        sa.Column('layer_code', sa.String(length=50), nullable=False),
        sa.Column('activity_code', sa.String(length=50), nullable=True),
        sa.Column('boq_item_code', sa.String(length=30), nullable=False),
        sa.Column('volume_formula', sa.String(length=20), nullable=False),
        sa.Column('unit_conversion', sa.Numeric(precision=10, scale=6), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'layer_code', 'activity_code', name='uq_boq_activity_map'),
    )
    op.create_index('ix_boq_activity_mapping_project_layer', 'boq_activity_mapping', ['project_id', 'layer_code'], unique=False)

    op.create_table(
        'boq_qty_actuals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.String(length=100), nullable=False),
        sa.Column('boq_item_id', sa.UUID(), nullable=True),
        sa.Column('boq_item_code', sa.String(length=30), nullable=False),
        sa.Column('cumulative_actual_qty', sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column('approved_qty', sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column('last_dpr_id', sa.UUID(), nullable=True),
        sa.Column('last_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('dpr_entry_count', sa.Integer(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'boq_item_code', name='uq_boq_qty_actuals_project_item'),
    )
    op.create_index('ix_boq_qty_actuals_project_code', 'boq_qty_actuals', ['project_id', 'boq_item_code'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_boq_qty_actuals_project_code', table_name='boq_qty_actuals')
    op.drop_table('boq_qty_actuals')
    op.drop_index('ix_boq_activity_mapping_project_layer', table_name='boq_activity_mapping')
    op.drop_table('boq_activity_mapping')
