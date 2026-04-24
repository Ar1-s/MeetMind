from __future__ import annotations
from datetime import datetime
from uuid import uuid4
from typing import Optional

from sqlalchemy import String, DateTime, Integer, Float, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class AnalysisJob(Base):
    """Persists analysis/slides background job status so it survives server restarts."""
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    job_type: Mapped[str] = mapped_column(String(20), default="analysis")  # 'analysis' | 'slides'
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), nullable=False, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stage: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    extra: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
