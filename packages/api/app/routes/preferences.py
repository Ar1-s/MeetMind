from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.models.database import get_db
from app.models.preference import UserPreference
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter()


class PreferencesResponse(BaseModel):
    auto_analysis: bool = True
    auto_task_extract: bool = True
    confirm_high_risk: bool = True
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_from: Optional[str] = None

    class Config:
        from_attributes = True


class PreferencesUpdateRequest(BaseModel):
    auto_analysis: Optional[bool] = None
    auto_task_extract: Optional[bool] = None
    confirm_high_risk: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_from: Optional[str] = None


@router.get("", response_model=PreferencesResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user preferences, create defaults if not exists."""
    stmt = select(UserPreference).where(UserPreference.user_id == current_user.id)
    result = await db.execute(stmt)
    pref = result.scalar_one_or_none()

    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)
        await db.commit()
        await db.refresh(pref)

    return pref


@router.patch("", response_model=PreferencesResponse)
async def update_preferences(
    payload: PreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update user preferences."""
    stmt = select(UserPreference).where(UserPreference.user_id == current_user.id)
    result = await db.execute(stmt)
    pref = result.scalar_one_or_none()

    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)

    await db.commit()
    await db.refresh(pref)
    return pref
