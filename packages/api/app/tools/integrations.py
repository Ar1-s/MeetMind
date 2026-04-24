from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from sqlalchemy import select

from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


class DraftEmailSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    template: str = Field("meeting_summary", description="邮件模板")
    recipients: List[str] = Field(default_factory=list, description="收件人列表（可选）")


class SendEmailSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    recipients: List[str] = Field(default_factory=list, description="收件人列表")
    template: str = Field("meeting_summary", description="邮件模板")
    subject: Optional[str] = Field(None, description="邮件标题（可选）")
    body: Optional[str] = Field(None, description="邮件正文（可选）")


class CalendarEventsSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


class DraftEmailTool(BaseTool):
    name = "draft_meeting_email"
    description = "根据会议纪要生成邮件草稿"
    args_schema = DraftEmailSchema

    async def run(self, meeting_id: str, template: str = "meeting_summary", recipients: List[str] = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        recipients = recipients or []
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.services.email import generate_email_draft

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法生成邮件"}

                summary_dict = {
                    "abstract": summary.abstract,
                    "decisions": summary.decisions or [],
                    "risks": summary.risks or [],
                    "action_items": summary.action_items or [],
                }
                draft = generate_email_draft(summary_dict, template=template, recipients=recipients)
                return {
                    "success": True,
                    "message": "已生成邮件草稿",
                    "data": {
                        "email": {
                            "subject": draft.get("subject"),
                            "body": draft.get("body"),
                            "recipients": recipients,
                        }
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class SendEmailTool(BaseTool):
    name = "send_meeting_email"
    description = "发送会议纪要邮件"
    args_schema = SendEmailSchema

    async def run(
        self,
        meeting_id: str,
        recipients: List[str] = None,
        template: str = "meeting_summary",
        subject: Optional[str] = None,
        body: Optional[str] = None,
        user_id: str = None,
        **kwargs,
    ) -> Dict[str, Any]:
        recipients = recipients or []
        if not recipients:
            return {
                "success": False,
                "message": "请提供收件人邮箱列表，例如：发送给 a@xx.com, b@xx.com",
            }
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.services.email import generate_email_draft, send_email

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法发送邮件"}

                summary_dict = {
                    "abstract": summary.abstract,
                    "decisions": summary.decisions or [],
                    "risks": summary.risks or [],
                    "action_items": summary.action_items or [],
                }
                if not subject or not body:
                    draft = generate_email_draft(summary_dict, template=template, recipients=recipients)
                    subject = subject or draft.get("subject")
                    body = body or draft.get("body")

                result = send_email(subject, body, recipients)
                return {
                    "success": True,
                    "message": "邮件已发送",
                    "data": {
                        "email": {
                            "subject": subject,
                            "body": body,
                            "recipients": result.get("recipients", recipients),
                            "status": "sent",
                        }
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class CalendarEventsTool(BaseTool):
    name = "get_calendar_events"
    description = "从会议纪要中提取日程事件"
    args_schema = CalendarEventsSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.services.calendar import compose_meeting_events

                meeting = await db.get(Meeting, meeting_id)
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法提取日程"}

                summary_dict = {
                    "abstract": summary.abstract,
                    "action_items": summary.action_items or [],
                }
                meeting_payload = {
                    "title": meeting.title or "",
                    "start_time": meeting.start_time.isoformat() + "Z" if meeting.start_time else "",
                    "end_time": meeting.end_time.isoformat() + "Z" if meeting.end_time else "",
                }
                events = compose_meeting_events(meeting_payload, summary_dict)
                return {
                    "success": True,
                    "message": f"已提取 {len(events)} 条日程事件",
                    "data": {"events": events},
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


ToolRegistry.register(DraftEmailTool())
ToolRegistry.register(SendEmailTool())
ToolRegistry.register(CalendarEventsTool())
