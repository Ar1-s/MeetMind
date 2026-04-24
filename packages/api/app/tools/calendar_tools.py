from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


class CalendarRangeSchema(BaseModel):
    start_date: datetime = Field(..., description="开始时间 (ISO)")
    end_date: datetime = Field(..., description="结束时间 (ISO)")


class MeetingIcsSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


class CalendarRangeTool(BaseTool):
    name = "get_calendar_events_range"
    description = "获取指定时间范围内的日程（会议与任务）"
    args_schema = CalendarRangeSchema

    async def run(self, start_date: datetime, end_date: datetime, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.task import Task

                events: list[dict] = []
                meeting_query = select(Meeting).where(
                    Meeting.created_by == user_id,
                    Meeting.start_time >= start_date,
                    Meeting.start_time <= end_date,
                )
                result = await db.execute(meeting_query)
                meetings = result.scalars().all()

                for meeting in meetings:
                    start = meeting.start_time
                    duration = getattr(meeting, "duration", 60) or 60
                    end = start + timedelta(minutes=duration)
                    events.append(
                        {
                            "id": f"meeting_{meeting.id}",
                            "title": f"会议: {meeting.title}",
                            "start_time": start.isoformat() if start else None,
                            "end_time": end.isoformat() if end else None,
                            "type": "meeting",
                            "status": "completed" if getattr(meeting, "status", None) == "completed" else "scheduled",
                            "meeting_id": meeting.id,
                        }
                    )

                task_query = select(Task).where(
                    Task.created_by == user_id,
                    Task.due_date >= start_date.date(),
                    Task.due_date <= end_date.date(),
                )
                result = await db.execute(task_query)
                tasks = result.scalars().all()

                for task in tasks:
                    if not task.due_date:
                        continue
                    task_dt = datetime.combine(task.due_date, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=9)
                    events.append(
                        {
                            "id": f"task_{task.id}",
                            "title": f"任务: {task.title}",
                            "start_time": task_dt.isoformat(),
                            "end_time": (task_dt + timedelta(hours=1)).isoformat(),
                            "type": "task",
                            "status": task.status,
                            "task_id": task.id,
                            "assignee": task.assignee,
                            "priority": task.priority,
                        }
                    )

                return {
                    "success": True,
                    "message": f"已获取 {len(events)} 条日程",
                    "data": {"events": events},
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class MeetingIcsTool(BaseTool):
    name = "download_meeting_ics"
    description = "生成会议日程 ICS 下载链接"
    args_schema = MeetingIcsSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                url = f"/api/v1/meetings/{meeting_id}/calendar/ics"
                filename = f"{meeting.title or '会议'}_日程.ics"
                return {
                    "success": True,
                    "message": "已生成日程下载链接",
                    "data": {
                        "download": {
                            "filename": filename,
                            "url": url,
                        }
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


ToolRegistry.register(CalendarRangeTool())
ToolRegistry.register(MeetingIcsTool())
