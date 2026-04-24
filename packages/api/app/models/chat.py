from __future__ import annotations
from datetime import datetime
from uuid import uuid4
from sqlalchemy import String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from app.models.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=True) # Optional for now if no auth
    agent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("agents.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, default="New Conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="conversations")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String) # user, assistant
    content: Mapped[str] = mapped_column(Text)
    component_data: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
