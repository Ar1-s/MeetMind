from __future__ import annotations
from sqlalchemy import Boolean, Column, String, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    timezone = Column(String(50), default="Asia/Shanghai")
    participants = Column(JSON, default=list)
    anonymize_participants = Column(Boolean, default=False)
    participant_aliases = Column(JSON, default=dict)
    tags = Column(JSON, default=list)
    project_id = Column(String(36), nullable=True)
    source = Column(String(50), default="manual")  # manual, calendar_import
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    workspace_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    creator = relationship("User", back_populates="meetings", foreign_keys=[created_by])
    recordings = relationship("Recording", back_populates="meeting", cascade="all, delete-orphan")
    summary = relationship("Summary", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="source_meeting", cascade="all, delete-orphan")
    memories = relationship("MeetingMemory", back_populates="meeting", cascade="all, delete-orphan")
