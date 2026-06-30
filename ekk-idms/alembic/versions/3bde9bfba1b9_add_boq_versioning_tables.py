"""add_boq_versioning_tables

Revision ID: 3bde9bfba1b9
Revises: b2c3d4e5f6a7
Create Date: 2026-06-23 06:36:39.943918

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '3bde9bfba1b9'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'boq_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.String(length=100), nullable=False),
        sa.Column('version_no', sa.Integer(), nullable=False),
        sa.Column('state', sa.String(length=20), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=True),
        sa.Column('is_locked', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('created_by', sa.String(length=200), nullable=True),
        sa.Column('approved_by', sa.String(length=200), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('doc_ref', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'version_no', name='uq_boq_version_project_vno'),
    )
    op.create_index('ix_boq_versions_project_id', 'boq_versions', ['project_id'], unique=False)

    op.create_table(
        'boq_item_changes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('boq_item_id', sa.UUID(), nullable=False),
        sa.Column('change_type', sa.String(length=20), nullable=False),
        sa.Column('old_qty', sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column('new_qty', sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column('old_rate', sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column('new_rate', sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column('reason_code', sa.String(length=50), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('doc_ref', sa.String(length=255), nullable=True),
        sa.Column('submitted_by', sa.String(length=200), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('approval_status', sa.String(length=20), server_default=sa.text("'PENDING'"), nullable=True),
        sa.Column('l1_approved_by', sa.String(length=200), nullable=True),
        sa.Column('l1_approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.String(length=200), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_by', sa.String(length=200), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_boq_item_changes_item_id', 'boq_item_changes', ['boq_item_id'], unique=False)
    op.create_index('ix_boq_item_changes_status', 'boq_item_changes', ['approval_status'], unique=False)

    op.add_column('boq_items', sa.Column('version_id', sa.UUID(), nullable=False))
    op.add_column('boq_items', sa.Column('uid', sa.Integer(), nullable=True))
    op.add_column('boq_items', sa.Column('item_code', sa.String(length=30), nullable=False))
    op.add_column('boq_items', sa.Column('bill_no', sa.String(length=10), nullable=True))
    op.add_column('boq_items', sa.Column('bill_description', sa.Text(), nullable=True))
    op.add_column('boq_items', sa.Column('item_type', sa.String(length=20), nullable=False))
    op.add_column('boq_items', sa.Column('adjusted_rate', sa.Numeric(precision=14, scale=4), nullable=True))
    op.add_column('boq_items', sa.Column('expected_scope', sa.Numeric(precision=14, scale=3), nullable=True))
    op.add_column('boq_items', sa.Column('revised_scope', sa.Numeric(precision=14, scale=3), nullable=True))
    op.add_column('boq_items', sa.Column('wtg', sa.Numeric(precision=12, scale=8), nullable=True))
    op.add_column('boq_items', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True))
    op.add_column('boq_items', sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True))
    op.add_column('boq_items', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True))

    op.alter_column('boq_items', 'description',
                    existing_type=sa.VARCHAR(length=500),
                    type_=sa.Text(),
                    nullable=False)

    op.create_index('ix_boq_items_version_bill', 'boq_items', ['version_id', 'bill_no'], unique=False)
    op.create_index(op.f('ix_boq_items_version_id'), 'boq_items', ['version_id'], unique=False)
    op.create_unique_constraint('uq_boq_item_version_code', 'boq_items', ['version_id', 'item_code'])

    op.drop_constraint('boq_items_project_id_fkey', 'boq_items', type_='foreignkey')
    op.drop_column('boq_items', 'project_id')
    op.drop_column('boq_items', 'schedule_h_code')
    op.drop_column('boq_items', 'quantity')
    op.drop_column('boq_items', 'amount')
    op.drop_column('boq_items', 'rate')


def downgrade() -> None:
    op.add_column('boq_items', sa.Column('rate', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('boq_items', sa.Column('amount', sa.Numeric(precision=18, scale=2), nullable=True))
    op.add_column('boq_items', sa.Column('project_id', sa.UUID(), nullable=True))
    op.add_column('boq_items', sa.Column('quantity', sa.Numeric(precision=14, scale=3), nullable=True))
    op.add_column('boq_items', sa.Column('schedule_h_code', sa.String(length=50), nullable=True))

    op.create_foreign_key('boq_items_project_id_fkey', 'boq_items', 'projects', ['project_id'], ['id'])

    op.drop_constraint('uq_boq_item_version_code', 'boq_items', type_='unique')
    op.drop_index(op.f('ix_boq_items_version_id'), table_name='boq_items')
    op.drop_index('ix_boq_items_version_bill', table_name='boq_items')

    op.alter_column('boq_items', 'description',
                    existing_type=sa.Text(),
                    type_=sa.VARCHAR(length=500),
                    nullable=True)

    op.drop_column('boq_items', 'created_at')
    op.drop_column('boq_items', 'is_deleted')
    op.drop_column('boq_items', 'is_active')
    op.drop_column('boq_items', 'wtg')
    op.drop_column('boq_items', 'revised_scope')
    op.drop_column('boq_items', 'expected_scope')
    op.drop_column('boq_items', 'adjusted_rate')
    op.drop_column('boq_items', 'item_type')
    op.drop_column('boq_items', 'bill_description')
    op.drop_column('boq_items', 'bill_no')
    op.drop_column('boq_items', 'item_code')
    op.drop_column('boq_items', 'uid')
    op.drop_column('boq_items', 'version_id')

    op.drop_index('ix_boq_item_changes_status', table_name='boq_item_changes')
    op.drop_index('ix_boq_item_changes_item_id', table_name='boq_item_changes')
    op.drop_table('boq_item_changes')

    op.drop_index('ix_boq_versions_project_id', table_name='boq_versions')
    op.drop_table('boq_versions')
