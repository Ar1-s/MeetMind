from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from typing import List, Optional

from app.models.database import get_db
from app.models.agent import Agent
from app.models.chat import Conversation
from app.models.user import User
from app.dependencies import get_current_user
from app.agent_presets import BUILTIN_AGENTS, BUILTIN_IDS

router = APIRouter()

DEFAULT_AGENT_ID = "default"


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    prompt: str
    is_default: bool = False


class AgentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    prompt: str = Field(min_length=1)


class AgentUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    prompt: Optional[str] = Field(default=None, min_length=1)


def _builtin_agent_responses() -> List[AgentResponse]:
    return [
        AgentResponse(
            id=a["id"],
            name=a["name"],
            description=a["description"],
            prompt=a["prompt"],
            is_default=a.get("is_default", False),
        )
        for a in BUILTIN_AGENTS
    ]


@router.get("", response_model=List[AgentResponse])
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Agent)
        .where(Agent.user_id == current_user.id)
        .order_by(desc(Agent.updated_at))
    )
    result = await db.execute(stmt)
    agents = result.scalars().all()
    response = _builtin_agent_responses()
    response.extend([AgentResponse.model_validate(a) for a in agents])
    return response


@router.post("", response_model=AgentResponse)
async def create_agent(
    payload: AgentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = Agent(
        user_id=current_user.id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        prompt=payload.prompt.strip(),
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    payload: AgentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if agent_id in BUILTIN_IDS:
        raise HTTPException(status_code=400, detail="Built-in agent cannot be updated")

    stmt = select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if payload.name is not None:
        agent.name = payload.name.strip()
    if payload.description is not None:
        agent.description = payload.description.strip() if payload.description else None
    if payload.prompt is not None:
        agent.prompt = payload.prompt.strip()

    await db.commit()
    await db.refresh(agent)
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if agent_id in BUILTIN_IDS:
        raise HTTPException(status_code=400, detail="Built-in agent cannot be deleted")

    stmt = select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Reset conversations using this agent
    await db.execute(
        update(Conversation)
        .where(Conversation.user_id == current_user.id, Conversation.agent_id == agent_id)
        .values(agent_id=None)
    )

    await db.delete(agent)
    await db.commit()
    return {"success": True}
