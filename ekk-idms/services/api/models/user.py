from sqlalchemy import Boolean, Column, DateTime, String, text
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import uuid

class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name     = Column(String(200), nullable=False)
    emp_code      = Column(String(50), unique=True)
    username      = Column(String(100), unique=True)
    email         = Column(String(200), unique=True, nullable=False)
    role          = Column(String(50))   # director / pm / site_engineer / store_keeper / admin
    contact_no    = Column(String(20))
    user_type     = Column(String(50), nullable=False, server_default=text("'USER'"))
    user_kind     = Column(String(20), nullable=True, default='internal')
    password_hash = Column(String(500), nullable=False)
    is_active     = Column(Boolean, nullable=False, server_default=text("true"))
    force_password_change = Column(Boolean, nullable=False, server_default=text("false"))
    created_by    = Column(String(200))
    updated_by    = Column(String(200))
    created_at    = Column(DateTime, server_default=text("NOW()"))
    updated_at    = Column(DateTime, server_default=text("NOW()"), onupdate=text("NOW()"))
    last_login_at = Column(DateTime)
