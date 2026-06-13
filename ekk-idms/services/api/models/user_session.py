from sqlalchemy import Boolean, Column, DateTime, String, text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid


class UserSession(Base):
    __tablename__ = "user_sessions"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    platform     = Column(String(20), nullable=False)
    jti          = Column(String(64), nullable=False, unique=True)
    device_id    = Column(String(200), nullable=True)
    device_label = Column(String(200), nullable=True)
    issued_at    = Column(DateTime, server_default=text("NOW()"))
    last_seen_at = Column(DateTime, server_default=text("NOW()"))
    expires_at   = Column(DateTime, nullable=True)


class RegisteredDevice(Base):
    __tablename__ = "registered_devices"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    device_id     = Column(String(200), nullable=False)
    device_label  = Column(String(200), nullable=True)
    registered_at = Column(DateTime, server_default=text("NOW()"))
    is_active     = Column(Boolean, server_default=text("true"))
