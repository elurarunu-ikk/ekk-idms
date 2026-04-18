"""add capture fields to site data transactions

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-04-17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b7c8d9e0f1a2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("site_data_transactions", sa.Column("entry_date", sa.Date(), nullable=True))
    op.add_column("site_data_transactions", sa.Column("remarks", sa.Text(), nullable=True))
    op.add_column(
        "site_data_transactions",
        sa.Column("gps_start_lat", sa.Numeric(precision=10, scale=7), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("gps_start_lng", sa.Numeric(precision=10, scale=7), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("gps_end_lat", sa.Numeric(precision=10, scale=7), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("gps_end_lng", sa.Numeric(precision=10, scale=7), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("gps_accuracy_m", sa.Numeric(precision=8, scale=2), nullable=True),
    )
    op.add_column("site_data_transactions", sa.Column("voice_url", sa.String(length=500), nullable=True))
    op.add_column("site_data_transactions", sa.Column("weather_code", sa.String(length=20), nullable=True))
    op.add_column(
        "site_data_transactions",
        sa.Column("temp_celsius", sa.Numeric(precision=4, scale=1), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("drone_flight_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "site_data_transactions",
        sa.Column("lidar_scan_id", postgresql.UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("site_data_transactions", "lidar_scan_id")
    op.drop_column("site_data_transactions", "drone_flight_id")
    op.drop_column("site_data_transactions", "temp_celsius")
    op.drop_column("site_data_transactions", "weather_code")
    op.drop_column("site_data_transactions", "voice_url")
    op.drop_column("site_data_transactions", "gps_accuracy_m")
    op.drop_column("site_data_transactions", "gps_end_lng")
    op.drop_column("site_data_transactions", "gps_end_lat")
    op.drop_column("site_data_transactions", "gps_start_lng")
    op.drop_column("site_data_transactions", "gps_start_lat")
    op.drop_column("site_data_transactions", "remarks")
    op.drop_column("site_data_transactions", "entry_date")