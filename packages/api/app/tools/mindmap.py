from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy import select

from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


class GetMindmapSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    generate_if_missing: bool = Field(True, description="如果没有思维导图则自动生成")


class EditMindmapSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    instruction: str = Field(..., description="编辑思维导图的指令")


class GetMindmapTool(BaseTool):
    name = "get_mindmap"
    description = "获取会议思维导图，必要时自动生成"
    args_schema = GetMindmapSchema

    async def run(self, meeting_id: str, generate_if_missing: bool = True, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.services.ai import get_ai_service

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法获取思维导图"}

                mindmap = summary.mindmap
                generated = False
                if (not mindmap or not mindmap.get("nodes")) and generate_if_missing:
                    context_parts = []
                    if summary.abstract:
                        context_parts.append(f"摘要: {summary.abstract}")
                    if summary.decisions:
                        context_parts.append(f"决策: {', '.join(summary.decisions)}")
                    if summary.risks:
                        context_parts.append(f"风险: {', '.join(summary.risks)}")
                    if summary.action_items:
                        items = [item.get("title", "") for item in summary.action_items]
                        context_parts.append(f"待办: {', '.join(items)}")
                    context = "\n".join(context_parts) or "会议内容"

                    ai_service = get_ai_service()
                    empty_mindmap = {"type": "reactflow", "nodes": []}
                    instruction = f"根据以下会议内容生成一个完整的思维导图：\n{context}"
                    mindmap = await ai_service.edit_mindmap(empty_mindmap, instruction)
                    summary.mindmap = mindmap
                    summary.updated_at = datetime.utcnow()
                    await db.commit()
                    generated = True

                if not mindmap:
                    return {"success": False, "message": "暂无思维导图数据"}

                return {
                    "success": True,
                    "message": "已获取思维导图" + ("（自动生成）" if generated else ""),
                    "data": {
                        "mindmap": mindmap,
                        "meeting_id": meeting_id,
                        "generated": generated,
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class EditMindmapTool(BaseTool):
    name = "edit_mindmap"
    description = "根据指令编辑会议思维导图"
    args_schema = EditMindmapSchema

    async def run(self, meeting_id: str, instruction: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.services.ai import get_ai_service

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法编辑思维导图"}

                current_mindmap = summary.mindmap or {"type": "reactflow", "nodes": []}
                if not current_mindmap.get("nodes"):
                    abstract = summary.abstract or "会议内容"
                    current_mindmap = {
                        "type": "reactflow",
                        "nodes": [
                            {
                                "id": "node_1",
                                "type": "topic",
                                "label": abstract[:50],
                                "description": abstract,
                                "parent_id": None,
                            }
                        ],
                    }
                    for i, decision in enumerate(summary.decisions or []):
                        current_mindmap["nodes"].append({
                            "id": f"node_{i+2}",
                            "type": "subtopic",
                            "label": decision[:30] if len(decision) > 30 else decision,
                            "description": decision,
                            "parent_id": "node_1",
                        })

                ai_service = get_ai_service()
                updated_mindmap = await ai_service.edit_mindmap(current_mindmap, instruction)
                summary.mindmap = updated_mindmap
                summary.updated_at = datetime.utcnow()
                await db.commit()

                return {
                    "success": True,
                    "message": f"已更新思维导图（{len(updated_mindmap.get('nodes', []))} 个节点）",
                    "data": {"mindmap": updated_mindmap, "meeting_id": meeting_id},
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


ToolRegistry.register(GetMindmapTool())
ToolRegistry.register(EditMindmapTool())
