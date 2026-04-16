from sqlalchemy import Column, String, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name     = Column(String(200), nullable=False)
    email         = Column(String(200), unique=True, nullable=False)
    role          = Column(String(50))   # director / pm / site_engineer / store_keeper / admin
    password_hash = Column(String(500), nullable=False)
    created_at    = Column(DateTime, server_default=text("NOW()"))
