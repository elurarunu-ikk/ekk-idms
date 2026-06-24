from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text, UniqueConstraint, text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid


class BoqVersion(Base):
    __tablename__ = "boq_versions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id  = Column(String(100), nullable=False)
    version_no  = Column(Integer, nullable=False, default=0)
    state       = Column(String(20), nullable=False, default="TENDER")
    label       = Column(String(200), nullable=True)
    is_locked   = Column(Boolean, server_default=text("false"))
    created_by  = Column(String(200), nullable=True)
    approved_by = Column(String(200), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    reason      = Column(Text, nullable=True)
    doc_ref     = Column(String(255), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=text("NOW()"))
    updated_at  = Column(DateTime(timezone=True), nullable=True)
    is_deleted  = Column(Boolean, server_default=text("false"))

    items = relationship(
        "BoqItem",
        primaryjoin="BoqVersion.id == BoqItem.version_id",
        foreign_keys="[BoqItem.version_id]",
        back_populates="version",
    )

    __table_args__ = (
        UniqueConstraint("project_id", "version_no", name="uq_boq_version_project_vno"),
        Index("ix_boq_versions_project_id", "project_id"),
    )


class BoqItem(Base):
    __tablename__ = "boq_items"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id       = Column(UUID(as_uuid=True), nullable=False, index=True)
    uid              = Column(Integer, nullable=True)
    item_code        = Column(String(30), nullable=False)
    bill_no          = Column(String(10), nullable=True)
    bill_description = Column(Text, nullable=True)
    description      = Column(Text, nullable=False)
    item_type        = Column(String(20), nullable=False, default="BOQ_ITEM")
    unit             = Column(String(20), nullable=True)
    adjusted_rate    = Column(Numeric(14, 4), nullable=True)
    expected_scope   = Column(Numeric(14, 3), nullable=True)
    revised_scope    = Column(Numeric(14, 3), nullable=True)
    wtg              = Column(Numeric(12, 8), nullable=True)
    is_active        = Column(Boolean, server_default=text("true"))
    is_deleted       = Column(Boolean, server_default=text("false"))
    created_at       = Column(DateTime(timezone=True), server_default=text("NOW()"))

    version = relationship(
        "BoqVersion",
        primaryjoin="BoqItem.version_id == BoqVersion.id",
        foreign_keys="[BoqItem.version_id]",
        back_populates="items",
    )

    changes = relationship(
        "BoqItemChange",
        primaryjoin="BoqItem.id == BoqItemChange.boq_item_id",
        foreign_keys="[BoqItemChange.boq_item_id]",
        back_populates="boq_item",
    )

    __table_args__ = (
        UniqueConstraint("version_id", "item_code", name="uq_boq_item_version_code"),
        Index("ix_boq_items_version_bill", "version_id", "bill_no"),
    )


class BoqItemChange(Base):
    __tablename__ = "boq_item_changes"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    boq_item_id      = Column(UUID(as_uuid=True), nullable=False)
    change_type      = Column(String(20), nullable=False)
    old_qty          = Column(Numeric(14, 3), nullable=True)
    new_qty          = Column(Numeric(14, 3), nullable=True)
    old_rate         = Column(Numeric(14, 4), nullable=True)
    new_rate         = Column(Numeric(14, 4), nullable=True)
    reason_code      = Column(String(50), nullable=True)
    remarks          = Column(Text, nullable=True)
    doc_ref          = Column(String(255), nullable=True)
    submitted_by     = Column(String(200), nullable=True)
    submitted_at     = Column(DateTime(timezone=True), server_default=text("NOW()"))
    approval_status  = Column(String(20), server_default=text("'PENDING'"))
    l1_approved_by   = Column(String(200), nullable=True)
    l1_approved_at   = Column(DateTime(timezone=True), nullable=True)
    approved_by      = Column(String(200), nullable=True)
    approved_at      = Column(DateTime(timezone=True), nullable=True)
    rejected_by      = Column(String(200), nullable=True)
    rejected_at      = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    is_deleted       = Column(Boolean, server_default=text("false"))

    boq_item = relationship(
        "BoqItem",
        primaryjoin="BoqItemChange.boq_item_id == BoqItem.id",
        foreign_keys="[BoqItemChange.boq_item_id]",
        back_populates="changes",
    )

    __table_args__ = (
        Index("ix_boq_item_changes_item_id", "boq_item_id"),
        Index("ix_boq_item_changes_status", "approval_status"),
    )


class BoqActivityMapping(Base):
    __tablename__ = "boq_activity_mapping"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id      = Column(String(100), nullable=False)
    work_type       = Column(String(50), nullable=True)
    layer_code      = Column(String(50), nullable=True)
    structure_type  = Column(String(100), nullable=True)
    element_code    = Column(String(50), nullable=True)
    activity_code   = Column(String(50), nullable=True)
    boq_item_code   = Column(String(30), nullable=False)
    volume_formula  = Column(String(20), nullable=False, default="LxWxD")
    unit_conversion = Column(Numeric(10, 6), default=1.0)
    is_active       = Column(Boolean, server_default=text("true"))
    created_at      = Column(DateTime(timezone=True), server_default=text("NOW()"))
    is_deleted      = Column(Boolean, server_default=text("false"))

    __table_args__ = (
        UniqueConstraint(
            "project_id", "work_type", "layer_code",
            "structure_type", "element_code", "activity_code",
            name="uq_boq_activity_map_v2",
        ),
        Index("ix_boq_activity_mapping_project_layer", "project_id", "layer_code"),
        Index("ix_boq_map_project_work_type", "project_id", "work_type"),
        Index("ix_boq_map_structure", "project_id", "structure_type", "element_code"),
    )


class BoqQtyActual(Base):
    __tablename__ = "boq_qty_actuals"

    id                    = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id            = Column(String(100), nullable=False)
    boq_item_id           = Column(UUID(as_uuid=True), nullable=True)
    boq_item_code         = Column(String(30), nullable=False)
    cumulative_actual_qty = Column(Numeric(14, 3), default=0)
    approved_qty          = Column(Numeric(14, 3), default=0)
    last_dpr_id           = Column(UUID(as_uuid=True), nullable=True)
    last_updated_at       = Column(DateTime(timezone=True), nullable=True)
    dpr_entry_count       = Column(Integer, default=0)
    is_deleted            = Column(Boolean, server_default=text("false"))

    __table_args__ = (
        UniqueConstraint("project_id", "boq_item_code", name="uq_boq_qty_actuals_project_item"),
        Index("ix_boq_qty_actuals_project_code", "project_id", "boq_item_code"),
    )
