from sqlalchemy import Column, String, Float, Boolean, DateTime, Date, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid
from datetime import datetime


class PlanData(Base):
    __tablename__ = "plan_data"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id      = Column(UUID(as_uuid=True), nullable=False)
    activity_code   = Column(String(50), nullable=False)
    chainage_from   = Column(Float, nullable=False)
    chainage_to     = Column(Float, nullable=False)
    stage           = Column(String(100), nullable=False)
    planned_qty_lm  = Column(Float, nullable=False)
    target_start    = Column(Date, nullable=False)
    target_end      = Column(Date, nullable=False)
    contractor_name = Column(String(200), nullable=False)
    road_side       = Column(String(20), nullable=False)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=text("NOW()"))
