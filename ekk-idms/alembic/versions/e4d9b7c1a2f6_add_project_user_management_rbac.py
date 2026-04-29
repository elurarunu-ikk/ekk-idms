"""add project user management rbac

Revision ID: e4d9b7c1a2f6
Revises: c3b7a1d2e9f4
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "e4d9b7c1a2f6"
down_revision = "c3b7a1d2e9f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_by", sa.String(length=200), nullable=True),
        sa.Column("updated_by", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_code"),
        sa.UniqueConstraint("name"),
    )

    op.add_column("projects", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("projects", sa.Column("site_type", sa.String(length=50), nullable=True))
    op.add_column("projects", sa.Column("department_type", sa.String(length=20), nullable=True))
    op.add_column("projects", sa.Column("address_line_1", sa.String(length=300), nullable=True))
    op.add_column("projects", sa.Column("address_line_2", sa.String(length=300), nullable=True))
    op.add_column("projects", sa.Column("city", sa.String(length=120), nullable=True))
    op.add_column("projects", sa.Column("pincode", sa.String(length=20), nullable=True))
    op.add_column("projects", sa.Column("state", sa.String(length=120), nullable=True))
    op.add_column("projects", sa.Column("country", sa.String(length=120), nullable=True))
    op.add_column("projects", sa.Column("primary_contact_name", sa.String(length=200), nullable=True))
    op.add_column("projects", sa.Column("primary_contact_phone", sa.String(length=20), nullable=True))
    op.add_column("projects", sa.Column("primary_contact_email", sa.String(length=200), nullable=True))
    op.add_column("projects", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("projects", sa.Column("created_by", sa.String(length=200), nullable=True))
    op.add_column("projects", sa.Column("updated_by", sa.String(length=200), nullable=True))
    op.add_column("projects", sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.text("NOW()")))
    op.create_foreign_key("fk_projects_company_id", "projects", "companies", ["company_id"], ["id"])

    op.add_column("users", sa.Column("emp_code", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("username", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("contact_no", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("user_type", sa.String(length=50), nullable=False, server_default=sa.text("'USER'")))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("users", sa.Column("force_password_change", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("created_by", sa.String(length=200), nullable=True))
    op.add_column("users", sa.Column("updated_by", sa.String(length=200), nullable=True))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.text("NOW()")))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    op.create_unique_constraint("uq_users_emp_code", "users", ["emp_code"])
    op.create_unique_constraint("uq_users_username", "users", ["username"])

    op.create_table(
        "user_project_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permissions_json", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "project_id", name="uq_user_project_access_user_project"),
    )

    op.execute(
        """
        INSERT INTO companies (id, company_code, name, is_active, created_by, updated_by)
        VALUES ('11111111-1111-1111-1111-111111111111', 'EKKINFRA', 'EKK Infrastructure Ltd', true, 'migration', 'migration')
        ON CONFLICT (company_code) DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE projects
        SET company_id = COALESCE(company_id, '11111111-1111-1111-1111-111111111111'),
            site_type = COALESCE(site_type, CASE WHEN lower(COALESCE(project_type, '')) IN ('highway', 'road') THEN 'Road' ELSE 'Building' END),
            department_type = COALESCE(department_type, CASE WHEN client ILIKE '%gov%' OR client ILIKE '%nhai%' THEN 'Govt' ELSE 'Private' END),
            country = COALESCE(country, 'India'),
            is_active = COALESCE(is_active, true),
            updated_by = COALESCE(updated_by, 'migration')
        """
    )

    op.execute(
        """
        UPDATE users
        SET username = COALESCE(username, lower(email)),
            emp_code = COALESCE(emp_code, CASE WHEN lower(email) = 'admin@ekk.in' THEN 'ADMIN001' ELSE 'EMP-' || substr(replace(id::text, '-', ''), 1, 8) END),
            user_type = COALESCE(NULLIF(user_type, ''), CASE WHEN lower(email) = 'admin@ekk.in' THEN 'SUPER ADMIN' ELSE COALESCE(role, 'USER') END),
            is_active = COALESCE(is_active, true),
            force_password_change = CASE WHEN lower(email) = 'admin@ekk.in' THEN false ELSE COALESCE(force_password_change, true) END,
            created_by = COALESCE(created_by, 'migration'),
            updated_by = COALESCE(updated_by, 'migration')
        """
    )


def downgrade() -> None:
    op.drop_table("user_project_access")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_constraint("uq_users_emp_code", "users", type_="unique")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "updated_by")
    op.drop_column("users", "created_by")
    op.drop_column("users", "force_password_change")
    op.drop_column("users", "is_active")
    op.drop_column("users", "user_type")
    op.drop_column("users", "contact_no")
    op.drop_column("users", "username")
    op.drop_column("users", "emp_code")

    op.drop_constraint("fk_projects_company_id", "projects", type_="foreignkey")
    op.drop_column("projects", "updated_at")
    op.drop_column("projects", "updated_by")
    op.drop_column("projects", "created_by")
    op.drop_column("projects", "is_active")
    op.drop_column("projects", "primary_contact_email")
    op.drop_column("projects", "primary_contact_phone")
    op.drop_column("projects", "primary_contact_name")
    op.drop_column("projects", "country")
    op.drop_column("projects", "state")
    op.drop_column("projects", "pincode")
    op.drop_column("projects", "city")
    op.drop_column("projects", "address_line_2")
    op.drop_column("projects", "address_line_1")
    op.drop_column("projects", "department_type")
    op.drop_column("projects", "site_type")
    op.drop_column("projects", "company_id")

    op.drop_table("companies")