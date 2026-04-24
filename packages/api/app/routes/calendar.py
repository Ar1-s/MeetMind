from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.task import Task
from app.models.key_result import KeyResult
from app.models.objective import Objective
from app.models.project import Project
from app.schemas.calendar import CalendarEvent, EventType
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter()


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _make_all_day_bounds(anchor: Optional[datetime]) -> tuple[Optional[datetime], Optional[datetime]]:
    normalized = _ensure_utc(anchor)
    if normalized is None:
        return None, None
    start = datetime.combine(normalized.date(), datetime.min.time(), tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _resolve_task_calendar_bounds(task: Task) -> tuple[Optional[datetime], Optional[datetime], str]:
    if task.due_date:
        start = datetime.combine(task.due_date, datetime.min.time(), tzinfo=timezone.utc)
        return start, start + timedelta(days=1), "due_date"

    if task.source_meeting and task.source_meeting.start_time:
        start, end = _make_all_day_bounds(task.source_meeting.start_time)
        return start, end, "source_meeting"

    start, end = _make_all_day_bounds(task.created_at)
    return start, end, "created_at"

@router.get("/events", response_model=List[CalendarEvent])
async def get_calendar_events(
    start_date: datetime,
    end_date: datetime,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get calendar events (meetings and tasks) within a date range.
    """
    events = []
    range_start = _ensure_utc(start_date) or start_date.replace(tzinfo=timezone.utc)
    range_end = _ensure_utc(end_date) or end_date.replace(tzinfo=timezone.utc)

    # 1. Fetch Meetings
    # Meetings that start within the range
    meeting_query = select(Meeting).where(
        Meeting.created_by == current_user.id,
        Meeting.start_time >= start_date,
        Meeting.start_time <= end_date,
    ).options(
        selectinload(Meeting.recordings),
        selectinload(Meeting.summary),
    )
    result = await db.execute(meeting_query)
    meetings = result.scalars().all()

    for meeting in meetings:
        if not meeting.start_time:
            continue

        start = meeting.start_time
        duration = getattr(meeting, 'duration', None) or 60
        end = meeting.end_time or (start + timedelta(minutes=duration))

        events.append(CalendarEvent(
            id=f"meeting_{meeting.id}",
            title=f"会议: {meeting.title}",
            start=start,
            end=end,
            type=EventType.MEETING,
            status="completed" if getattr(meeting, "status", None) == "completed" else "scheduled",
            metadata={
                "original_id": meeting.id,
                "has_recording": len(meeting.recordings) > 0 if meeting.recordings else False,
                "has_summary": meeting.summary is not None
            }
        ))

    # 2. Fetch Tasks
    # Tasks where due_date is within range
    # Task due_date is a Date object (usually), we need to cast or compare properly.
    # Assuming Task.due_date is Date or DateTime. converting for comparison.
    task_query = select(Task).where(
        Task.created_by == current_user.id,
    ).options(
        selectinload(Task.source_meeting),
        selectinload(Task.key_result).selectinload(KeyResult.objective).selectinload(Objective.project)
    )
    result = await db.execute(task_query)
    tasks = result.scalars().all()

    for task in tasks:
        day_start, day_end, date_source = _resolve_task_calendar_bounds(task)
        if not day_start or not day_end:
            continue
        if day_end <= range_start or day_start >= range_end:
            continue

        okr_meta = None
        title = f"任务: {task.title}"
        if task.key_result and task.key_result.objective and task.key_result.objective.project:
            kr = task.key_result
            obj = kr.objective
            proj = obj.project
            progress = 0.0
            if kr.target_value:
                progress = round(min(max(kr.current_value / kr.target_value, 0), 1) * 100, 1)
            okr_meta = {
                "project_id": proj.id,
                "project_name": proj.name,
                "objective_id": obj.id,
                "objective_title": obj.title,
                "key_result_id": kr.id,
                "key_result_title": kr.title,
                "progress": progress,
            }
            title = f"{title} · OKR {int(progress)}%"

        events.append(CalendarEvent(
            id=f"task_{task.id}",
            title=title,
            start=day_start,
            end=day_end,
            all_day=True,
            type=EventType.TASK,
            status=task.status,
            metadata={
                "original_id": task.id,
                "assignee": task.assignee,
                "priority": task.priority,
                "date_source": date_source,
                "source_meeting_id": task.source_meeting_id,
                "okr": okr_meta,
            }
        ))

    return events
