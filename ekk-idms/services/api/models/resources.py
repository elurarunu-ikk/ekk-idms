from sqlalchemy import Column, String, Numeric, Boolean, DateTime, Text, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class MaterialMaster(Base):
    __tablename__ = "material_master"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id    = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    material_code = Column(String(50), nullable=False)
    material_name = Column(String(200), nullable=False)
    unit          = Column(String(20), nullable=False)
    rate_per_unit = Column(Numeric(12, 2), nullable=True)
    supplier_name = Column(String(200), nullable=True)
    is_active     = Column(Boolean, nullable=False, server_default=text("true"))
    created_at    = Column(DateTime, server_default=text("NOW()"))


class MachineMaster(Base):
    __tablename__ = "machine_master"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id   = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    machine_code = Column(String(50), nullable=False)
    machine_name = Column(String(200), nullable=False)
    machine_type = Column(String(100), nullable=True)
    rate_per_hour = Column(Numeric(10, 2), nullable=True)
    is_active    = Column(Boolean, nullable=False, server_default=text("true"))
    created_at   = Column(DateTime, server_default=text("NOW()"))


class ManpowerCategory(Base):
    __tablename__ = "manpower_categories"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_code = Column(String(50), nullable=False, unique=True)
    category_name = Column(String(200), nullable=False)
    subcategory   = Column(String(200), nullable=True)
    rate_per_day  = Column(Numeric(10, 2), nullable=True)
    is_active     = Column(Boolean, nullable=False, server_default=text("true"))
    created_at    = Column(DateTime, server_default=text("NOW()"))
