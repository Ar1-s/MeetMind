from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import Response

from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

def format_datetime_ics(dt: datetime) -> str:
    """Format datetime for ICS (e.g. 20230101T120000Z)"""
    if not dt:
        return ""
    # Ensure UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


@router.get("/token")
async def get_calendar_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return or generate a per-user calendar subscription token.
    """
    # Refresh user to ensure latest token
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    if not user.calendar_token:
        import secrets
        user.calendar_token = secrets.token_hex(16)
        await db.commit()
    return {"token": user.calendar_token}

@router.get("/feed", response_class=Response)
async def get_calendar_feed(
    token: str = Query(..., description="Calendar token"),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate ICS feed for calendar subscription
    """
    # Verify user via calendar_token
    result = await db.execute(select(User).where(User.calendar_token == token))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=403, detail="Invalid calendar token")

    # Fetch meetings
    stmt = select(Meeting).where(Meeting.created_by == user.id).order_by(Meeting.start_time)
    result = await db.execute(stmt)
    meetings = result.scalars().all()

    # Build ICS content manually to avoid extra dependencies
    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MeetMind//CN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:MeetMind",
        "X-WR-TIMEZONE:UTC",
    ]

    for meeting in meetings:
        if not meeting.start_time:
            continue
            
        uid = str(meeting.id)
        created = format_datetime_ics(meeting.created_at)
        start = format_datetime_ics(meeting.start_time)
        end = format_datetime_ics(meeting.end_time) if meeting.end_time else start # Fallback for no end time
        summary = meeting.title or "Untitled Meeting"
        description = "Analyzed by MeetMind"
        
        ics_lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{created}",
            f"DTSTART:{start}",
            f"DTEND:{end}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            "STATUS:CONFIRMED",
            "END:VEVENT"
        ])

    ics_lines.append("END:VCALENDAR")
    
    return Response(
        content="\r\n".join(ics_lines), 
        media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="meetings.ics"'}
    )
