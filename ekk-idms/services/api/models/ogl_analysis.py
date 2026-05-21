from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, text, Index
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class OGLAnalysis(Base):
    __tablename__ = "ogl_analysis"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(String(100), nullable=False, index=True)
    chainage       = Column(Integer, nullable=False)
    road_side      = Column(String(1), nullable=False)    # L or R
    ogl_rl         = Column(Numeric(10, 4), nullable=True)
    emb_frl        = Column(Numeric(10, 4), nullable=True)
    cut_fill_m     = Column(Numeric(10, 4), nullable=True)
    cut_fill_type  = Column(String(10), nullable=True)    # CUT / FILL / ZERO
    cross_area_sqm = Column(Numeric(12, 4), nullable=True)
    volume_cum     = Column(Numeric(12, 4), nullable=True)
    version        = Column(Integer, nullable=False, server_default=text("1"))
    is_active      = Column(Boolean, nullable=False, server_default=text("true"))
    computed_at    = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_ogla_project_chainage_side", "project_id", "chainage", "road_side"),
    )
