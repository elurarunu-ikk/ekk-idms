"""add 3M resource tracking — materials, machines, manpower

Revision ID: f8a3b2c1d4e5
Revises: 3572942ac3c9
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "f8a3b2c1d4e5"
down_revision = "b1c4e7f9a2d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 3M columns on site_data_transactions ─────────────────────────────────
    op.add_column(
        "site_data_transactions",
        sa.Column("materials_used", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("material_test_refs", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("machines_deployed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("machine_log_refs", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("manpower_deployed", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("attendance_sheet_ref", sa.Text(), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("voice_transcript", sa.Text(), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("voice_confidence_score", sa.Numeric(precision=4, scale=3), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("voice_audio_url", sa.String(500), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("thickness_mm", sa.Numeric(precision=10, scale=3), nullable=True),
    )

    # GIN indexes on JSONB columns for fast containment queries
    op.create_index(
        "idx_sdt_materials_used_gin",
        "site_data_transactions",
        ["materials_used"],
        postgresql_using="gin",
    )
    op.create_index(
        "idx_sdt_machines_deployed_gin",
        "site_data_transactions",
        ["machines_deployed"],
        postgresql_using="gin",
    )
    op.create_index(
        "idx_sdt_manpower_deployed_gin",
        "site_data_transactions",
        ["manpower_deployed"],
        postgresql_using="gin",
    )

    # ── material_master ───────────────────────────────────────────────────────
    op.create_table(
        "material_master",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("material_code", sa.String(50), nullable=False),
        sa.Column("material_name", sa.String(200), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("rate_per_unit", sa.Numeric(12, 2), nullable=True),
        sa.Column("supplier_name", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_material_master_project"),
        sa.UniqueConstraint("project_id", "material_code", name="uq_material_master_project_code"),
    )
    op.create_index("idx_material_master_project", "material_master", ["project_id"])

    # ── machine_master ────────────────────────────────────────────────────────
    op.create_table(
        "machine_master",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("machine_code", sa.String(50), nullable=False),
        sa.Column("machine_name", sa.String(200), nullable=False),
        sa.Column("machine_type", sa.String(100), nullable=True),
        sa.Column("rate_per_hour", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name="fk_machine_master_project"),
        sa.UniqueConstraint("project_id", "machine_code", name="uq_machine_master_project_code"),
    )
    op.create_index("idx_machine_master_project", "machine_master", ["project_id"])

    # ── manpower_categories ───────────────────────────────────────────────────
    op.create_table(
        "manpower_categories",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("category_code", sa.String(50), nullable=False, unique=True),
        sa.Column("category_name", sa.String(200), nullable=False),
        sa.Column("subcategory", sa.String(200), nullable=True),
        sa.Column("rate_per_day", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()")),
    )

    # Seed standard manpower categories
    op.execute("""
        INSERT INTO manpower_categories (id, category_code, category_name, subcategory, rate_per_day)
        VALUES
            (uuid_generate_v4(), 'SKILLED',     'Skilled Worker',     NULL,      700.00),
            (uuid_generate_v4(), 'SEMISKILLED', 'Semi-Skilled Worker', NULL,     600.00),
            (uuid_generate_v4(), 'UNSKILLED',   'Unskilled Worker',   NULL,      500.00),
            (uuid_generate_v4(), 'MASON',       'Mason',              'Skilled', 750.00),
            (uuid_generate_v4(), 'CARPENTER',   'Carpenter',          'Skilled', 750.00),
            (uuid_generate_v4(), 'ELECTRICIAN', 'Electrician',        'Skilled', 800.00),
            (uuid_generate_v4(), 'WELDER',      'Welder',             'Skilled', 800.00),
            (uuid_generate_v4(), 'HELPER',      'Helper',             NULL,      500.00),
            (uuid_generate_v4(), 'OPERATOR',    'Equipment Operator', 'Skilled', 850.00),
            (uuid_generate_v4(), 'SUPERVISOR',  'Supervisor',         NULL,      1200.00),
            (uuid_generate_v4(), 'ENGINEER',    'Site Engineer',      NULL,      1800.00)
        ON CONFLICT (category_code) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table("manpower_categories")
    op.drop_index("idx_machine_master_project", table_name="machine_master")
    op.drop_table("machine_master")
    op.drop_index("idx_material_master_project", table_name="material_master")
    op.drop_table("material_master")

    op.drop_index("idx_sdt_manpower_deployed_gin", table_name="site_data_transactions")
    op.drop_index("idx_sdt_machines_deployed_gin", table_name="site_data_transactions")
    op.drop_index("idx_sdt_materials_used_gin", table_name="site_data_transactions")

    for col in [
        "thickness_mm", "voice_audio_url", "voice_confidence_score",
        "voice_transcript", "attendance_sheet_ref", "manpower_deployed",
        "machine_log_refs", "machines_deployed", "material_test_refs", "materials_used",
    ]:
        op.drop_column("site_data_transactions", col)
