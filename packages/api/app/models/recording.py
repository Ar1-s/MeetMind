from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    meeting_id = Column(String(36), ForeignKey("meetings.id"), nullable=False)
    type = Column(String(20), default="import")  # live, import
    storage = Column(String(20), default="local")  # local, cloud, both
    audio_uri = Column(String(500), nullable=True)
    duration = Column(Integer, default=0)  # in seconds
    file_size = Column(Integer, default=0)  # in bytes
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    meeting = relationship("Meeting", back_populates="recordings")
