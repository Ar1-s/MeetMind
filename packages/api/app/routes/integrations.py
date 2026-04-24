from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.models.database import get_db
from app.models.summary import Summary
from app.models.meeting import Meeting
from app.models.user import User
from app.dependencies import get_current_user
from app.services.calendar import generate_ics, compose_meeting_events
from app.services.email import generate_email_draft, send_email

router = APIRouter()


class EmailRequest(BaseModel):
    template: str = "meeting_summary"
    recipients: list[str] = []


class EmailSendRequest(BaseModel):
    template: str = "meeting_summary"
    recipients: list[str] = []
    subject: Optional[str] = None
    body: Optional[str] = None


@router.get("/meetings/{meeting_id}/calendar/events")
async def get_calendar_events(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Extract calendar events from meeting summary"""
    result = await db.execute(
        select(Summary)
        .join(Meeting, Summary.meeting_id == Meeting.id)
        .where(Summary.meeting_id == meeting_id, Meeting.created_by == current_user.id)
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
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
    return {"events": events}


@router.get("/meetings/{meeting_id}/calendar/ics")
async def download_ics(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download ICS file for meeting events"""
    result = await db.execute(
        select(Summary)
        .join(Meeting, Summary.meeting_id == Meeting.id)
        .where(Summary.meeting_id == meeting_id, Meeting.created_by == current_user.id)
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
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
    ics_content = generate_ics(events)
    
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=meeting_{meeting_id}.ics"}
    )


@router.post("/meetings/{meeting_id}/email/draft")
async def generate_email(
    meeting_id: str,
    request: EmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate email draft from meeting summary"""
    result = await db.execute(
        select(Summary)
        .join(Meeting, Summary.meeting_id == Meeting.id)
        .where(Summary.meeting_id == meeting_id, Meeting.created_by == current_user.id)
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    summary_dict = {
        "abstract": summary.abstract,
        "decisions": summary.decisions or [],
        "risks": summary.risks or [],
        "action_items": summary.action_items or [],
    }
    
    draft = generate_email_draft(
        summary_dict,
        template=request.template,
        recipients=request.recipients
    )
    
    return draft


@router.post("/meetings/{meeting_id}/email/send")
async def send_email_from_summary(
    meeting_id: str,
    request: EmailSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Summary)
        .join(Meeting, Summary.meeting_id == Meeting.id)
        .where(Summary.meeting_id == meeting_id, Meeting.created_by == current_user.id)
    )
    summary = result.scalar_one_or_none()

    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    summary_dict = {
        "abstract": summary.abstract,
        "decisions": summary.decisions or [],
        "risks": summary.risks or [],
        "action_items": summary.action_items or [],
    }

    if not request.subject or not request.body:
        draft = generate_email_draft(
            summary_dict,
            template=request.template,
            recipients=request.recipients,
        )
        subject = request.subject or draft["subject"]
        body = request.body or draft["body"]
    else:
        subject = request.subject
        body = request.body

    try:
        result = send_email(subject, body, request.recipients)
        return {"status": "sent", "recipients": result["recipients"]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/calendar/subscribe")
async def get_calendar_subscribe_url(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    if not user.calendar_token:
        import secrets
        user.calendar_token = secrets.token_hex(16)
        await db.commit()

    base_url = str(request.base_url).rstrip("/")
    webcal_url = f"webcal://{base_url.replace('http://', '').replace('https://', '')}/api/v1/calendar/feed?token={user.calendar_token}"
    return {"webcal_url": webcal_url}
