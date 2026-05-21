# ekk-idms/models/media.py

import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class EntryMedia(Base):
    __tablename__ = 'entry_media'

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id   = Column(UUID(as_uuid=True), ForeignKey('site_data_transactions.id', ondelete='CASCADE'), nullable=False)
    media_type = Column(String(10), nullable=False)   # 'photo' or 'video'
    url        = Column(String(500), nullable=False)
    filename   = Column(String(200), nullable=False)
    size_mb    = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    entry = relationship('SiteDataTransaction', backref='media')