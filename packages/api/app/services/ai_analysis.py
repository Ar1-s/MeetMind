from __future__ import annotations

"""
AI Analysis Service

This module provides Tongyi Qwen powered transcription and summary generation.
"""

import logging
from datetime import datetime as dt, timezone
from typing import Optional

from app.services.ai import get_ai_service
from app.services.participant_privacy import transform_summary_with_name_map

logger = logging.getLogger(__name__)


async def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio file to text using Tongyi Qwen."""
    return await get_ai_service().transcribe_audio(audio_path)


async def generate_summary(
    transcript: list[dict],
    participant_context: Optional[dict] = None,
) -> dict:
    """Generate meeting summary from transcript using Tongyi Qwen."""
    return await get_ai_service().generate_summary(
        transcript,
        participant_context=participant_context,
    )


async def analyze_meeting(
    recording_id: str,
    audio_path: str,
    existing_transcript: Optional[list[dict]] = None,
    participant_context: Optional[dict] = None,
) -> dict:
    """
    Full meeting analysis pipeline:
    1. Transcribe audio to text if needed
    2. Generate meeting summary
    3. Attach transcript and metadata
    """
    try:
        ai_service = get_ai_service()
        if existing_transcript and len(existing_transcript) > 0:
            logger.info("Using existing transcript, skipping transcription...")
            transcript_segments = existing_transcript
            normalize_fn = getattr(ai_service, "_normalize_transcript_segments_to_chinese", None)
            if callable(normalize_fn):
                try:
                    normalized = await normalize_fn(transcript_segments)
                    transcript_segments = normalized.get("segments", transcript_segments)
                except Exception as exc:
                    logger.warning("Transcript normalization skipped for reused transcript: %s", str(exc))
        else:
            logger.info("Transcribing audio file: %s", audio_path)
            transcription = await ai_service.transcribe_audio(audio_path)
            transcript_segments = transcription["segments"]

        logger.info("Analyzing meeting transcription...")
        summary_result = await ai_service.generate_summary(
            transcript_segments,
            participant_context=participant_context,
        )

        if isinstance(summary_result, list):
            summary_result = summary_result[0] if summary_result else {}
        if not isinstance(summary_result, dict):
            summary_result = {}

        canonical_name_map = (participant_context or {}).get("canonical_name_map")
        summary_result = transform_summary_with_name_map(
            summary_result,
            canonical_name_map,
            include_transcript=False,
        )
        summary_result["transcript"] = transcript_segments

        return {
            "summary": summary_result,
            "model_version": "qwen-configured-model",
            "analyzed_at": dt.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.error("Analysis error: %s", str(exc))
        raise Exception(f"会议分析失败: {str(exc)}")


async def get_meeting_tasks(meeting_id: str, db) -> list[dict]:
    """Get tasks from meeting, either from existing summary or generate defaults."""
    from sqlalchemy import select

    from app.models.meeting import Meeting
    from app.models.summary import Summary

    result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
    summary = result.scalar_one_or_none()

    if summary and summary.action_items:
        tasks = []
        for item in summary.action_items:
            tasks.append(
                {
                    "title": item.get("title", "未命名任务"),
                    "description": item.get("description", ""),
                    "assignee": item.get("assignee"),
                    "due_date": item.get("due_date"),
                    "priority": item.get("priority", "medium"),
                }
            )
        return tasks

    meeting_result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = meeting_result.scalar_one_or_none()

    if meeting:
        return [
            {
                "title": "跟进会议讨论事项",
                "description": f"跟进会议 {meeting.title} 中讨论的重点事项",
                "assignee": None,
                "due_date": None,
                "priority": "medium",
            },
            {
                "title": "整理会议纪要",
                "description": f"整理会议 {meeting.title} 的纪要与后续安排",
                "assignee": None,
                "due_date": None,
                "priority": "medium",
            },
        ]

    return []
