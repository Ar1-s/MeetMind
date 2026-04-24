from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


# --- Schemas ---

class AddMemorySchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    content: str = Field(..., description="记忆内容")
    title: Optional[str] = Field(None, description="记忆标题")


class SearchMemorySchema(BaseModel):
    query: str = Field(..., description="搜索关键词")


class ListMeetingMemoriesSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


# --- Tools ---

class AddMemoryTool(BaseTool):
    name = "add_memory"
    description = "添加会议记忆/笔记"
    args_schema = AddMemorySchema

    async def run(self, meeting_id: str, content: str, title: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.memory import MeetingMemory

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                memory = MeetingMemory(
                    meeting_id=meeting_id,
                    created_by=user_id,
                    title=title,
                    content=content,
                )
                db.add(memory)
                await db.commit()
                await db.refresh(memory)

                return {
                    "success": True,
                    "message": "记忆已添加",
                    "data": {
                        "memories": [{
                            "id": memory.id,
                            "title": memory.title,
                            "content": memory.content,
                            "meeting_id": meeting_id,
                        }]
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class SearchMemoryTool(BaseTool):
    name = "search_memory"
    description = "跨会议搜索记忆/笔记"
    args_schema = SearchMemorySchema

    async def run(self, query: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select, or_
                from app.models.memory import MeetingMemory
                from app.models.meeting import Meeting

                sql = (
                    select(MeetingMemory, Meeting.title.label("meeting_title"))
                    .join(Meeting, MeetingMemory.meeting_id == Meeting.id)
                    .where(
                        or_(
                            MeetingMemory.content.ilike(f"%{query}%"),
                            MeetingMemory.title.ilike(f"%{query}%"),
                        )
                    )
                )
                if user_id:
                    sql = sql.where(MeetingMemory.created_by == user_id)

                result = await db.execute(sql)
                rows = result.all()

                memories_list = []
                for memory, meeting_title in rows:
                    memories_list.append({
                        "id": memory.id,
                        "title": memory.title,
                        "content": memory.content[:200],
                        "meeting_id": memory.meeting_id,
                        "meeting_title": meeting_title,
                        "created_at": memory.created_at.isoformat() if memory.created_at else None,
                    })

                return {
                    "success": True,
                    "message": f"找到 {len(memories_list)} 条相关记忆",
                    "data": {"memories": memories_list}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class ListMeetingMemoriesTool(BaseTool):
    name = "list_meeting_memories"
    description = "列出指定会议的所有记忆/笔记"
    args_schema = ListMeetingMemoriesSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from app.models.memory import MeetingMemory
                from app.models.meeting import Meeting

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                result = await db.execute(
                    select(MeetingMemory)
                    .where(MeetingMemory.meeting_id == meeting_id)
                    .order_by(MeetingMemory.created_at.desc())
                )
                memories = result.scalars().all()

                memories_list = [
                    {
                        "id": m.id,
                        "title": m.title,
                        "content": m.content,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                    }
                    for m in memories
                ]

                return {
                    "success": True,
                    "message": f"会议「{meeting.title}」有 {len(memories_list)} 条记忆",
                    "data": {"memories": memories_list}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


# Register tools
ToolRegistry.register(AddMemoryTool())
ToolRegistry.register(SearchMemoryTool())
ToolRegistry.register(ListMeetingMemoriesTool())
