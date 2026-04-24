from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class MeetingMemory(Base):
    __tablename__ = "meeting_memory"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    meeting_id = Column(String(36), ForeignKey("meetings.id"), nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    meeting = relationship("Meeting", back_populates="memories")
    creator = relationship("User", back_populates="memories")
