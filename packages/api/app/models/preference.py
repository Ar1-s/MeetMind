from __future__ import annotations
from datetime import datetime
from uuid import uuid4
from typing import Optional

from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False, index=True)
    auto_analysis: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_task_extract: Mapped[bool] = mapped_column(Boolean, default=True)
    confirm_high_risk: Mapped[bool] = mapped_column(Boolean, default=True)
    smtp_host: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    smtp_username: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    smtp_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
