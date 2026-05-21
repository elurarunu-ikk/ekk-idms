from sqlalchemy import Boolean, Column, DateTime, Date, Integer, Numeric, String, text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base
import uuid


class LevelRegister(Base):
    __tablename__ = "level_register"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id     = Column(String(100), nullable=False, index=True)
    layer_code     = Column(String(10), nullable=False)   # EMB/SG/GSB/CTB/WMM/DBM/BC
    layer_desc     = Column(String(200), nullable=True)
    thickness_mm   = Column(Integer, nullable=True)
    chainage       = Column(Integer, nullable=False, index=True)
    road_side      = Column(String(1), nullable=False)    # L or R
    frl_center     = Column(Numeric(10, 4), nullable=True)
    camber_pct     = Column(Numeric(8, 4), nullable=True)
    camber_type    = Column(String(20), nullable=True)    # SE % or CAMBER %
    road_width_m   = Column(Numeric(8, 4), nullable=True)
    offset_widths  = Column(JSONB, nullable=True)         # [2.0, 6.0, 9.5, ...]
    rl_values      = Column(JSONB, nullable=True)         # {"2.0": 46.335, ...}
    rl_at_0m       = Column(Numeric(10, 4), nullable=True)
    rl_at_2m       = Column(Numeric(10, 4), nullable=True)
    rl_at_6m       = Column(Numeric(10, 4), nullable=True)
    rl_at_9_5m     = Column(Numeric(10, 4), nullable=True)
    rl_at_11m      = Column(Numeric(10, 4), nullable=True)
    rl_at_edge     = Column(Numeric(10, 4), nullable=True)
    tcs_ref        = Column(String(200), nullable=True)
    version        = Column(Integer, nullable=False, server_default=text("1"))
    is_active      = Column(Boolean, nullable=False, server_default=text("true"))
    effective_from = Column(Date, nullable=True)
    uploaded_by    = Column(String(200), nullable=True)
    uploaded_at    = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_lr_project_layer_chainage_side",
              "project_id", "layer_code", "chainage", "road_side"),
    )
