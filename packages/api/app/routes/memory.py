from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.memory import MeetingMemory
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.memory import MemoryCreate

router = APIRouter()


@router.get("/memory/meetings/{meeting_id}")
async def list_meeting_memories(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    memories_result = await db.execute(
        select(MeetingMemory).where(MeetingMemory.meeting_id == meeting_id).order_by(MeetingMemory.created_at.desc())
    )
    memories = memories_result.scalars().all()
    return {
        "memories": [
            {
                "id": m.id,
                "meeting_id": m.meeting_id,
                "title": m.title,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in memories
        ]
    }


@router.post("/memory/meetings/{meeting_id}")
async def create_meeting_memory(
    meeting_id: str,
    payload: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    memory = MeetingMemory(
        meeting_id=meeting_id,
        created_by=current_user.id,
        title=payload.title,
        content=payload.content,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)
    return {
        "id": memory.id,
        "meeting_id": memory.meeting_id,
        "title": memory.title,
        "content": memory.content,
        "created_at": memory.created_at,
    }


@router.get("/memory/search")
async def search_memories(
    query: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    memories_result = await db.execute(
        select(MeetingMemory)
        .join(Meeting, MeetingMemory.meeting_id == Meeting.id)
        .where(Meeting.created_by == current_user.id)
    )
    memories = memories_result.scalars().all()
    matched = [
        m
        for m in memories
        if query.lower() in (m.title or "").lower() or query.lower() in (m.content or "").lower()
    ]
    return {
        "memories": [
            {
                "id": m.id,
                "meeting_id": m.meeting_id,
                "title": m.title,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in matched
        ]
    }
