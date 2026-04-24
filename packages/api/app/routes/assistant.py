from __future__ import annotations

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.services.agent_service import agent_service
from app.services.auth import verify_token

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    instruction: str
    history: Optional[List[Dict]] = None
    conversation_id: Optional[str] = None
    agent: Optional[Dict] = None
    agent_id: Optional[str] = None


def get_user_id_from_token(authorization: str | None = None) -> Optional[str]:
    """Extract user_id from Authorization header (optional auth)."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    payload = verify_token(token)
    if payload:
        return payload.get("user_id")
    return None


@router.post("/chat")
async def chat_endpoint(request: ChatRequest, authorization: str = Header(None)):
    """
    Unified Chat Endpoint using AgentService.
    """
    try:
        user_id = get_user_id_from_token(authorization)
        return await agent_service.chat(
            request.instruction,
            request.history,
            request.conversation_id,
            user_id=user_id,
            agent=request.agent,
            agent_id=request.agent_id,
        )
    except Exception as exc:
        logger.error("Agent error: %s", str(exc), exc_info=True)
        error_msg = str(exc)
        if "API_KEY" in error_msg or "api_key" in error_msg or "未配置" in error_msg:
            detail = "AI 服务未配置。请在后端设置 DASHSCOPE_API_KEY 环境变量。"
        elif "quota" in error_msg.lower() or "rate" in error_msg.lower():
            detail = "AI 服务配额不足或请求过于频繁，请稍后再试。"
        else:
            detail = f"系统内部错误: {error_msg[:200]}"
        return {
            "type": "text",
            "message": detail,
            "suggestions": ["查看我的任务", "搜索会议"],
        }


@router.get("/tools")
async def list_tools():
    from app.tools.registry import ToolRegistry

    import app.tools.analysis_tools
    import app.tools.calendar_tools
    import app.tools.integrations
    import app.tools.meetings
    import app.tools.memory_tools
    import app.tools.mindmap
    import app.tools.projects
    import app.tools.slides
    import app.tools.tasks
    import app.tools.translate_tool

    return {"tools": ToolRegistry.get_tools_schema()}


@router.get("/suggestions")
async def get_suggestions():
    """Return dynamic conversation suggestions based on registered tools."""
    import random

    from app.tools.registry import ToolRegistry

    import app.tools.analysis_tools
    import app.tools.calendar_tools
    import app.tools.integrations
    import app.tools.meetings
    import app.tools.memory_tools
    import app.tools.mindmap
    import app.tools.projects
    import app.tools.slides
    import app.tools.tasks
    import app.tools.translate_tool

    tool_suggestion_map: dict[str, list[str]] = {
        "list_meetings": ["查看会议列表"],
        "search_meetings": ["搜索会议"],
        "create_meeting": ["创建新会议"],
        "list_tasks": ["查看我的任务"],
        "complete_task": ["完成任务"],
        "analyze_meeting": ["分析会议录音"],
        "create_slides": ["生成会议PPT"],
        "send_email": ["发送会议纪要邮件"],
        "generate_mindmap": ["查看思维导图"],
        "list_calendar_events": ["查看日程"],
        "export_summary": ["导出会议纪要"],
        "create_project": ["创建项目"],
        "list_projects": ["查看项目列表"],
        "get_project_okr": ["查看项目OKR"],
        "generate_okr_from_meeting": ["从会议生成OKR"],
        "search_memory": ["搜索记忆"],
        "translate_text": ["翻译文本"],
    }

    pool: list[str] = []
    try:
        available = {tool["name"] for tool in ToolRegistry.get_tools_schema()}
        for tool_name, suggestions in tool_suggestion_map.items():
            if tool_name in available:
                pool.extend(suggestions)
    except Exception:
        pass

    if not pool:
        pool = ["查看我的任务", "查看会议列表", "搜索会议", "创建新会议"]

    return {"suggestions": random.sample(pool, min(4, len(pool)))}
