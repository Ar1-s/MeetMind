from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Objective(Base):
    __tablename__ = "objectives"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="on_track")  # on_track, at_risk, off_track, completed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="objectives")
    key_results = relationship("KeyResult", back_populates="objective", cascade="all, delete-orphan")

