from sqlalchemy import Boolean, Column, DateTime, Date, Integer, Numeric, String, text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base
import uuid


class OGL(Base):
    __tablename__ = "ogl"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(String(100), nullable=False, index=True)
    layer_code     = Column(String(10), nullable=False, server_default=text("'OGL'"))
    chainage       = Column(Integer, nullable=False, index=True)
    road_side      = Column(String(1), nullable=False)    # L or R
    ogl_cl         = Column(Numeric(10, 4), nullable=True)  # Centre line OGL RL
    frl_center     = Column(Numeric(10, 4), nullable=True)
    road_width_m   = Column(Numeric(8, 4), nullable=True)
    offset_widths  = Column(JSONB, nullable=True)
    rl_values      = Column(JSONB, nullable=True)
    rl_at_2m       = Column(Numeric(10, 4), nullable=True)
    rl_at_6m       = Column(Numeric(10, 4), nullable=True)
    rl_at_edge     = Column(Numeric(10, 4), nullable=True)
    version        = Column(Integer, nullable=False, server_default=text("1"))
    is_active      = Column(Boolean, nullable=False, server_default=text("true"))
    uploaded_by    = Column(String(200), nullable=True)
    uploaded_at    = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_ogl_project_chainage_side", "project_id", "chainage", "road_side"),
    )
