"""add entry_media table

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# ── Required by alembic ───────────────────────────────────────────────────────
revision = 'a0b0c0d0e0f0'
down_revision = None        # set to your last revision ID if you have prior migrations
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'entry_media',
        sa.Column('id',         UUID(as_uuid=True), primary_key=True),
        sa.Column('entry_id',   UUID(as_uuid=True),
                  sa.ForeignKey('site_data_transactions.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('media_type', sa.String(10),  nullable=False),
        sa.Column('url',        sa.String(500), nullable=False),
        sa.Column('filename',   sa.String(200), nullable=False),
        sa.Column('size_mb',    sa.Float,       nullable=False),
        sa.Column('created_at', sa.DateTime,    server_default=sa.func.now()),
    )
    op.create_index('ix_entry_media_entry_id', 'entry_media', ['entry_id'])


def downgrade() -> None:
    op.drop_index('ix_entry_media_entry_id', table_name='entry_media')
    op.drop_table('entry_media')