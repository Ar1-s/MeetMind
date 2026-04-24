from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class EventType(str, Enum):
    MEETING = "meeting"
    TASK = "task"

class CalendarEvent(BaseModel):
    id: str = Field(..., description="Unique event ID (prefixed with type)")
    title: str = Field(..., description="Event title")
    start: datetime = Field(..., description="Start time")
    end: datetime = Field(..., description="End time")
    all_day: bool = Field(False, description="Is all day event")
    type: EventType = Field(..., description="Event type")
    status: Optional[str] = Field(None, description="Status (e.g. todo, done)")
    metadata: dict = Field(default_factory=dict, description="Additional data (original ID, assignee, etc.)")
