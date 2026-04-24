from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.models.user import User
from app.services.ai.factory import get_ai_service

router = APIRouter()


class TranslateRequest(BaseModel):
    text: str = Field(..., description="待翻译文本")
    source_lang: str = Field("auto", description="源语言代码，auto 自动识别")
    target_lang: str = Field(..., description="目标语言代码")
    enhance: bool = Field(False, description="是否开启 AI 增强翻译")


@router.post("/translate")
async def translate_text(
    payload: TranslateRequest,
    current_user: User = Depends(get_current_user),
):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="翻译文本不能为空")
    if not payload.target_lang:
        raise HTTPException(status_code=400, detail="目标语言不能为空")

    ai_service = get_ai_service()
    result = await ai_service.translate_text(
        text=payload.text.strip(),
        source_lang=payload.source_lang or "auto",
        target_lang=payload.target_lang,
        enhance=payload.enhance,
    )
    return result
