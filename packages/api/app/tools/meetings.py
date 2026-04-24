from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import asyncio
from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db

# --- Schemas ---

class CreateMeetingSchema(BaseModel):
    title: str = Field(None, description="会议标题")

class SearchMeetingsSchema(BaseModel):
    query: str = Field(None, description="搜索关键词")
    tags: List[str] = Field(None, description="标签过滤")

class AnalyzeMeetingSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")

class UpdateMeetingSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    title: Optional[str] = Field(None, description="会议标题")
    start_time: Optional[str] = Field(None, description="开始时间 (ISO 格式)")
    end_time: Optional[str] = Field(None, description="结束时间 (ISO 格式)")
    participants: Optional[List[str]] = Field(None, description="参与者列表")
    tags: Optional[List[str]] = Field(None, description="标签列表")

class DeleteMeetingSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    confirm: bool = Field(..., description="确认删除 (必须为 true)")

class GetMeetingDetailSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")

# --- Tools ---

class CreateMeetingTool(BaseTool):
    name = "create_meeting"
    description = "创建新会议"
    args_schema = CreateMeetingSchema

    async def run(self, title: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        """创建新会议"""
        # If title is missing, request input via form
        if not title:
            return {
                "success": True,
                "require_input": True,
                "form_type": "create_meeting",
                "message": "请填写会议信息",
                "fields": [
                    {"name": "title", "label": "会议标题", "type": "text", "required": True},
                    {"name": "start_time", "label": "开始时间", "type": "datetime", "required": False},
                    {"name": "participants", "label": "参与者", "type": "text", "required": False},
                ]
            }
        
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                new_meeting = Meeting(title=title, created_by=user_id)
                db.add(new_meeting)
                await db.commit()
                await db.refresh(new_meeting)
                
                return {
                    "success": True,
                    "message": f"会议 '{title}' 已创建",
                    "data": {"title": title, "meeting_id": new_meeting.id}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break
            
class SearchMeetingsTool(BaseTool):
    name = "search_meetings"
    description = "搜索会议"
    args_schema = SearchMeetingsSchema

    async def run(self, query: str = None, tags: List[str] = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        """搜索会议"""
        async for db in get_db():
            try:
                from sqlalchemy import select, or_
                from sqlalchemy.orm import selectinload
                from app.models.meeting import Meeting
                
                sql = select(Meeting).options(selectinload(Meeting.summary))
                
                # Filter by user if user_id is provided
                if user_id:
                    sql = sql.where(Meeting.created_by == user_id)
                
                if query:
                    sql = sql.where(Meeting.title.ilike(f"%{query}%"))
                    
                # Execute
                result = await db.execute(sql)
                meetings = result.scalars().all()
                
                filtered = []
                for m in meetings:
                    filtered.append({
                        "id": m.id, 
                        "title": m.title, 
                        "date": m.start_time.isoformat() if m.start_time else None,
                        "status": "analyzed" if m.summary else "pending",
                        "has_summary": bool(m.summary)
                    })
                
                return {
                    "success": True,
                    "message": f"找到 {len(filtered)} 个会议",
                    "data": {"meetings": filtered}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break

class AnalyzeMeetingTool(BaseTool):
    name = "analyze_meeting"
    description = "分析会议录音，生成转写和纪要"
    args_schema = AnalyzeMeetingSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        """分析会议"""
        async for db in get_db():
            try:
                from sqlalchemy import select
                from app.models.meeting import Meeting
                from app.models.recording import Recording
                from app.routes.analysis import analysis_status, resolve_audio_path, run_analysis

                meeting_stmt = select(Meeting).where(Meeting.id == meeting_id)
                if user_id:
                    meeting_stmt = meeting_stmt.where(Meeting.created_by == user_id)

                meeting_result = await db.execute(meeting_stmt)
                meeting = meeting_result.scalar_one_or_none()
                if not meeting:
                    return {
                        "success": False,
                        "message": f"会议 {meeting_id} 不存在或无权限访问"
                    }

                recording_stmt = (
                    select(Recording)
                    .where(Recording.meeting_id == meeting_id)
                    .order_by(Recording.created_at.desc())
                )
                recording_result = await db.execute(recording_stmt)
                recording = recording_result.scalars().first()

                if not recording:
                    return {
                        "success": False,
                        "message": f"会议 {meeting_id} 没有录音，无法分析"
                    }
                if not recording.audio_uri:
                    return {
                        "success": False,
                        "message": f"会议 {meeting_id} 录音文件路径缺失，无法分析"
                    }

                analysis_id = f"analysis_{meeting_id}"
                current_status = analysis_status.get(analysis_id)
                if current_status and current_status.get("status") == "processing":
                    return {
                        "success": True,
                        "message": f"会议 {meeting_id} 正在分析中",
                        "data": {
                            "status": "processing",
                            "analysis_id": analysis_id,
                            "recording_id": recording.id,
                        },
                    }

                analysis_status[analysis_id] = {
                    "status": "processing",
                    "progress": 0,
                    "message": "开始分析...",
                    "stage": "prepare",
                }

                asyncio.create_task(
                    run_analysis(
                        analysis_id,
                        meeting_id,
                        recording.id,
                        resolve_audio_path(recording.audio_uri),
                    )
                )

                return {
                    "success": True,
                    "message": f"已开始分析会议 {meeting_id}",
                    "data": {
                        "status": "processing",
                        "analysis_id": analysis_id,
                        "recording_id": recording.id,
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break

class UpdateMeetingTool(BaseTool):
    name = "update_meeting"
    description = "更新会议信息"
    args_schema = UpdateMeetingSchema

    async def run(self, meeting_id: str, title: str = None, start_time: str = None, end_time: str = None, participants: List[str] = None, tags: List[str] = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from datetime import datetime as dt
                from sqlalchemy import select
                from app.models.meeting import Meeting

                result = await db.execute(
                    select(Meeting).where(Meeting.id == meeting_id)
                )
                meeting = result.scalar_one_or_none()
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                if title is not None:
                    meeting.title = title
                if start_time is not None:
                    meeting.start_time = dt.fromisoformat(start_time)
                if end_time is not None:
                    meeting.end_time = dt.fromisoformat(end_time)
                if participants is not None:
                    meeting.participants = participants
                if tags is not None:
                    meeting.tags = tags

                await db.commit()
                await db.refresh(meeting)

                return {
                    "success": True,
                    "message": f"会议 '{meeting.title}' 已更新",
                    "data": {
                        "meeting_id": meeting.id,
                        "title": meeting.title,
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class DeleteMeetingTool(BaseTool):
    name = "delete_meeting"
    description = "删除会议（需确认）"
    args_schema = DeleteMeetingSchema

    async def run(self, meeting_id: str, confirm: bool = False, user_id: str = None, **kwargs) -> Dict[str, Any]:
        if not confirm:
            return {"success": False, "message": "请确认删除操作：将 confirm 设为 true"}

        async for db in get_db():
            try:
                from sqlalchemy import select
                from app.models.meeting import Meeting

                result = await db.execute(
                    select(Meeting).where(Meeting.id == meeting_id)
                )
                meeting = result.scalar_one_or_none()
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                title = meeting.title
                await db.delete(meeting)
                await db.commit()
                return {"success": True, "message": f"会议 '{title}' 已删除"}
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class GetMeetingDetailTool(BaseTool):
    name = "get_meeting_detail"
    description = "获取会议完整详情"
    args_schema = GetMeetingDetailSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select, func
                from sqlalchemy.orm import selectinload
                from app.models.meeting import Meeting
                from app.models.task import Task

                result = await db.execute(
                    select(Meeting)
                    .options(selectinload(Meeting.summary), selectinload(Meeting.recordings))
                    .where(Meeting.id == meeting_id)
                )
                meeting = result.scalar_one_or_none()
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                # Count tasks
                task_count_result = await db.execute(
                    select(func.count()).select_from(Task).where(Task.source_meeting_id == meeting_id)
                )
                task_count = task_count_result.scalar() or 0

                return {
                    "success": True,
                    "message": f"会议详情: {meeting.title}",
                    "data": {
                        "meeting": {
                            "id": meeting.id,
                            "title": meeting.title,
                            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
                            "end_time": meeting.end_time.isoformat() if meeting.end_time else None,
                            "participants": meeting.participants or [],
                            "tags": meeting.tags or [],
                            "has_summary": bool(meeting.summary),
                            "recordings_count": len(meeting.recordings),
                            "tasks_count": task_count,
                            "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
                        }
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


# Register tools
ToolRegistry.register(CreateMeetingTool())
ToolRegistry.register(SearchMeetingsTool())
ToolRegistry.register(AnalyzeMeetingTool())
ToolRegistry.register(UpdateMeetingTool())
ToolRegistry.register(DeleteMeetingTool())
ToolRegistry.register(GetMeetingDetailTool())
