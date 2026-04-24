from __future__ import annotations
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    meeting_id = Column(String(36), ForeignKey("meetings.id"), nullable=False, unique=True)
    abstract = Column(Text, nullable=True)
    decisions = Column(JSON, default=list)
    risks = Column(JSON, default=list)
    action_items = Column(JSON, default=list)
    mindmap = Column(JSON, nullable=True)  # JSON or Mermaid format
    mindmap_image = Column(Text, nullable=True) # URI to generated image
    transcript = Column(JSON, nullable=True)  # segments: [{start, end, speaker, text}]
    sentiment_score = Column(Float, nullable=True)
    emotion_flags = Column(JSON, default=list)
    model_version = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    meeting = relationship("Meeting", back_populates="summary")
