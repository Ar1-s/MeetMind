from __future__ import annotations
from sqlalchemy import Column, String, DateTime, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active")  # planning, active, on_hold, done
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    objectives = relationship("Objective", back_populates="project", cascade="all, delete-orphan")

