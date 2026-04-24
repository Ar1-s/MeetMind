from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone

from app.models.database import get_db
from app.models.user import User
from app.services.auth import hash_password, verify_password, create_access_token, verify_token

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    calendar_token: Optional[str]


class AuthResponse(BaseModel):
    access_token: str
    user: UserResponse


@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    # Check if username exists
    result = await db.execute(select(User).where(User.username == request.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create user
    import secrets
    calendar_token = secrets.token_hex(16)
    user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
        display_name=request.display_name or request.username,
        calendar_token=calendar_token,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Generate token
    token = create_access_token(user.id, user.username)
    
    return {
        "access_token": token,
        "user": {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "calendar_token": user.calendar_token,
        },
    }


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with username and password"""
    from sqlalchemy import or_
    result = await db.execute(select(User).where(
        or_(
            User.username == request.username,
            User.email == request.username
        )
    ))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    if not user.calendar_token:
        import secrets
        user.calendar_token = secrets.token_hex(16)
    await db.commit()
    
    # Generate token
    token = create_access_token(user.id, user.username)
    
    return {
        "access_token": token,
        "user": {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "calendar_token": user.calendar_token,
        },
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Get current user from token"""
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
    
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "calendar_token": user.calendar_token,
    }
