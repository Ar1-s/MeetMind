from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class KeyResult(Base):
    __tablename__ = "key_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    objective_id = Column(String(36), ForeignKey("objectives.id"), nullable=False)
    title = Column(String(255), nullable=False)
    current_value = Column(Float, default=0)
    target_value = Column(Float, default=1)
    unit = Column(String(24), nullable=True)
    status = Column(String(20), default="on_track")  # on_track, at_risk, off_track, completed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    objective = relationship("Objective", back_populates="key_results")
    tasks = relationship("Task", back_populates="key_result")
