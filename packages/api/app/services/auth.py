from __future__ import annotations
"""Authentication service - password hashing and JWT tokens"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import secrets
import base64


# Simple password hashing (in production use bcrypt or argon2)
def hash_password(password: str) -> str:
    """Hash password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${pw_hash}"


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against stored hash"""
    try:
        salt, stored_hash = password_hash.split("$")
        pw_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return pw_hash == stored_hash
    except ValueError:
        return False


# Simple JWT-like token (in production use python-jose or PyJWT)
SECRET_KEY = "meetmind-secret-key-change-in-production"
TOKEN_EXPIRE_HOURS = 24


def create_access_token(user_id: str, username: str) -> str:
    """Create a simple access token"""
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = f"{user_id}:{username}:{int(expire.timestamp())}"
    signature = hashlib.sha256((payload + SECRET_KEY).encode()).hexdigest()[:16]
    token = base64.urlsafe_b64encode(f"{payload}:{signature}".encode()).decode()
    return token


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode access token"""
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        parts = decoded.rsplit(":", 1)
        payload, signature = parts[0], parts[1]
        
        expected_sig = hashlib.sha256((payload + SECRET_KEY).encode()).hexdigest()[:16]
        if signature != expected_sig:
            return None
        
        user_id, username, expire_ts = payload.split(":")
        if int(expire_ts) < int(datetime.now(timezone.utc).timestamp()):
            return None
        
        return {"user_id": user_id, "username": username}
    except Exception:
        return None
