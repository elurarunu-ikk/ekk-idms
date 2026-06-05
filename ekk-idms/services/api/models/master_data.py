"""
Master data models — database-driven replacements for hardcoded constants.
These tables are the single source of truth for:
  - Work types (ROAD, STRUCTURE, DRAIN, ANCILLARY, MISC)
  - Layers (EMBANKMENT, SUBGRADE, GSB ... MEDIAN)
  - Activities (EARTHWORK, WMM_LAY, BC, RCC ...)
  - Elements (FOUNDATION, PIER, DECK ...)
  - Structure types (CULVERT, MINOR_BRIDGE, MAJOR_BRIDGE, FLYOVER)
  - Activity ↔ Work Type mapping (junction)
  - Activity ↔ Layer mapping (junction — replaces ROAD_ACTIVITY_LAYER_MAP)
  - Structure Type ↔ Element ↔ Activity mapping (junction)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class MasterWorkType(Base):
    __tablename__ = "master_work_types"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code        = Column(String(50), unique=True, nullable=False)   # ROAD, STRUCTURE
    label       = Column(String(100), nullable=False)               # Road, Structure
    sort_order  = Column(Integer, default=0, nullable=False)
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterLayer(Base):
    __tablename__ = "master_layers"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code           = Column(String(50), unique=True, nullable=False)  # WEARING, BINDER, GSB
    label          = Column(String(100), nullable=False)              # Wearing Course (BC)
    work_type_code = Column(String(50), ForeignKey("master_work_types.code"), nullable=True)
    # Layers are currently ROAD-only, but nullable allows future expansion
    sort_order     = Column(Integer, default=0, nullable=False)
    is_active      = Column(Boolean, default=True, nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterActivity(Base):
    __tablename__ = "master_activities"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code         = Column(String(50), unique=True, nullable=False)  # WMM_LAY, BC, RCC
    label        = Column(String(150), nullable=False)              # WMM Laying, BC
    default_unit = Column(String(20), nullable=True)                # CUM, TON, LM, KG
    sort_order   = Column(Integer, default=0, nullable=False)
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterActivityWorkType(Base):
    """Junction: which work types each activity belongs to (many-to-many)."""
    __tablename__ = "master_activity_work_types"
    __table_args__ = (
        UniqueConstraint("activity_code", "work_type_code", name="uq_activity_work_type"),
    )

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_code  = Column(String(50), ForeignKey("master_activities.code"), nullable=False)
    work_type_code = Column(String(50), ForeignKey("master_work_types.code"), nullable=False)


class MasterActivityLayer(Base):
    """Junction: which layers each road activity is valid for (replaces ROAD_ACTIVITY_LAYER_MAP)."""
    __tablename__ = "master_activity_layers"
    __table_args__ = (
        UniqueConstraint("activity_code", "layer_code", name="uq_activity_layer"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_code = Column(String(50), ForeignKey("master_activities.code"), nullable=False)
    layer_code    = Column(String(50), ForeignKey("master_layers.code"), nullable=False)


class MasterElement(Base):
    __tablename__ = "master_elements"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code       = Column(String(50), unique=True, nullable=False)  # FOUNDATION, PIER, DECK
    label      = Column(String(100), nullable=False)              # Foundation, Pier
    sort_order = Column(Integer, default=0, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterStructureType(Base):
    __tablename__ = "master_structure_types"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code       = Column(String(50), unique=True, nullable=False)  # CULVERT, MINOR_BRIDGE
    label      = Column(String(100), nullable=False)              # Culvert, Minor Bridge
    sort_order = Column(Integer, default=0, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterStructureElementActivity(Base):
    """
    Junction: valid activities per structure type + element combination.
    Replaces the hardcoded STRUCTURE_ELEMENT_ACTIVITY_MAP.
    Example: CULVERT + FOUNDATION → [EXCAVATION, PCC]
    """
    __tablename__ = "master_structure_element_activities"
    __table_args__ = (
        UniqueConstraint(
            "structure_type_code", "element_code", "activity_code",
            name="uq_structure_element_activity"
        ),
    )

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    structure_type_code = Column(String(50), ForeignKey("master_structure_types.code"), nullable=False)
    element_code        = Column(String(50), ForeignKey("master_elements.code"), nullable=False)
    activity_code       = Column(String(50), ForeignKey("master_activities.code"), nullable=False)
    sort_order          = Column(Integer, default=0, nullable=False)


class MasterMaterial(Base):
    __tablename__ = "master_materials"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code         = Column(String(50), unique=True, nullable=False)  # CEMENT, BITUMEN
    label        = Column(String(100), nullable=False)              # Cement, Bitumen
    default_unit = Column(String(20), nullable=True)                # CUM, KG, LTR
    category     = Column(String(50), nullable=True)                # BINDER, AGGREGATE, etc
    sort_order   = Column(Integer, default=0, nullable=False)
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterEquipment(Base):
    __tablename__ = "master_equipment"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code       = Column(String(50), unique=True, nullable=False)  # ROLLER, PAVER
    label      = Column(String(100), nullable=False)              # Roller, Paver
    category   = Column(String(50), nullable=True)                # COMPACTION, EARTHWORK
    sort_order = Column(Integer, default=0, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MasterManpowerCategory(Base):
    __tablename__ = "master_manpower_categories"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code       = Column(String(50), unique=True, nullable=False)  # SKILLED, MASON
    label      = Column(String(100), nullable=False)              # Skilled, Mason
    sort_order = Column(Integer, default=0, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
