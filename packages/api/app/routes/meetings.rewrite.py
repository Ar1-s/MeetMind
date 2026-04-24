from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.user import User
from app.schemas.meeting import (
    MeetingCreate,
    MeetingListItem,
    MeetingListResponse,
    MeetingResponse,
    MeetingUpdate,
    Pagination,
)

router = APIRouter()


def _alias_suffix(index: int) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    value = index + 1
    result = ""
    while value > 0:
        value, remainder = divmod(value - 1, len(alphabet))
        result = alphabet[remainder] + result
    return result


def _build_participant_aliases(
    participants: list[dict] | None,
    existing_aliases: Optional[dict] = None,
) -> dict[str, str]:
    aliases: dict[str, str] = {}
    used_aliases: set[str] = set()
    existing = existing_aliases or {}
    next_index = 0

    for participant in participants or []:
        name = (participant or {}).get("name")
        if not name or name in aliases:
            continue

        existing_alias = existing.get(name)
        if isinstance(existing_alias, str) and existing_alias and existing_alias not in used_aliases:
            aliases[name] = existing_alias
            used_aliases.add(existing_alias)
            continue

        while True:
            candidate = f"参会人{_alias_suffix(next_index)}"
            next_index += 1
            if candidate not in used_aliases:
                aliases[name] = candidate
                used_aliases.add(candidate)
                break

    return aliases


async def _load_full_meeting(db: AsyncSession, meeting_id: str) -> Meeting:
    result = await db.execute(
        select(Meeting)
        .where(Meeting.id == meeting_id)
        .options(
            selectinload(Meeting.recordings),
            selectinload(Meeting.summary),
        )
    )
    return result.scalar_one()


@router.post("", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    meeting: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    participants = [participant.model_dump() for participant in meeting.participants]
    db_meeting = Meeting(
        title=meeting.title,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        timezone=meeting.timezone,
        participants=participants,
        anonymize_participants=meeting.anonymize_participants,
        participant_aliases=_build_participant_aliases(participants),
        tags=meeting.tags,
        project_id=meeting.project_id,
        source=meeting.source,
        created_by=current_user.id,
    )
    db.add(db_meeting)
    await db.commit()
    await db.refresh(db_meeting)
    return await _load_full_meeting(db, db_meeting.id)


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    tags: Optional[str] = None,
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Meeting).where(Meeting.created_by == current_user.id)
    count_query = select(func.count(Meeting.id)).where(Meeting.created_by == current_user.id)

    if search:
        search_like = f"%{search}%"
        search_filter = or_(
            Meeting.title.ilike(search_like),
            cast(Meeting.tags, String).ilike(search_like),
        )
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)

    if tags:
        base_query = base_query.where(Meeting.tags.contains(tags))
        count_query = count_query.where(Meeting.tags.contains(tags))

    if project_id:
        base_query = base_query.where(Meeting.project_id == project_id)
        count_query = count_query.where(Meeting.project_id == project_id)

    query = (
        base_query.options(
            selectinload(Meeting.recordings),
            selectinload(Meeting.summary),
        )
        .order_by(Meeting.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query)
    meetings = result.scalars().all()

    items = [
        MeetingListItem(
            id=meeting.id,
            title=meeting.title,
            start_time=meeting.start_time,
            end_time=meeting.end_time,
            participants_count=len(meeting.participants) if meeting.participants else 0,
            has_recording=len(meeting.recordings) > 0 if meeting.recordings else False,
            has_summary=meeting.summary is not None,
            tags=meeting.tags or [],
        )
        for meeting in meetings
    ]

    return MeetingListResponse(
        meetings=items,
        pagination=Pagination(
            page=page,
            limit=limit,
            total=total,
            total_pages=math.ceil(total / limit) if total > 0 else 1,
        ),
    )


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting)
        .where(
            Meeting.id == meeting_id,
            Meeting.created_by == current_user.id,
        )
        .options(
            selectinload(Meeting.recordings),
            selectinload(Meeting.summary),
        )
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.patch("/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: str,
    meeting_update: MeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.created_by == current_user.id,
        )
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    update_data = meeting_update.model_dump(exclude_unset=True)
    if "participants" in update_data:
        update_data["participants"] = [
            participant.model_dump() for participant in (meeting_update.participants or [])
        ]

    for field, value in update_data.items():
        setattr(meeting, field, value)

    if "participants" in update_data or "anonymize_participants" in update_data:
        participants = update_data.get("participants", meeting.participants or [])
        meeting.participant_aliases = _build_participant_aliases(
            participants,
            meeting.participant_aliases or {},
        )

    await db.commit()
    await db.refresh(meeting)
    return await _load_full_meeting(db, meeting.id)


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(
            Meeting.id == meeting_id,
            Meeting.created_by == current_user.id,
        )
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    await db.delete(meeting)
    await db.commit()
