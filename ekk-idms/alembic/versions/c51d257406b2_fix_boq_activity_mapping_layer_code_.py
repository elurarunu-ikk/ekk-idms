"""fix_boq_activity_mapping_layer_code_nullable

Revision ID: c51d257406b2
Revises: a420892072db
Create Date: 2026-08-11 05:50:23.364944

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c51d257406b2'
down_revision: Union[str, Sequence[str], None] = 'a420892072db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
