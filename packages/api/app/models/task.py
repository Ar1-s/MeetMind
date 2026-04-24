from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Date, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    source_meeting_id = Column(String(36), ForeignKey("meetings.id"), nullable=True)
    key_result_id = Column(String(36), ForeignKey("key_results.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assignee = Column(String(100), nullable=True)
    due_date = Column(Date, nullable=True)
    priority = Column(String(20), default="medium")  # high, medium, low
    status = Column(String(20), default="todo")  # todo, in_progress, done, blocked
    result_description = Column(Text, nullable=True)
    result_links = Column(String(500), nullable=True)  # JSON array
    attachments = Column(String(500), nullable=True)  # JSON array
    source_segment_start = Column(Integer, nullable=True)  # seconds
    source_segment_end = Column(Integer, nullable=True)    # seconds
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    source_meeting = relationship("Meeting", back_populates="tasks")
    creator = relationship("User", back_populates="tasks", foreign_keys=[created_by])
    key_result = relationship("KeyResult", back_populates="tasks", foreign_keys=[key_result_id])
