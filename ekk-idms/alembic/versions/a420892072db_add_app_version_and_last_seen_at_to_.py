"""add app_version and last_seen_at to registered_devices

Revision ID: a420892072db
Revises: f411c48f8af3
Create Date: 2026-07-15 05:06:49.000023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a420892072db'
down_revision: Union[str, Sequence[str], None] = 'f411c48f8af3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('registered_devices',
        sa.Column('app_version', sa.String(20), nullable=True))
    op.add_column('registered_devices',
        sa.Column('last_seen_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('registered_devices', 'last_seen_at')
    op.drop_column('registered_devices', 'app_version')
