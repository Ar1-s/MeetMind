from __future__ import annotations
from .base import AIService
from .qwen_service import QwenService

def get_ai_service() -> AIService:
    return QwenService()
