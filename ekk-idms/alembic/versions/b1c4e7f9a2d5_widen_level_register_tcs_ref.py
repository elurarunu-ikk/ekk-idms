"""widen level_register tcs_ref to varchar(200)

Revision ID: b1c4e7f9a2d5
Revises: 3572942ac3c9
Create Date: 2026-05-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b1c4e7f9a2d5"
down_revision: Union[str, Sequence[str], None] = "3572942ac3c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "level_register",
        "tcs_ref",
        type_=sa.String(200),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "level_register",
        "tcs_ref",
        type_=sa.String(50),
        existing_nullable=True,
    )
