from sqlalchemy import Boolean, Column, DateTime, Date, Integer, Numeric, String, text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base
import uuid


class ProjectLayerConfig(Base):
    __tablename__ = "project_layer_config"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id      = Column(String(100), nullable=False, index=True)
    layer_code      = Column(String(10), nullable=False)   # EMB/SG/GSB/CTB/WMM/DBM/BC
    layer_desc      = Column(String(200), nullable=True)
    road_type       = Column(String(20), nullable=True)    # MCW/SCW/SLR/MIXED
    thickness_mm    = Column(Integer, nullable=True)        # null for EMB/SG (variable)
    camber_type     = Column(String(20), nullable=True)    # "SE %" or "CAMBER %"
    lhs_offsets     = Column(JSONB, nullable=True)          # [14.045, 13.0, 9.5, ...]
    rhs_offsets     = Column(JSONB, nullable=True)          # [0.0, 2.0, 6.0, ...]
    total_width_lhs = Column(Numeric(8, 4), nullable=True)
    total_width_rhs = Column(Numeric(8, 4), nullable=True)
    layer_sequence  = Column(Integer, nullable=True)        # 1=EMB 2=SG ... 7=BC
    chainage_from   = Column(Integer, nullable=True)        # for mid-section width changes
    chainage_to     = Column(Integer, nullable=True)        # null = full project
    version         = Column(Integer, nullable=False, server_default=text("1"))
    is_active       = Column(Boolean, nullable=False, server_default=text("true"))
    effective_from  = Column(Date, nullable=True)
    created_by      = Column(String(200), nullable=True)
    created_at      = Column(DateTime, nullable=False, server_default=text("NOW()"))

    __table_args__ = (
        Index("ix_plc_project_layer_active", "project_id", "layer_code", "is_active"),
    )
