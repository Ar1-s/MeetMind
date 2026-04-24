from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any
from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry


# --- Schema ---

class TranslateTextSchema(BaseModel):
    text: str = Field(..., description="要翻译的文本")
    target_lang: str = Field(..., description="目标语言 (zh, en, ja, ko, fr, de, es 等)")
    source_lang: str = Field("auto", description="源语言 (默认自动检测)")


# --- Tool ---

class TranslateTextTool(BaseTool):
    name = "translate_text"
    description = "翻译文本到指定语言"
    args_schema = TranslateTextSchema

    async def run(self, text: str, target_lang: str, source_lang: str = "auto", user_id: str = None, **kwargs) -> Dict[str, Any]:
        try:
            from app.services.ai import get_ai_service

            ai = get_ai_service()
            result = await ai.translate_text(
                text=text,
                source_lang=source_lang,
                target_lang=target_lang,
                enhance=False,
            )

            return {
                "success": True,
                "message": "翻译完成",
                "data": {
                    "translation": {
                        "original": text,
                        "translated": result.get("translated_text", result.get("text", "")),
                        "source_lang": source_lang,
                        "target_lang": target_lang,
                    }
                }
            }
        except Exception as e:
            return {"success": False, "message": str(e)}


# Register tool
ToolRegistry.register(TranslateTextTool())
