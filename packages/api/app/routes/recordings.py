from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import asyncio
import subprocess
import os
import uuid
from pathlib import Path

from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.recording import Recording
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BASE_DIR / "uploads"
UPLOAD_DIR = UPLOAD_ROOT / "recordings"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def probe_audio_duration_seconds(file_path: Path) -> int:
    if not file_path.exists():
        return 0

    def _probe_with_ffprobe() -> int:
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(file_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        raw = (result.stdout or "").strip()
        if not raw:
            return 0
        return max(int(round(float(raw))), 0)

    try:
        return await asyncio.to_thread(_probe_with_ffprobe)
    except Exception:
        if file_path.suffix.lower() == ".wav":
            try:
                import wave

                with wave.open(str(file_path), "rb") as wav_file:
                    frames = wav_file.getnframes()
                    rate = wav_file.getframerate()
                    if rate > 0:
                        return max(int(round(frames / float(rate))), 0)
            except Exception:
                return 0
        return 0


def resolve_storage_audio_path(audio_uri: Optional[str]) -> Optional[Path]:
    if not audio_uri:
        return None
    if audio_uri.startswith("/uploads/"):
        return UPLOAD_ROOT / audio_uri.removeprefix("/uploads/")
    if audio_uri.startswith("uploads/"):
        return UPLOAD_ROOT / audio_uri.removeprefix("uploads/")
    path = Path(audio_uri)
    if path.is_absolute():
        return path
    return UPLOAD_ROOT / audio_uri


def to_public_audio_uri(audio_uri: Optional[str]) -> Optional[str]:
    if not audio_uri:
        return None
    if audio_uri.startswith("/uploads/"):
        return audio_uri
    if audio_uri.startswith("uploads/"):
        return f"/{audio_uri}"
    path = Path(audio_uri)
    try:
        relative_path = path.relative_to(UPLOAD_ROOT)
        return f"/uploads/{relative_path.as_posix()}"
    except ValueError:
        return audio_uri


def serialize_recording(recording: Recording) -> dict:
    return {
        "id": recording.id,
        "meeting_id": recording.meeting_id,
        "type": recording.type,
        "storage": recording.storage,
        "audio_uri": to_public_audio_uri(recording.audio_uri),
        "duration": recording.duration,
        "file_size": recording.file_size,
        "status": recording.status,
        "created_at": recording.created_at,
    }


async def ensure_recording_duration(recording: Recording, db: AsyncSession) -> None:
    if (recording.duration or 0) > 0:
        return

    audio_path = resolve_storage_audio_path(recording.audio_uri)
    if not audio_path:
        return

    duration = await probe_audio_duration_seconds(audio_path)
    if duration <= 0:
        return

    recording.duration = duration
    db.add(recording)
    await db.commit()
    await db.refresh(recording)


@router.get("/{recording_id}")
async def get_recording(
    recording_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取录音详情"""
    result = await db.execute(
        select(Recording)
        .where(Recording.id == recording_id)
        .join(Meeting, Recording.meeting_id == Meeting.id)
        .where(Meeting.created_by == current_user.id)
    )
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    await ensure_recording_duration(recording, db)
    return serialize_recording(recording)


@router.get("/meetings/{meeting_id}")
async def list_recordings(
    meeting_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Ensure meeting belongs to user
    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    result = await db.execute(
        select(Recording)
        .where(Recording.meeting_id == meeting_id)
        .order_by(Recording.created_at.desc())
    )
    recordings = result.scalars().all()

    for recording in recordings:
        await ensure_recording_duration(recording, db)

    return {"recordings": [serialize_recording(recording) for recording in recordings]}


@router.post("/meetings/{meeting_id}/import")
async def import_recording(
    meeting_id: str,
    file: UploadFile = File(...),
    storage_preference: str = Form("local"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """导入音频文件"""
    # Verify meeting exists
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Validate file type
    allowed_extensions = {".mp3", ".m4a", ".wav", ".aac"}
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Unsupported file format")
    
    # Save file
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    file_size = 0
    with open(file_path, "wb") as f:
        while content := await file.read(1024 * 1024):  # 1MB chunks
            f.write(content)
            file_size += len(content)

    duration = await probe_audio_duration_seconds(file_path)
    
    # Create recording record
    recording = Recording(
        meeting_id=meeting_id,
        type="import",
        storage=storage_preference,
        audio_uri=str(file_path),
        duration=duration,
        file_size=file_size,
        status="completed",
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    
    response = serialize_recording(recording)
    response["imported_at"] = recording.created_at
    return response


@router.delete("/{recording_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recording(
    recording_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除录音详情与本地文件"""
    result = await db.execute(
        select(Recording)
        .where(Recording.id == recording_id)
        .join(Meeting, Recording.meeting_id == Meeting.id)
        .where(Meeting.created_by == current_user.id)
    )
    recording = result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")

    audio_path = recording.audio_uri
    await db.delete(recording)
    await db.commit()

    if audio_path:
        try:
            path = Path(audio_path)
            if not path.is_absolute():
                path = UPLOAD_ROOT / audio_path
            if path.exists():
                path.unlink()
        except Exception:
            pass
