from sqlalchemy import Boolean, Column, DateTime, Date, Integer, Numeric, String, text, Index
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class ProjectGradientConfig(Base):
    __tablename__ = "project_gradient_config"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id    = Column(String(100), nullable=False, index=True)
    chainage_from = Column(Integer, nullable=False)
    chainage_to   = Column(Integer, nullable=False)
    gradient_pct  = Column(Numeric(8, 4), nullable=True)   # e.g. -0.5 or +0.3
    gradient_type = Column(String(20), nullable=True)       # RISING / FALLING / FLAT
    vpi_chainage  = Column(Integer, nullable=True)          # vertical point of intersection
    curve_length  = Column(Numeric(10, 3), nullable=True)   # vertical curve length (m)
    road_side     = Column(String(10), nullable=False, server_default=text("'BOTH'"))
    notes         = Column(String(500), nullable=True)
    version       = Column(Integer, nullable=False, server_default=text("1"))
    is_active     = Column(Boolean, nullable=False, server_default=text("true"))
    effective_from = Column(Date, nullable=True)
    created_by    = Column(String(200), nullable=True)
    created_at    = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_pgc_project_chainage", "project_id", "chainage_from", "chainage_to"),
    )
