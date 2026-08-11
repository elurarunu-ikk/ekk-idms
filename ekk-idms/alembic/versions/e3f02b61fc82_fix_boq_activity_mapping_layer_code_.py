"""fix_boq_activity_mapping_layer_code_nullable

Revision ID: e3f02b61fc82
Revises: c51d257406b2
Create Date: 2026-08-11 05:51:51.230058

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e3f02b61fc82'
down_revision: Union[str, Sequence[str], None] = 'a420892072db'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('boq_activity_mapping', 'layer_code',
                    existing_type=sa.String(length=50),
                    nullable=True)


def downgrade() -> None:
    op.alter_column('boq_activity_mapping', 'layer_code',
                    existing_type=sa.String(length=50),
                    nullable=False)
