"""add session device management

Revision ID: b2c3d4e5f6a7
Revises: a66d2bfcb1f4
Create Date: 2026-06-12

Creates user_sessions and registered_devices tables for single-session
per platform enforcement and device binding.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c3d4e5f6a7'
down_revision = 'a66d2bfcb1f4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_sessions',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',      postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('platform',     sa.String(20),  nullable=False),
        sa.Column('jti',          sa.String(64),  nullable=False),
        sa.Column('device_id',    sa.String(200), nullable=True),
        sa.Column('device_label', sa.String(200), nullable=True),
        sa.Column('issued_at',    sa.DateTime(),  server_default=sa.text('NOW()')),
        sa.Column('last_seen_at', sa.DateTime(),  server_default=sa.text('NOW()')),
        sa.Column('expires_at',   sa.DateTime(),  nullable=True),
    )
    op.create_unique_constraint('uq_user_sessions_jti',           'user_sessions', ['jti'])
    op.create_unique_constraint('uq_user_sessions_user_platform', 'user_sessions', ['user_id', 'platform'])
    op.create_index('ix_user_sessions_jti', 'user_sessions', ['jti'])

    op.create_table(
        'registered_devices',
        sa.Column('id',            postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',       postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('device_id',     sa.String(200), nullable=False),
        sa.Column('device_label',  sa.String(200), nullable=True),
        sa.Column('registered_at', sa.DateTime(),  server_default=sa.text('NOW()')),
        sa.Column('is_active',     sa.Boolean(),   server_default=sa.text('true')),
    )
    op.create_unique_constraint('uq_registered_devices_user_id', 'registered_devices', ['user_id'])


def downgrade():
    op.drop_table('registered_devices')
    op.drop_index('ix_user_sessions_jti', table_name='user_sessions')
    op.drop_table('user_sessions')
