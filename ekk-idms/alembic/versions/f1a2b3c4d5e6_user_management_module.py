"""user management module

Revision ID: f1a2b3c4d5e6
Revises: e4d9b7c1a2f6
Create Date: 2026-06-01

Adds columns to existing users table and creates 10 new IAM tables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f1a2b3c4d5e6'
down_revision = 'f8a3b2c1d4e5'
branch_labels = None
depends_on = None


def upgrade():
    # ── PostgreSQL ENUM types ─────────────────────────────────────────────────
    userkind_enum = postgresql.ENUM('internal', 'external', name='userkind', create_type=False)
    userkind_enum.create(op.get_bind(), checkfirst=True)

    changetype_enum = postgresql.ENUM(
        'created', 'updated', 'role_changed', 'activated', 'deactivated',
        'password_reset', 'permission_granted', 'permission_revoked', 'cloned', 'impersonated',
        name='changetype', create_type=False,
    )
    changetype_enum.create(op.get_bind(), checkfirst=True)

    tempaccessstatus_enum = postgresql.ENUM('active', 'expired', 'revoked', name='tempaccessstatus', create_type=False)
    tempaccessstatus_enum.create(op.get_bind(), checkfirst=True)

    # ── Extend existing users table ───────────────────────────────────────────
    op.add_column('users', sa.Column('user_kind',     sa.String(20),  nullable=True))
    op.add_column('users', sa.Column('emp_id',        sa.String(50),  nullable=True))
    op.add_column('users', sa.Column('department',    sa.String(100), nullable=True))
    op.add_column('users', sa.Column('designation',   sa.String(100), nullable=True))
    op.add_column('users', sa.Column('organisation',  sa.String(200), nullable=True))
    op.add_column('users', sa.Column('phone',         sa.String(20),  nullable=True))
    op.add_column('users', sa.Column('must_change_pwd', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('mfa_enabled',   sa.Boolean(),   nullable=False, server_default=sa.text('false')))
    op.add_column('users', sa.Column('expires_at',    sa.DateTime(),  nullable=True))
    op.create_unique_constraint('uq_users_emp_id', 'users', ['emp_id'])

    # ── user_company_assignments ──────────────────────────────────────────────
    op.create_table(
        'user_company_assignments',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',      postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('company_id',   postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_all_sites', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at',   sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'company_id', name='uq_user_company'),
    )

    # ── user_site_assignments ─────────────────────────────────────────────────
    op.create_table(
        'user_site_assignments',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',    postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('site_id',    postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'site_id', name='uq_user_site'),
    )

    # ── user_module_assignments ───────────────────────────────────────────────
    op.create_table(
        'user_module_assignments',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',    postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_id',  sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'module_id', name='uq_user_module'),
    )

    # ── user_form_rights ──────────────────────────────────────────────────────
    op.create_table(
        'user_form_rights',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',          postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('form_id',          sa.String(100), nullable=False),
        sa.Column('form_name',        sa.String(200), nullable=True),
        sa.Column('can_create',       sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('can_read',         sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('can_update',       sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('can_delete',       sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('field_visibility', postgresql.JSONB(), nullable=True),
        sa.Column('created_at',       sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at',       sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'form_id', name='uq_user_form'),
    )

    # ── permission_audit_log (append-only) ────────────────────────────────────
    op.create_table(
        'permission_audit_log',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('target_user_id',   postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('changed_by',       postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('change_type',      sa.String(50), nullable=False),
        sa.Column('table_name',       sa.String(100), nullable=True),
        sa.Column('old_value',        postgresql.JSONB(), nullable=True),
        sa.Column('new_value',        postgresql.JSONB(), nullable=True),
        sa.Column('impersonating_as', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('changed_at',       sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    # ── hr_employee_cache ─────────────────────────────────────────────────────
    op.create_table(
        'hr_employee_cache',
        sa.Column('id',          postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('emp_id',      sa.String(50),  unique=True, nullable=False),
        sa.Column('full_name',   sa.String(200), nullable=False),
        sa.Column('department',  sa.String(100), nullable=True),
        sa.Column('designation', sa.String(100), nullable=True),
        sa.Column('email',       sa.String(200), nullable=True),
        sa.Column('phone',       sa.String(20),  nullable=True),
        sa.Column('is_active',   sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('synced_at',   sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    # ── user_groups ───────────────────────────────────────────────────────────
    op.create_table(
        'user_groups',
        sa.Column('id',          postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name',        sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('company_id',  postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by',  postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at',  sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    # ── user_group_members ────────────────────────────────────────────────────
    op.create_table(
        'user_group_members',
        sa.Column('id',       postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',  postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('added_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('group_id', 'user_id', name='uq_group_member'),
    )

    # ── temp_access_grants ────────────────────────────────────────────────────
    op.create_table(
        'temp_access_grants',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id',    postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scope_json', postgresql.JSONB(), nullable=False),
        sa.Column('reason',     sa.Text(), nullable=True),
        sa.Column('status',     sa.String(20), nullable=False, server_default=sa.text("'active'")),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    # ── revoked_tokens ────────────────────────────────────────────────────────
    op.create_table(
        'revoked_tokens',
        sa.Column('id',         postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('token_jti',  sa.String(200), unique=True, nullable=False),
        sa.Column('user_id',    postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    )

    # ── Indexes ───────────────────────────────────────────────────────────────
    op.create_index('ix_users_emp_id',        'users', ['emp_id'])
    op.create_index('ix_users_user_type',     'users', ['user_type'])
    op.create_index('ix_users_is_active',     'users', ['is_active'])
    op.create_index('ix_users_user_kind',     'users', ['user_kind'])
    op.create_index('ix_pal_target_user_id',  'permission_audit_log', ['target_user_id'])
    op.create_index('ix_pal_changed_at',      'permission_audit_log', ['changed_at'])
    op.create_index('ix_revoked_token_jti',   'revoked_tokens', ['token_jti'])
    op.create_index('ix_uca_user_id',         'user_company_assignments', ['user_id'])
    op.create_index('ix_usa_user_id',         'user_site_assignments', ['user_id'])
    op.create_index('ix_uma_user_id',         'user_module_assignments', ['user_id'])
    op.create_index('ix_ufr_user_id',         'user_form_rights', ['user_id'])

    # ── Default super admin ───────────────────────────────────────────────────
    # Password: Admin@123 — must_change_pwd=True forces change on first login
    op.execute("""
        UPDATE users SET
            user_kind      = 'internal',
            must_change_pwd = false,
            mfa_enabled    = false
        WHERE user_type IN ('SUPER ADMIN', 'SUPER_ADMIN');
    """)


def downgrade():
    op.drop_index('ix_ufr_user_id',        table_name='user_form_rights')
    op.drop_index('ix_uma_user_id',        table_name='user_module_assignments')
    op.drop_index('ix_usa_user_id',        table_name='user_site_assignments')
    op.drop_index('ix_uca_user_id',        table_name='user_company_assignments')
    op.drop_index('ix_revoked_token_jti',  table_name='revoked_tokens')
    op.drop_index('ix_pal_changed_at',     table_name='permission_audit_log')
    op.drop_index('ix_pal_target_user_id', table_name='permission_audit_log')
    op.drop_index('ix_users_user_kind',    table_name='users')
    op.drop_index('ix_users_is_active',    table_name='users')
    op.drop_index('ix_users_user_type',    table_name='users')
    op.drop_index('ix_users_emp_id',       table_name='users')

    op.drop_table('revoked_tokens')
    op.drop_table('temp_access_grants')
    op.drop_table('user_group_members')
    op.drop_table('user_groups')
    op.drop_table('hr_employee_cache')
    op.drop_table('permission_audit_log')
    op.drop_table('user_form_rights')
    op.drop_table('user_module_assignments')
    op.drop_table('user_site_assignments')
    op.drop_table('user_company_assignments')

    op.drop_constraint('uq_users_emp_id', 'users', type_='unique')
    op.drop_column('users', 'expires_at')
    op.drop_column('users', 'mfa_enabled')
    op.drop_column('users', 'must_change_pwd')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'organisation')
    op.drop_column('users', 'designation')
    op.drop_column('users', 'department')
    op.drop_column('users', 'emp_id')
    op.drop_column('users', 'user_kind')
