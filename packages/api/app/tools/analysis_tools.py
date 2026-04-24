from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


class StartAnalysisSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    recording_id: Optional[str] = Field(None, description="录音ID（可选，默认使用最新录音）")


class AnalysisStatusSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


class GetSummarySchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


class ExportSummarySchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    format: str = Field("md", description="导出格式：md、txt、word")


class StartMeetingAnalysisTool(BaseTool):
    name = "start_meeting_analysis"
    description = "开始分析会议录音并生成纪要"
    args_schema = StartAnalysisSchema

    async def run(self, meeting_id: str, recording_id: Optional[str] = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.recording import Recording
                from app.routes.analysis import run_analysis, analysis_status, resolve_audio_path

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                recording = None
                if recording_id:
                    result = await db.execute(
                        select(Recording)
                        .where(Recording.id == recording_id)
                        .where(Recording.meeting_id == meeting_id)
                    )
                    recording = result.scalar_one_or_none()
                else:
                    result = await db.execute(
                        select(Recording)
                        .where(Recording.meeting_id == meeting_id)
                        .order_by(Recording.created_at.desc())
                    )
                    recording = result.scalars().first()

                if not recording:
                    return {"success": False, "message": "该会议没有可用录音，请先导入录音"}

                if not recording.audio_uri:
                    return {"success": False, "message": "录音文件不可用"}

                analysis_id = f"analysis_{meeting_id}"
                analysis_status[analysis_id] = {
                    "status": "processing",
                    "progress": 0,
                    "message": "开始分析...",
                }

                audio_path = resolve_audio_path(recording.audio_uri)
                asyncio.create_task(run_analysis(analysis_id, meeting_id, recording.id, audio_path))

                return {
                    "success": True,
                    "message": "已开始分析会议录音",
                    "data": {
                        "analysis": {
                            "analysis_id": analysis_id,
                            "meeting_id": meeting_id,
                            "status": analysis_status[analysis_id],
                        }
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class GetAnalysisStatusTool(BaseTool):
    name = "get_meeting_analysis_status"
    description = "获取会议分析进度"
    args_schema = AnalysisStatusSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.routes.analysis import analysis_status

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                analysis_id = f"analysis_{meeting_id}"
                status = analysis_status.get(analysis_id)
                if status:
                    return {
                        "success": True,
                        "message": "已获取分析进度",
                        "data": {
                            "analysis": {
                                "analysis_id": analysis_id,
                                "meeting_id": meeting_id,
                                "status": status,
                            }
                        },
                    }

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if summary:
                    return {
                        "success": True,
                        "message": "会议已完成分析",
                        "data": {
                            "analysis": {
                                "analysis_id": analysis_id,
                                "meeting_id": meeting_id,
                                "status": {"status": "completed", "progress": 100, "message": "已完成"},
                            }
                        },
                    }

                return {"success": False, "message": "未找到分析记录"}
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class GetMeetingSummaryTool(BaseTool):
    name = "get_meeting_summary"
    description = "获取会议纪要与转写内容"
    args_schema = GetSummarySchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成"}

                return {
                    "success": True,
                    "message": "已获取会议纪要",
                    "data": {
                        "summary": {
                            "abstract": summary.abstract,
                            "decisions": summary.decisions,
                            "risks": summary.risks,
                            "action_items": summary.action_items,
                            "mindmap": summary.mindmap,
                            "transcript": summary.transcript,
                            "sentiment_score": summary.sentiment_score,
                            "emotion_flags": summary.emotion_flags,
                        }
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


def _format_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    if dt.tzinfo:
        return dt.isoformat()
    return dt.isoformat()


class ExportMeetingSummaryTool(BaseTool):
    name = "export_meeting_summary"
    description = "导出会议纪要（md/txt/word）"
    args_schema = ExportSummarySchema

    async def run(self, meeting_id: str, format: str = "md", user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法导出"}

                fmt = (format or "md").lower()
                if fmt not in ["md", "txt", "word"]:
                    fmt = "md"

                title = meeting.title or "会议"
                start_time = _format_datetime(meeting.start_time)

                if fmt == "md":
                    content = f"# {title}\n\n"
                    if start_time:
                        content += f"## 会议时间\n{start_time}\n\n"
                    if summary.abstract:
                        content += f"## 会议摘要\n{summary.abstract}\n\n"
                    if summary.decisions:
                        content += "## 会议决议\n"
                        for i, decision in enumerate(summary.decisions):
                            content += f"{i + 1}. {decision}\n"
                        content += "\n"
                    if summary.risks:
                        content += "## 风险与问题\n"
                        for i, risk in enumerate(summary.risks):
                            content += f"{i + 1}. {risk}\n"
                        content += "\n"
                    if summary.action_items:
                        content += "## 待办事项\n"
                        for i, item in enumerate(summary.action_items):
                            content += f"{i + 1}. {item.get('title', '')}\n"
                        content += "\n"
                    filename = f"{title}_会议纪要.md"
                    mime = "text/markdown"
                else:
                    content = f"{title}\n\n"
                    if start_time:
                        content += f"会议时间: {start_time}\n\n"
                    if summary.abstract:
                        content += f"会议摘要:\n{summary.abstract}\n\n"
                    if summary.decisions:
                        content += "会议决议:\n"
                        for i, decision in enumerate(summary.decisions):
                            content += f"{i + 1}. {decision}\n"
                        content += "\n"
                    if summary.risks:
                        content += "风险与问题:\n"
                        for i, risk in enumerate(summary.risks):
                            content += f"{i + 1}. {risk}\n"
                        content += "\n"
                    if summary.action_items:
                        content += "待办事项:\n"
                        for i, item in enumerate(summary.action_items):
                            content += f"{i + 1}. {item.get('title', '')}\n"
                        content += "\n"
                    if fmt == "word":
                        filename = f"{title}_会议纪要.doc"
                        mime = "application/msword"
                    else:
                        filename = f"{title}_会议纪要.txt"
                        mime = "text/plain"

                return {
                    "success": True,
                    "message": "已生成导出内容",
                    "data": {
                        "download": {
                            "filename": filename,
                            "mime": mime,
                            "content": content,
                        }
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


ToolRegistry.register(StartMeetingAnalysisTool())
ToolRegistry.register(GetAnalysisStatusTool())
ToolRegistry.register(GetMeetingSummaryTool())
ToolRegistry.register(ExportMeetingSummaryTool())
