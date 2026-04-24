from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List


class Participant(BaseModel):
    name: str
    email: Optional[str] = None
    role: Optional[str] = None


class RecordingResponse(BaseModel):
    id: str
    meeting_id: str
    type: str
    storage: str
    audio_uri: Optional[str] = None
    duration: Optional[int] = None
    file_size: Optional[int] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SummaryResponse(BaseModel):
    id: Optional[str] = None
    meeting_id: Optional[str] = None
    abstract: Optional[str] = None
    decisions: Optional[List[str]] = None
    risks: Optional[List[str]] = None
    action_items: Optional[List[dict]] = None
    mindmap: Optional[dict] = None
    transcript: Optional[list] = None
    model_version: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingCreate(BaseModel):
    title: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: str = "Asia/Shanghai"
    participants: list[Participant] = Field(default_factory=list)
    anonymize_participants: bool = False
    tags: list[str] = Field(default_factory=list)
    project_id: Optional[str] = None
    source: str = "manual"


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: Optional[str] = None
    participants: Optional[list[Participant]] = None
    anonymize_participants: Optional[bool] = None
    tags: Optional[list[str]] = None
    project_id: Optional[str] = None


class MeetingResponse(BaseModel):
    id: str
    title: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: str
    participants: list[dict]
    anonymize_participants: bool = False
    participant_aliases: dict[str, str] = Field(default_factory=dict)
    tags: list[str]
    project_id: Optional[str] = None
    source: str
    created_by: Optional[str] = None
    workspace_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    recordings: Optional[List[RecordingResponse]] = None
    summary: Optional[SummaryResponse] = None

    class Config:
        from_attributes = True


class MeetingListItem(BaseModel):
    id: str
    title: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    participants_count: int = 0
    has_recording: bool = False
    has_summary: bool = False
    tags: list[str]

    class Config:
        from_attributes = True


class Pagination(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int


class MeetingListResponse(BaseModel):
    meetings: list[MeetingListItem]
    pagination: Pagination
