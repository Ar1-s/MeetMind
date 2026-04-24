from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime, date as date_type
from typing import Optional


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[date_type] = None
    priority: str = "medium"
    source_meeting_id: Optional[str] = None
    key_result_id: Optional[str] = None
    source_segment_start: Optional[int] = None
    source_segment_end: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[date_type] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    key_result_id: Optional[str] = None
    source_segment_start: Optional[int] = None
    source_segment_end: Optional[int] = None


class TaskComplete(BaseModel):
    result_description: Optional[str] = None
    result_links: Optional[list[str]] = None
    attachments: Optional[list[str]] = None
    impact_conclusion: Optional[str] = None


class SourceMeeting(BaseModel):
    meeting_id: str
    title: str
    date: Optional[date_type] = None


class TaskResponse(BaseModel):
    task_id: str = Field(alias="id")
    title: str
    description: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[date_type] = None
    priority: str
    status: str
    source_meeting: Optional[SourceMeeting] = None
    key_result_id: Optional[str] = None
    okr: Optional[dict] = None
    source_segment_start: Optional[int] = None
    source_segment_end: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class TaskStatistics(BaseModel):
    total_tasks: int
    todo_count: int
    in_progress_count: int
    done_count: int
    overdue_count: int


class TaskBoardResponse(BaseModel):
    tasks: list[TaskResponse]
    statistics: TaskStatistics
