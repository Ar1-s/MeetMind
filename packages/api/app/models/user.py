from __future__ import annotations
"""User model for authentication"""

from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    calendar_token = Column(String(64), nullable=True, unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, nullable=True)

    # Relationships
    meetings = relationship("Meeting", back_populates="creator")
    tasks = relationship("Task", back_populates="creator")
    memories = relationship("MeetingMemory", back_populates="creator")
