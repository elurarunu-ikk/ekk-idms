import sys, os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Path fix — lets alembic find your FastAPI modules ────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'api'))

from database import Base
from models.site_data import SiteDataTransaction
from models.media import EntryMedia
from models.plan_data import PlanData

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Prefer runtime DATABASE_URL (used by Docker services) over static alembic.ini URL.
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata

# ── Run migrations ────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()