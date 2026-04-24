from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.models.database import get_db
from app.models.chat import Conversation, ChatMessage
from app.models.agent import Agent
from app.models.user import User
from app.dependencies import get_current_user
from app.agent_presets import BUILTIN_IDS

router = APIRouter()

class ChatResponse(BaseModel):
    id: str
    title: str
    updated_at: datetime
    agent_id: Optional[str] = None

    class Config:
        orm_mode = True

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    component_data: Optional[dict] = None
    created_at: datetime

    class Config:
        orm_mode = True

class ChatDetailResponse(ChatResponse):
    messages: List[MessageResponse]

    class Config:
        orm_mode = True


class ChatCreateRequest(BaseModel):
    title: Optional[str] = None
    agent_id: Optional[str] = None


class ChatUpdateRequest(BaseModel):
    title: Optional[str] = None
    agent_id: Optional[str] = None

@router.get("", response_model=List[ChatResponse])
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations"""
    stmt = (
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(desc(Conversation.updated_at))
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=ChatResponse)
async def create_chat(
    payload: Optional[ChatCreateRequest] = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create new conversation"""
    title = payload.title if payload and payload.title else "New Conversation"
    agent_id = payload.agent_id if payload else None
    if agent_id == "default":
        agent_id = None
    if agent_id and agent_id not in BUILTIN_IDS:
        stmt = select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Agent not found")
    chat = Conversation(title=title, user_id=current_user.id, agent_id=agent_id)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat

@router.get("/{chat_id}", response_model=ChatDetailResponse)
async def get_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get conversation details with messages"""
    stmt = select(Conversation).where(
        Conversation.id == chat_id, Conversation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # Lazy load messages is enabled by relation, but async needs explicit load or eager load
    # Here we rely on 'messages' relationship being available or triggering lazy load properly in async session context
    # Usually in async sqlalchemy, we should use selectinload options in query or explicitawait chat.awaitable_attrs.messages
    # Let's verify if default config covers it, otherwise we add options.
    from sqlalchemy.orm import selectinload
    stmt = (
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(Conversation.id == chat_id, Conversation.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    return chat


@router.patch("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: str,
    payload: ChatUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update conversation metadata (title/agent)."""
    stmt = select(Conversation).where(
        Conversation.id == chat_id, Conversation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if payload.title is not None:
        chat.title = payload.title
    if payload.agent_id is not None:
        if payload.agent_id == "default":
            chat.agent_id = None
        elif payload.agent_id:
            if payload.agent_id not in BUILTIN_IDS:
                stmt = select(Agent).where(Agent.id == payload.agent_id, Agent.user_id == current_user.id)
                result = await db.execute(stmt)
                if not result.scalar_one_or_none():
                    raise HTTPException(status_code=404, detail="Agent not found")
            chat.agent_id = payload.agent_id
        else:
            chat.agent_id = None

    await db.commit()
    await db.refresh(chat)
    return chat

@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete conversation"""
    stmt = select(Conversation).where(
        Conversation.id == chat_id, Conversation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()
    
    if chat:
        await db.delete(chat)
        await db.commit()
        
    return {"success": True}
