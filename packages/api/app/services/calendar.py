from __future__ import annotations
"""
Calendar Event Extraction Service

Extracts calendar events from meeting summaries and generates ICS files.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
import re


def generate_ics(events: list[dict]) -> str:
    """
    Generate ICS calendar file content from events.
    
    Args:
        events: List of event dicts with title, start_time, end_time, attendees, location
        
    Returns:
        ICS file content as string
    """
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MeetMind//Calendar Export//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    
    for event in events:
        uid = str(uuid.uuid4())
        start = event.get("start_time", "")
        end = event.get("end_time", "")
        
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART:{format_datetime(start)}",
            f"DTEND:{format_datetime(end)}",
            f"SUMMARY:{event.get('title', 'Meeting')}",
            f"DESCRIPTION:{event.get('description', '')}",
            f"LOCATION:{event.get('location', '')}",
            "END:VEVENT",
        ])
    
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def format_datetime(dt_str: str) -> str:
    """Format datetime string to ICS format (YYYYMMDDTHHMMSSZ)"""
    if not dt_str:
        return datetime.now().strftime("%Y%m%dT%H%M%SZ")
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y%m%dT%H%M%SZ")
    except:
        return datetime.now().strftime("%Y%m%dT%H%M%SZ")


DATE_PATTERN = re.compile(r"(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})")


def _ensure_timezone(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or raw.lower() in {"tbd", "unknown", "寰呭畾"}:
        return None
    try:
        normalized = raw.replace("Z", "+00:00")
        return _ensure_timezone(datetime.fromisoformat(normalized))
    except Exception:
        return None


def _parse_due_date(value: Optional[str]) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or raw.lower() in {"tbd", "unknown", "寰呭畾"}:
        return None

    iso_dt = _parse_iso_datetime(raw)
    if iso_dt:
        return iso_dt

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


def _extract_date_from_text(text: str) -> Optional[datetime]:
    match = DATE_PATTERN.search(text or "")
    if not match:
        return None
    return _parse_due_date(match.group(1))


def extract_calendar_events(summary: dict) -> list[dict]:
    """
    Extract potential calendar events from meeting summary.
    """
    events = []
    seen = set()
    abstract = summary.get("abstract", "") or ""

    for item in summary.get("action_items", []) or []:
        if not isinstance(item, dict):
            continue

        title = (item.get("title") or "Follow-up").strip()
        description = (item.get("description") or "").strip()
        assignee = (item.get("assignee") or "").strip()
        location = (item.get("location") or "").strip()

        start_dt = _parse_iso_datetime(item.get("start_time"))
        end_dt = _parse_iso_datetime(item.get("end_time"))
        due_dt = _parse_due_date(item.get("due_date"))

        if not start_dt and due_dt:
            start_dt = due_dt

        if not start_dt:
            start_dt = _extract_date_from_text(f"{title}\n{description}\n{abstract}")

        if not start_dt:
            continue

        start_dt = _ensure_timezone(start_dt)
        if not end_dt:
            if due_dt and due_dt.hour == 0 and due_dt.minute == 0 and due_dt.second == 0:
                end_dt = start_dt + timedelta(days=1)
            else:
                end_dt = start_dt + timedelta(hours=1)
        else:
            end_dt = _ensure_timezone(end_dt)

        if end_dt <= start_dt:
            end_dt = start_dt + timedelta(hours=1)

        dedupe_key = (title, start_dt.isoformat(), end_dt.isoformat())
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        desc_parts = []
        if description:
            desc_parts.append(description)
        if assignee and assignee not in {"寰呭畾", "TBD", "tbd"}:
            desc_parts.append(f"璐熻矗浜? {assignee}")
        if abstract:
            desc_parts.append(f"From meeting: {abstract[:100]}")

        event = {
            "title": title,
            "start_time": start_dt.isoformat().replace("+00:00", "Z"),
            "end_time": end_dt.isoformat().replace("+00:00", "Z"),
            "description": "\n".join(desc_parts),
            "attendees": [assignee] if assignee and assignee not in {"寰呭畾", "TBD", "tbd"} else [],
        }
        if location:
            event["location"] = location
        events.append(event)

    return events


def compose_meeting_events(meeting: dict, summary: dict) -> list[dict]:
    """
    Build event list containing the meeting itself + action items with due dates.
    meeting: {title,start_time,end_time}
    """
    events = []
    if meeting and meeting.get("start_time"):
        events.append({
            "title": meeting.get("title", "浼氳"),
            "start_time": meeting.get("start_time"),
            "end_time": meeting.get("end_time") or meeting.get("start_time"),
            "description": summary.get("abstract", "")[:200] if summary else "",
        })
    events.extend(extract_calendar_events(summary or {}))
    return events
