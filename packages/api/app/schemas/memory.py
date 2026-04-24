from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class MemoryCreate(BaseModel):
    title: Optional[str] = None
    content: str


class MemoryEntry(BaseModel):
    id: str
    meeting_id: str
    title: Optional[str] = None
    content: str
    created_at: datetime
