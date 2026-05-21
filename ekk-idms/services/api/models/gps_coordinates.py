from sqlalchemy import Column, DateTime, Integer, Numeric, String, text, Index
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class GPSCoordinates(Base):
    __tablename__ = "gps_coordinates"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(String(100), nullable=False, index=True)
    chainage_from  = Column(Integer, nullable=False)
    chainage_to    = Column(Integer, nullable=False)
    nh_number      = Column(String(50), nullable=True)
    state          = Column(String(100), nullable=True)
    district       = Column(String(100), nullable=True)
    ro             = Column(String(100), nullable=True)
    piu            = Column(String(100), nullable=True)
    lat_start      = Column(Numeric(12, 8), nullable=True)
    lon_start      = Column(Numeric(12, 8), nullable=True)
    alt_start_m    = Column(Numeric(10, 3), nullable=True)
    lat_end        = Column(Numeric(12, 8), nullable=True)
    lon_end        = Column(Numeric(12, 8), nullable=True)
    alt_end_m      = Column(Numeric(10, 3), nullable=True)
    uploaded_at    = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_gps_project_chainage_from", "project_id", "chainage_from"),
    )
