from __future__ import annotations
from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db
from app.models.user import User
from app.services.auth import verify_token

async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current user from token - Dependency"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization[7:]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    result = await db.execute(select(User).where(User.id == payload["user_id"]))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return user
