"""upgrade_boq_activity_mapping_work_type_structure

Revision ID: f2e3d4c5b6a7
Revises: da4cd2d73c00
Create Date: 2026-06-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f2e3d4c5b6a7'
down_revision: Union[str, Sequence[str], None] = 'da4cd2d73c00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('boq_activity_mapping',
        sa.Column('work_type', sa.String(50), nullable=True))
    op.add_column('boq_activity_mapping',
        sa.Column('structure_type', sa.String(100), nullable=True))
    op.add_column('boq_activity_mapping',
        sa.Column('element_code', sa.String(50), nullable=True))

    op.execute(
        "UPDATE boq_activity_mapping SET work_type = 'ROAD' "
        "WHERE project_id = 'VSRP' AND work_type IS NULL"
    )

    op.drop_constraint('uq_boq_activity_map', 'boq_activity_mapping', type_='unique')
    op.create_unique_constraint(
        'uq_boq_activity_map_v2',
        'boq_activity_mapping',
        ['project_id', 'work_type', 'layer_code',
         'structure_type', 'element_code', 'activity_code'],
    )

    op.create_index('ix_boq_map_project_work_type',
        'boq_activity_mapping', ['project_id', 'work_type'])
    op.create_index('ix_boq_map_structure',
        'boq_activity_mapping',
        ['project_id', 'structure_type', 'element_code'])


def downgrade() -> None:
    op.drop_index('ix_boq_map_structure', table_name='boq_activity_mapping')
    op.drop_index('ix_boq_map_project_work_type', table_name='boq_activity_mapping')

    op.drop_constraint('uq_boq_activity_map_v2', 'boq_activity_mapping', type_='unique')
    op.create_unique_constraint(
        'uq_boq_activity_map',
        'boq_activity_mapping',
        ['project_id', 'layer_code', 'activity_code'],
    )

    op.drop_column('boq_activity_mapping', 'element_code')
    op.drop_column('boq_activity_mapping', 'structure_type')
    op.drop_column('boq_activity_mapping', 'work_type')
