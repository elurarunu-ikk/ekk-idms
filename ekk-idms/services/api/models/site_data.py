from sqlalchemy import Column, String, Numeric, Boolean, DateTime, Integer, Text, text, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from database import Base
import uuid
from sqlalchemy import Date


class SiteDataTransaction(Base):
    __tablename__ = "site_data_transactions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id       = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    source           = Column(String(30))
    report_date      = Column(DateTime, server_default=text("NOW()"))
    activity_code    = Column(String(50))
    chainage_from    = Column(Numeric(10, 3))
    chainage_to      = Column(Numeric(10, 3))
    stage            = Column(String(100))
    quantity_lm      = Column(Numeric(12, 3))
    quantity         = Column(Numeric(12, 3))
    unit             = Column(String(20))
    work_type        = Column(String(50))
    structure_type   = Column(String(100))
    layer_code       = Column(String(50))
    element_code     = Column(String(50))
    length_m         = Column(Numeric(12, 3))
    width_m          = Column(Numeric(12, 3))
    depth_m          = Column(Numeric(12, 3))
    cost             = Column(Numeric(14, 2))
    payment_qualifies = Column(Boolean, default=False)
    approved         = Column(Boolean, default=False)
    rejected         = Column(Boolean, default=False)
    approved_by      = Column(String(200))
    approved_at      = Column(DateTime)
    reject_reason    = Column(String(500))
    rejected_by      = Column(String(200))
    entered_by       = Column(String(200))
    contractor_name  = Column(String(200))
    road_side        = Column(String(10))
    rfi_number       = Column(Integer)
    layer_section    = Column(String(50))
    created_at       = Column(DateTime, server_default=text("NOW()"))
    entry_date       = Column(Date, nullable=True)
    remarks          = Column(Text)
    gps_start_lat    = Column(Numeric(10, 7))
    gps_start_lng    = Column(Numeric(10, 7))
    gps_end_lat      = Column(Numeric(10, 7))
    gps_end_lng      = Column(Numeric(10, 7))
    gps_accuracy_m   = Column(Numeric(8, 2))
    voice_url        = Column(String(500))
    weather_code     = Column(String(20))
    progress_status  = Column(String(30))
    temp_celsius     = Column(Numeric(4, 1))
    drone_flight_id  = Column(UUID(as_uuid=True))
    lidar_scan_id    = Column(UUID(as_uuid=True))

    # 3M resource tracking
    materials_used        = Column(JSONB, nullable=True)
    material_test_refs    = Column(ARRAY(Text), nullable=True)
    machines_deployed     = Column(JSONB, nullable=True)
    machine_log_refs      = Column(ARRAY(Text), nullable=True)
    manpower_deployed     = Column(JSONB, nullable=True)
    attendance_sheet_ref  = Column(Text, nullable=True)
    thickness_mm          = Column(Numeric(10, 3), nullable=True)

    # Voice capture metadata
    voice_transcript      = Column(Text, nullable=True)
    voice_confidence_score = Column(Numeric(4, 3), nullable=True)
    voice_audio_url       = Column(String(500), nullable=True)
