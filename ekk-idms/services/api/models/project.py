from sqlalchemy import Column, String, Date, Numeric, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid

class Project(Base):
    __tablename__ = "projects"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code  = Column(String(50), unique=True, nullable=False)
    name          = Column(String(500), nullable=False)
    client        = Column(String(300))
    project_type  = Column(String(50))          # highway / building / factory
    location      = Column(String(300))
    start_date    = Column(Date)
    end_date      = Column(Date)
    contract_value = Column(Numeric(18, 2))
    created_at    = Column(DateTime, server_default=text("NOW()"))
