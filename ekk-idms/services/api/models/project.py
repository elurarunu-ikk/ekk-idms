from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid

class Project(Base):
    __tablename__ = "projects"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_code  = Column(String(50), unique=True, nullable=False)
    name          = Column(String(500), nullable=False)
    company_id    = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    client        = Column(String(300))
    project_type  = Column(String(50))          # highway / building / factory
    site_type     = Column(String(50))
    department_type = Column(String(20))
    location      = Column(String(300))
    address_line_1 = Column(String(300))
    address_line_2 = Column(String(300))
    city          = Column(String(120))
    pincode       = Column(String(20))
    state         = Column(String(120))
    country       = Column(String(120))
    primary_contact_name = Column(String(200))
    primary_contact_phone = Column(String(20))
    primary_contact_email = Column(String(200))
    start_date    = Column(Date)
    end_date      = Column(Date)
    contract_value = Column(Numeric(18, 2))
    is_active     = Column(Boolean, default=True, nullable=False)
    created_by    = Column(String(200))
    updated_by    = Column(String(200))
    created_at    = Column(DateTime, server_default=text("NOW()"))
    updated_at    = Column(DateTime, server_default=text("NOW()"), onupdate=text("NOW()"))
