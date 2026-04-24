from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


@dataclass(frozen=True)
class TongyiConfig:
    api_key: str
    base_url: str
    model: str
    chat_model: str
    transcription_model: str


@dataclass(frozen=True)
class AIConfig:
    provider: str
    tongyi: TongyiConfig


def get_ai_config() -> AIConfig:
    return AIConfig(
        provider=_env("AI_PROVIDER", "qwen").lower(),
        tongyi=TongyiConfig(
            api_key=_env("DASHSCOPE_API_KEY"),
            base_url=_env("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            model=_env("QWEN_MODEL", "qwen-plus"),
            chat_model=_env("QWEN_CHAT_MODEL", "qwen-plus"),
            transcription_model=_env("QWEN_TRANSCRIPTION_MODEL", "qwen3-asr-flash"),
        ),
    )
