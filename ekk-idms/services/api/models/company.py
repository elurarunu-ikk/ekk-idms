from sqlalchemy import Boolean, Column, DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_code = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(String(200))
    updated_by = Column(String(200))
    created_at = Column(DateTime, server_default=text("NOW()"))
    updated_at = Column(DateTime, server_default=text("NOW()"), onupdate=text("NOW()"))