from __future__ import annotations
import asyncio
import difflib
import logging
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.recording import Recording
from app.models.summary import Summary
from app.models.user import User
from app.dependencies import get_current_user
from app.services.ai_analysis import analyze_meeting
from app.services.participant_privacy import (
    build_participant_context,
    transform_summary_with_name_map,
)

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BASE_DIR / "uploads"


def resolve_audio_path(audio_uri: str) -> str:
    if audio_uri.startswith("/api/uploads/"):
        return str(UPLOAD_ROOT / audio_uri.removeprefix("/api/uploads/"))
    if audio_uri.startswith("/uploads/"):
        return str(UPLOAD_ROOT / audio_uri.removeprefix("/uploads/"))
    if audio_uri.startswith("uploads/"):
        return str(UPLOAD_ROOT / audio_uri.removeprefix("uploads/"))
    path = Path(audio_uri)
    if path.is_absolute():
        return str(path)
    return str(UPLOAD_ROOT / audio_uri)


def _normalize_anchor_text(value: str | None) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", (value or "").lower())


def _coerce_segment_number(value) -> float | None:
    try:
        if value is None:
            return None
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not number >= 0:
        return None
    return number


def _score_action_item_window(action_item: dict, text: str) -> float:
    normalized_text = _normalize_anchor_text(text)
    if not normalized_text:
        return 0.0

    weighted_candidates = [
        (action_item.get("source_quote"), 1.4),
        (action_item.get("title"), 1.0),
        (action_item.get("description"), 0.8),
        (action_item.get("assignee"), 0.45),
    ]

    score = 0.0
    matched = False
    for raw_candidate, weight in weighted_candidates:
        candidate = _normalize_anchor_text(raw_candidate)
        if len(candidate) < 2:
            continue

        matcher = difflib.SequenceMatcher(None, candidate, normalized_text)
        ratio = matcher.ratio()
        lcs = matcher.find_longest_match(0, len(candidate), 0, len(normalized_text)).size

        partial = (lcs * 8 + ratio * 40) * weight
        if candidate in normalized_text:
            partial += (120 + len(candidate) * 2) * weight
        elif lcs >= max(4, min(10, len(candidate) // 2)):
            partial += 25 * weight

        if partial > 0:
            matched = True
        score += partial

    return score if matched else 0.0


def _resolve_action_item_segment(action_item: dict, transcript_segments: list[dict]) -> tuple[float | None, float | None]:
    explicit_start = _coerce_segment_number(action_item.get("source_segment_start"))
    explicit_end = _coerce_segment_number(action_item.get("source_segment_end"))
    if explicit_start is not None and explicit_end is not None and explicit_end >= explicit_start:
        return explicit_start, explicit_end

    best_score = 0.0
    best_range: tuple[float | None, float | None] = (None, None)

    for index in range(len(transcript_segments)):
        for window_size in (1, 2):
            end_index = min(index + window_size - 1, len(transcript_segments) - 1)
            window = transcript_segments[index : end_index + 1]
            window_text = " ".join((segment.get("text") or "") for segment in window)
            score = _score_action_item_window(action_item, window_text)
            if score <= best_score:
                continue

            start = _coerce_segment_number(window[0].get("start"))
            end = _coerce_segment_number(window[-1].get("end"))
            if start is None or end is None or end < start:
                continue

            best_score = score
            best_range = (start, end)

    if best_score < 35:
        return None, None

    return best_range


class AnalysisRequest(BaseModel):
    recording_id: str


class AnalysisStatus(BaseModel):
    status: str
    progress: int
    message: Optional[str] = None


# In-memory cache for fast polling; DB-backed for restart survivability
analysis_status: dict[str, dict] = {}
analysis_tasks: set[asyncio.Task] = set()
analysis_tasks_by_id: dict[str, asyncio.Task] = {}


def _track_analysis_task(analysis_id: str, task: asyncio.Task) -> None:
    analysis_tasks.add(task)
    analysis_tasks_by_id[analysis_id] = task

    def _cleanup(done_task: asyncio.Task) -> None:
        analysis_tasks.discard(done_task)
        if analysis_tasks_by_id.get(analysis_id) is done_task:
            analysis_tasks_by_id.pop(analysis_id, None)

    task.add_done_callback(_cleanup)


async def _persist_status(analysis_id: str, data: dict):
    """Best-effort persist status to DB so it survives server restart."""
    from app.models.database import async_session
    from app.models.analysis_job import AnalysisJob
    try:
        async with async_session() as db:
            job = await db.get(AnalysisJob, analysis_id)
            if job:
                job.status = data.get("status", job.status)
                job.progress = data.get("progress", job.progress)
                job.message = data.get("message", job.message)
                job.stage = data.get("stage", job.stage)
                job.extra = {k: v for k, v in data.items() if k not in ("status", "progress", "message", "stage")}
            else:
                job = AnalysisJob(
                    id=analysis_id,
                    job_type="analysis",
                    meeting_id=data.get("meeting_id", ""),
                    status=data.get("status", "processing"),
                    progress=data.get("progress", 0),
                    message=data.get("message"),
                    stage=data.get("stage"),
                    extra={k: v for k, v in data.items() if k not in ("status", "progress", "message", "stage", "meeting_id")},
                )
                db.add(job)
            await db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist analysis status: {e}")
STAGES_ORDER = ["prepare", "transcribe", "summarize", "save", "tasks", "done"]
DEFAULT_STALE_ANALYSIS_TIMEOUT = timedelta(minutes=5)
STALE_ANALYSIS_TIMEOUT_BY_STAGE = {
    "prepare": timedelta(minutes=3),
    "transcribe": timedelta(minutes=20),
    "summarize": timedelta(minutes=12),
    "save": timedelta(minutes=5),
    "tasks": timedelta(minutes=5),
}


def _has_active_analysis_task(analysis_id: str | None) -> bool:
    if not analysis_id:
        return False
    task = analysis_tasks_by_id.get(analysis_id)
    return task is not None and not task.done()


def _is_stale_processing_status(
    updated_at: datetime | None,
    status: str | None,
    *,
    stage: str | None = None,
    analysis_id: str | None = None,
) -> bool:
    if status != "processing" or updated_at is None:
        return False
    if _has_active_analysis_task(analysis_id):
        return False

    updated = updated_at
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    timeout = STALE_ANALYSIS_TIMEOUT_BY_STAGE.get(stage or "", DEFAULT_STALE_ANALYSIS_TIMEOUT)
    return datetime.now(timezone.utc) - updated > timeout

def build_steps(current_stage: str, progress: int) -> list[dict]:
    steps = []
    if current_stage not in STAGES_ORDER:
        current_idx = -1
    else:
        current_idx = STAGES_ORDER.index(current_stage)
    for idx, stage in enumerate(STAGES_ORDER):
        if idx < current_idx:
            step_progress = 100
        elif idx == current_idx:
            step_progress = progress
        else:
            step_progress = 0
        label_map = {
            "prepare": "准备",
            "transcribe": "转写",
            "summarize": "生成纪要",
            "save": "保存",
            "tasks": "创建任务",
            "done": "完成",
        }
        steps.append({"label": label_map.get(stage, stage), "progress": step_progress})
    return steps


@router.post("/meetings/{meeting_id}/analyze")
async def start_analysis(
    meeting_id: str,
    request: AnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start AI analysis for a meeting recording"""
    # Verify meeting exists
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Verify recording exists
    result = await db.execute(
        select(Recording)
        .where(Recording.id == request.recording_id)
        .join(Meeting, Recording.meeting_id == Meeting.id)
        .where(Meeting.created_by == current_user.id)
    )
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    analysis_id = f"analysis_{meeting_id}"
    existing_job_status = analysis_status.get(analysis_id, {}).get("status")
    if existing_job_status == "processing":
        return {
            "analysis_id": analysis_id,
            "status": "processing",
            "message": analysis_status[analysis_id].get("message") or "分析正在进行中",
        }

    from app.models.analysis_job import AnalysisJob
    existing_job = await db.get(AnalysisJob, analysis_id)
    if existing_job and _is_stale_processing_status(
        existing_job.updated_at,
        existing_job.status,
        stage=existing_job.stage,
        analysis_id=analysis_id,
    ):
        stale_status = {
            "status": "failed",
            "progress": 0,
            "message": "分析任务超时未完成，请重新发起生成纪要。",
            "stage": "done",
            "steps": build_steps("done", 0),
            "meeting_id": meeting_id,
        }
        analysis_status[analysis_id] = stale_status
        await _persist_status(analysis_id, stale_status)
        existing_job = await db.get(AnalysisJob, analysis_id)

    if existing_job and existing_job.status == "processing":
        persisted_status = {
            "status": existing_job.status,
            "progress": existing_job.progress,
            "message": existing_job.message,
            "stage": existing_job.stage,
            **(existing_job.extra or {}),
            "meeting_id": meeting_id,
        }
        analysis_status[analysis_id] = persisted_status
        return {
            "analysis_id": analysis_id,
            "status": "processing",
            "message": existing_job.message or "分析正在进行中",
        }

    # Initialize status
    initial_status = {
        "status": "processing",
        "progress": 0,
        "message": "开始分析...",
        "stage": "prepare",
        "steps": build_steps("prepare", 0),
        "meeting_id": meeting_id,
    }
    analysis_status[analysis_id] = initial_status
    await _persist_status(analysis_id, initial_status)

    # Start detached background analysis so page navigation does not affect execution.
    task = asyncio.create_task(
        run_analysis(
            analysis_id,
            meeting_id,
            recording.id,
            resolve_audio_path(recording.audio_uri or ""),
        )
    )
    _track_analysis_task(analysis_id, task)
    
    return {
        "analysis_id": analysis_id,
        "status": "processing",
        "message": "分析已开始"
    }


async def run_analysis(
    analysis_id: str,
    meeting_id: str,
    recording_id: str,
    audio_path: str
):
    """Background task to run AI analysis"""
    from app.models.database import async_session
    from app.models.summary import Summary
    from sqlalchemy import select
    import time
    
    async with async_session() as db:
        try:
            meeting = await db.get(Meeting, meeting_id)
            meeting_owner = meeting.created_by if meeting else None
            participant_context = build_participant_context(meeting) if meeting else {}
            if meeting and participant_context.get("participant_aliases") != (meeting.participant_aliases or {}):
                meeting.participant_aliases = participant_context.get("participant_aliases", {})
            start_ts = time.time()

            async def set_status(status: str, progress: int, message: str, stage: str):
                data = {
                    "status": status,
                    "progress": progress,
                    "message": message,
                    "stage": stage,
                    "steps": build_steps(stage, progress),
                    "eta_seconds": max(int((time.time() - start_ts) * (100 - progress) / max(progress, 1)), 0)
                    if progress < 100
                    else 0,
                    "meeting_id": meeting_id,
                }
                analysis_status[analysis_id] = data
                await _persist_status(analysis_id, data)
            # Check for existing summary and transcript
            existing_transcript = None
            result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
            existing_summary = result.scalar_one_or_none()
            
            if existing_summary and existing_summary.transcript:
                logger.info(f"Found existing transcript for meeting {meeting_id}, reusing it.")
                existing_transcript = existing_summary.transcript

            # Update status: transcribing or skipping
            await set_status(
                "processing",
                5,
                "准备中...",
                "prepare",
            )
            await set_status(
                "processing",
                10 if not existing_transcript else 10,
                "正在转写音频..." if not existing_transcript else "检测到已有转写文本，跳过转写...",
                "transcribe",
            )
            
            # Run analysis
            result = await analyze_meeting(
                recording_id,
                audio_path,
                existing_transcript=existing_transcript,
                participant_context=participant_context,
            )
            await set_status("processing", 10, "转写完成，整理文本...", "transcribe")
            
            # Update status: generating summary
            await set_status(
                "processing",
                10,
                "正在生成纪要和行动项...",
                "summarize",
            )
            await set_status("processing", 10, "正在保存纪要与导图...", "save")
            
            # Save or Update summary
            if existing_summary:
                # Update existing summary
                existing_summary.abstract = result["summary"]["abstract"]
                existing_summary.decisions = result["summary"]["decisions"]
                existing_summary.risks = result["summary"]["risks"]
                existing_summary.action_items = result["summary"]["action_items"]
                existing_summary.mindmap = result["summary"].get("mindmap")
                existing_summary.transcript = result["summary"].get("transcript", [])
                existing_summary.sentiment_score = result["summary"].get("sentiment_score", 0.0)
                existing_summary.emotion_flags = result["summary"].get("emotion_flags", [])
                existing_summary.model_version = result["model_version"]
                existing_summary.updated_at = datetime.now(timezone.utc)
            else:
                # Create new summary
                summary = Summary(
                    meeting_id=meeting_id,
                    abstract=result["summary"]["abstract"],
                    decisions=result["summary"]["decisions"],
                    risks=result["summary"]["risks"],
                    action_items=result["summary"]["action_items"],
                    mindmap=result["summary"].get("mindmap"),
                    transcript=result["summary"].get("transcript", []),
                    sentiment_score=result["summary"].get("sentiment_score", 0.0),
                    emotion_flags=result["summary"].get("emotion_flags", []),
                    model_version=result["model_version"]
                )
                db.add(summary)
            
            await db.commit()
            await set_status("processing", 10, "正在创建任务锚点...", "tasks")

            # Update meeting memory (project memory baseline)
            try:
                from app.models.memory import MeetingMemory
                memory_result = await db.execute(
                    select(MeetingMemory).where(MeetingMemory.meeting_id == meeting_id)
                )
                existing_memory = memory_result.scalar_one_or_none()
                memory_content = "\n".join(
                    [
                        f"摘要: {result['summary'].get('abstract', '')}",
                        f"决策: {'; '.join(result['summary'].get('decisions', []))}",
                        f"风险: {'; '.join(result['summary'].get('risks', []))}",
                        f"行动项: {'; '.join([item.get('title','') for item in result['summary'].get('action_items', [])])}",
                    ]
                )
                if existing_memory:
                    existing_memory.title = meeting.title if meeting else existing_memory.title
                    existing_memory.content = memory_content
                else:
                    memory = MeetingMemory(
                        meeting_id=meeting_id,
                        created_by=meeting_owner,
                        title=meeting.title if meeting else "会议记忆",
                        content=memory_content,
                    )
                    db.add(memory)
                await db.commit()
            except Exception as memory_error:
                logger.error(f"Failed to update meeting memory: {memory_error}")
            
            # Update status: complete
            await set_status("completed", 100, "分析完成", "done")
            
            # --- Automate Task Creation ---
            try:
                from app.models.task import Task
                
                transcript_segments = result["summary"].get("transcript", [])
                
                existing_tasks_result = await db.execute(select(Task).where(Task.source_meeting_id == meeting_id))
                existing_tasks = existing_tasks_result.scalars().all()
                existing_tasks_by_title = {t.title: t for t in existing_tasks if t.title}
                
                new_tasks = []
                updated_tasks = 0
                action_items = result["summary"].get("action_items", [])
                
                for item in action_items:
                    title = item.get("title")
                    if not title:
                        continue
                        
                    assignee = item.get("assignee")
                    if assignee == "待定":
                        assignee = None
                        
                    priority = item.get("priority", "medium").lower()
                    if priority not in ["high", "medium", "low"]:
                        priority = "medium"
                        
                    due_date_str = item.get("due_date", "")
                    due_date = None
                    try:
                        if due_date_str and due_date_str != "待定":
                            due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                    except Exception as e:
                        logger.warning(f"Failed to parse due_date '{due_date_str}': {e}")
                        pass

                    seg_start, seg_end = _resolve_action_item_segment(item, transcript_segments)
                    existing_task = existing_tasks_by_title.get(title)

                    if existing_task:
                        changed = False

                        if existing_task.source_segment_start is None and seg_start is not None:
                            existing_task.source_segment_start = seg_start
                            changed = True
                        if existing_task.source_segment_end is None and seg_end is not None:
                            existing_task.source_segment_end = seg_end
                            changed = True
                        if existing_task.assignee is None and assignee:
                            existing_task.assignee = assignee
                            changed = True
                        if existing_task.due_date is None and due_date is not None:
                            existing_task.due_date = due_date
                            changed = True
                        if changed:
                            updated_tasks += 1
                        continue
                         
                    new_task = Task(
                        created_by=meeting_owner,
                        title=title,
                        description=f"From Meeting Summary", # Could be improved
                        assignee=assignee,
                        due_date=due_date,
                        priority=priority,
                        status="todo",
                        source_meeting_id=meeting_id,
                        source_segment_start=seg_start,
                        source_segment_end=seg_end,
                    )
                    db.add(new_task)
                    new_tasks.append(new_task)
                
                if new_tasks or updated_tasks:
                    await db.commit()
                    logger.info(
                        "Automatically synced tasks for meeting %s: created=%s updated=%s",
                        meeting_id,
                        len(new_tasks),
                        updated_tasks,
                    )
                    
            except Exception as task_error:
                logger.error(f"Failed to auto-create tasks: {task_error}")
                # Don't fail the whole analysis if task creation fails
                pass
            # ------------------------------
            
        except Exception as e:
            logger.error(f"Background analysis failed: {str(e)}")
            fail_data = {
                "status": "failed",
                "progress": 0,
                "message": f"分析失败: {str(e)}",
                "stage": "done",
                "steps": build_steps("done", 0),
                "meeting_id": meeting_id,
            }
            analysis_status[analysis_id] = fail_data
            await _persist_status(analysis_id, fail_data)


class MindmapEditRequest(BaseModel):
    instruction: str


@router.post("/meetings/{meeting_id}/mindmap/edit")
async def edit_mindmap(
    meeting_id: str,
    request: MindmapEditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit mindmap using natural language instruction"""
    from app.services.ai import get_ai_service
    from app.models.chat import Conversation, ChatMessage
    from sqlalchemy.orm import selectinload
    
    # Get current summary with mindmap
    result = await db.execute(
        select(Summary)
        .join(Meeting, Summary.meeting_id == Meeting.id)
        .where(Summary.meeting_id == meeting_id, Meeting.created_by == current_user.id)
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Meeting summary not found. Please analyze meeting first.")
    
    # --- Chat History Management ---
    chat_title = f"Mindmap-Meeting-{meeting_id}"
    stmt = select(Conversation).where(Conversation.title == chat_title)
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        conversation = Conversation(title=chat_title)
        db.add(conversation)
        await db.commit()
    
    # Add User Message
    user_msg = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.instruction
    )
    db.add(user_msg)
    # -------------------------------
    
    # Get current mindmap or create empty one
    current_mindmap = summary.mindmap or {"type": "reactflow", "nodes": []}
    
    # If mindmap is empty, create initial structure from summary
    if not current_mindmap.get("nodes"):
        # Create a basic mindmap structure from the abstract
        abstract = summary.abstract or "会议内容"
        current_mindmap = {
            "type": "reactflow",
            "nodes": [
                {"id": "node_1", "type": "topic", "label": abstract[:50], "description": abstract, "parent_id": None}
            ]
        }
        # Add decisions as subtopics
        for i, decision in enumerate(summary.decisions or []):
            current_mindmap["nodes"].append({
                "id": f"node_{i+2}",
                "type": "subtopic",
                "label": decision[:30] if len(decision) > 30 else decision,
                "description": decision,
                "parent_id": "node_1"
            })
    
    try:
        # Call AI service to edit
        ai_service = get_ai_service()
        updated_mindmap = await ai_service.edit_mindmap(current_mindmap, request.instruction)
        
        # Save to database
        summary.mindmap = updated_mindmap
        summary.updated_at = datetime.now(timezone.utc)
        
        # Add Assistant Message
        assistant_msg = ChatMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=f"已根据您的指令更新思维导图，当前包含 {len(updated_mindmap.get('nodes', []))} 个节点。",
            component_data={"mindmap_updated": True}
        )
        db.add(assistant_msg)
        
        await db.commit()
        
        return {
            "status": "success",
            "mindmap": updated_mindmap
        }
    except Exception as e:
        logger.error(f"Failed to edit mindmap: {e}")
        # Add Error Message
        error_msg = ChatMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=f"抱歉，编辑思维导图时出现错误: {str(e)}"
        )
        db.add(error_msg)
        await db.commit()
        
        raise HTTPException(status_code=500, detail=f"Failed to edit mindmap: {str(e)}")


@router.get("/meetings/{meeting_id}/mindmap/chat")
async def get_mindmap_chat_history(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get chat history for mindmap editing"""
    from app.models.chat import Conversation, ChatMessage
    from sqlalchemy.orm import selectinload

    # Ensure meeting belongs to user
    meeting_result = await db.execute(
        select(Meeting.id).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    if not meeting_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Meeting not found")

    chat_title = f"Mindmap-Meeting-{meeting_id}"
    stmt = select(Conversation).options(selectinload(Conversation.messages)).where(Conversation.title == chat_title)
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        return []
        
    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at
        }
        for msg in conversation.messages
    ]


@router.post("/meetings/{meeting_id}/mindmap/generate")
async def generate_mindmap(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate initial mindmap from meeting summary"""
    from app.services.ai import get_ai_service
    
    # Get summary
    result = await db.execute(
        select(Summary)
        .join(Meeting, Summary.meeting_id == Meeting.id)
        .where(Summary.meeting_id == meeting_id, Meeting.created_by == current_user.id)
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Meeting summary not found. Please analyze meeting first.")
    
    # Build context from summary
    context_parts = []
    if summary.abstract:
        context_parts.append(f"摘要: {summary.abstract}")
    if summary.decisions:
        context_parts.append(f"决策: {', '.join(summary.decisions)}")
    if summary.risks:
        context_parts.append(f"风险: {', '.join(summary.risks)}")
    if summary.action_items:
        items = [item.get("title", "") for item in summary.action_items]
        context_parts.append(f"待办: {', '.join(items)}")
    
    context = "\n".join(context_parts)
    
    # Create empty mindmap and use instruction to generate
    empty_mindmap = {"type": "reactflow", "nodes": []}
    instruction = f"根据以下会议内容生成一个完整的思维导图：\n{context}"
    
    try:
        ai_service = get_ai_service()
        generated_mindmap = await ai_service.edit_mindmap(empty_mindmap, instruction)
        
        # Save to database
        summary.mindmap = generated_mindmap
        summary.updated_at = datetime.now(timezone.utc)
        await db.commit()
        
        return {
            "status": "success",
            "mindmap": generated_mindmap
        }
    except Exception as e:
        logger.error(f"Failed to generate mindmap: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate mindmap: {str(e)}")


@router.get("/analysis/{analysis_id}/status")
async def get_analysis_status(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Get analysis progress status"""
    # Prefer DB state because uvicorn reload can leave per-process memory stale
    # while the persisted status has already moved to failed/completed.
    from app.models.analysis_job import AnalysisJob
    job = await db.get(AnalysisJob, analysis_id)
    if job:
        if _is_stale_processing_status(
            job.updated_at,
            job.status,
            stage=job.stage,
            analysis_id=analysis_id,
        ):
            data = {
                "status": "failed",
                "progress": 0,
                "message": "分析任务超时未完成，请重新发起生成纪要。",
                "stage": "done",
                "steps": build_steps("done", 0),
                "meeting_id": job.meeting_id,
            }
            analysis_status[analysis_id] = data
            await _persist_status(analysis_id, data)
            return data

        data = {
            "status": job.status,
            "progress": job.progress,
            "message": job.message,
            "stage": job.stage,
            **(job.extra or {}),
        }
        # Re-populate in-memory cache
        analysis_status[analysis_id] = data
        return data

    if analysis_id in analysis_status:
        return analysis_status[analysis_id]

    raise HTTPException(status_code=404, detail="Analysis not found")


@router.get("/meetings/{meeting_id}/summary")
async def get_meeting_summary(
    meeting_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get meeting summary"""
    meeting = await db.get(Meeting, meeting_id)
    result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")
    
    # 构建返回数据
    response_data = {
        "summary_id": summary.id,
        "meeting_id": summary.meeting_id,
        "abstract": summary.abstract,
        "decisions": summary.decisions,
        "risks": summary.risks,
        "action_items": summary.action_items,
        "mindmap": summary.mindmap,
        "mindmap_image": summary.mindmap_image,
        "transcript": summary.transcript,
        "sentiment_score": summary.sentiment_score,
        "emotion_flags": summary.emotion_flags,
        "model_version": summary.model_version,
        "created_at": summary.created_at
    }

    participant_context = build_participant_context(meeting) if meeting else {}
    response_data = transform_summary_with_name_map(
        response_data,
        participant_context.get("replacement_map"),
    )
    
    logger.debug("Returning summary data to frontend: %s", response_data)

    return response_data
