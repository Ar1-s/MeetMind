from __future__ import annotations
from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, Header, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import re
from pydantic import BaseModel
import os
import uuid

from app.models.database import get_db
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.user import User
from app.services.slidev import build_slidev_assets, SLIDES_ROOT, LOG_FILENAME
from app.services.ppt_backgrounds import (
    list_preset_assets,
    list_upload_assets,
    record_upload_asset,
    load_background_config,
    save_background_config,
    UPLOADS_DIR,
)
from app.services.auth import verify_token
import asyncio
import time

router = APIRouter()

slides_status: dict[str, dict] = {}

import logging
_slides_logger = logging.getLogger(__name__)


async def _persist_slides_status(slides_id: str, meeting_id: str, data: dict):
    """Best-effort persist slides status to DB."""
    from app.models.database import async_session
    from app.models.analysis_job import AnalysisJob
    try:
        async with async_session() as db:
            job = await db.get(AnalysisJob, slides_id)
            if job:
                job.status = data.get("status", job.status)
                job.progress = data.get("progress", job.progress)
                job.message = data.get("message", job.message)
                job.extra = {k: v for k, v in data.items() if k not in ("status", "progress", "message")}
            else:
                job = AnalysisJob(
                    id=slides_id,
                    job_type="slides",
                    meeting_id=meeting_id,
                    status=data.get("status", "processing"),
                    progress=data.get("progress", 0),
                    message=data.get("message"),
                    extra={k: v for k, v in data.items() if k not in ("status", "progress", "message")},
                )
                db.add(job)
            await db.commit()
    except Exception as e:
        _slides_logger.warning(f"Failed to persist slides status: {e}")


async def get_current_user_slides(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    access_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_token: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization[7:]
    elif token:
        auth_token = token
    elif access_token:
        auth_token = access_token

    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(auth_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == payload["user_id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _find_export_file(export_dir: Path, suffix: str) -> Optional[Path]:
    if not export_dir.exists():
        return None
    for file_path in sorted(export_dir.glob(f"*.{suffix}")):
        if file_path.is_file():
            return file_path
    return None


def _sort_slide_image(path: Path) -> tuple[int, str]:
    match = re.search(r"(\d+)", path.stem)
    return (int(match.group(1)) if match else 0, path.name)


def _list_slide_images(meeting_id: str, min_mtime: Optional[float] = None) -> list[str]:
    images_dir = SLIDES_ROOT / meeting_id / "images"
    if not images_dir.exists():
        return []
    files = [p for p in images_dir.glob("*.png") if p.is_file()]
    if not files:
        return []
    if min_mtime is not None:
        files = [p for p in files if p.stat().st_mtime >= min_mtime]
        if not files:
            return []
    files_sorted = sorted(files, key=_sort_slide_image)
    return [f"/uploads/slides/{meeting_id}/images/{p.name}" for p in files_sorted]


def _detect_existing_assets(
    meeting_id: str, min_mtime: Optional[float] = None
) -> tuple[Optional[str], Optional[dict], Optional[list]]:
    export_dir = SLIDES_ROOT / meeting_id / "exports"
    export_urls: dict[str, str] = {}

    pdf_file = _find_export_file(export_dir, "pdf")
    if pdf_file and (min_mtime is None or pdf_file.stat().st_mtime >= min_mtime):
        export_urls["pdf"] = f"/api/v1/meetings/{meeting_id}/slides/export?format=pdf"

    pptx_file = _find_export_file(export_dir, "pptx")
    if pptx_file and (min_mtime is None or pptx_file.stat().st_mtime >= min_mtime):
        export_urls["pptx"] = f"/api/v1/meetings/{meeting_id}/slides/export?format=pptx"

    preview_path = (SLIDES_ROOT / meeting_id / "dist" / "index.html").resolve()
    preview_url = None
    if preview_path.exists() and preview_path.is_file():
        if min_mtime is None or preview_path.stat().st_mtime >= min_mtime:
            preview_url = f"/api/v1/meetings/{meeting_id}/slides/preview/index.html"

    image_urls = _list_slide_images(meeting_id, min_mtime=min_mtime)
    return preview_url, export_urls or None, image_urls or None


def _status_payload(
    status: str,
    progress: int,
    message: str,
    preview_url: Optional[str] = None,
    export_urls: Optional[dict] = None,
    image_urls: Optional[list] = None,
    log_url: Optional[str] = None,
) -> dict:
    payload = {
        "status": status,
        "progress": progress,
        "message": message,
    }
    if preview_url:
        payload["preview_url"] = preview_url
    if export_urls:
        payload["export_urls"] = export_urls
    if image_urls:
        payload["image_urls"] = image_urls
    if log_url:
        payload["log_url"] = log_url
    return payload


def _partial_processing_payload(
    *,
    base_status: dict,
    meeting_id: str,
    preview_url: Optional[str] = None,
    export_urls: Optional[dict] = None,
    image_urls: Optional[list] = None,
) -> dict:
    payload = _status_payload(
        "processing",
        max(int(base_status.get("progress", 0) or 0), 80),
        base_status.get("message") or "预览已生成，正在准备导出文件...",
        preview_url=preview_url,
        export_urls=export_urls,
        image_urls=image_urls,
        log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
    )
    if base_status.get("started_at") is not None:
        payload["started_at"] = base_status["started_at"]
    return payload


async def run_slidev_pipeline(
    slides_id: str,
    meeting: Meeting,
    summary: Summary,
    markdown_override: Optional[str] = None,
    theme: Optional[str] = None,
):
    started_at = time.time()

    def _set_status(
        status: str,
        progress: int,
        message: str,
        preview_url: Optional[str] = None,
        export_urls: Optional[dict] = None,
        image_urls: Optional[list] = None,
        log_url: Optional[str] = None,
    ):
        payload = _status_payload(
            status,
            progress,
            message,
            preview_url=preview_url,
            export_urls=export_urls,
            image_urls=image_urls,
            log_url=log_url,
        )
        payload["started_at"] = started_at
        slides_status[slides_id] = payload

    try:
        log_url = f"/api/v1/meetings/{meeting.id}/slides/logs"
        _set_status("processing", 10, "准备素材...", log_url=log_url)

        def _update(status: str, progress: int, message: str):
            _set_status(status, progress, message, log_url=log_url)

        result = await asyncio.to_thread(
            build_slidev_assets,
            meeting.id,
            meeting.title or "会议",
            meeting.start_time,
            {
                "abstract": summary.abstract,
                "decisions": summary.decisions,
                "risks": summary.risks,
                "action_items": summary.action_items,
                "mindmap": summary.mindmap,
            },
            summary.transcript or [],
            str(meeting.created_by),
            _update,
            markdown_override,
            theme,
        )
        _set_status("processing", 80, "导出 PDF/PPTX...", log_url=log_url)
        _set_status(
            "completed",
            100,
            "生成完成",
            preview_url=result["preview_url"],
            export_urls={
                "pdf": f"/api/v1/meetings/{meeting.id}/slides/export?format=pdf",
                "pptx": f"/api/v1/meetings/{meeting.id}/slides/export?format=pptx",
            },
            image_urls=_list_slide_images(meeting.id),
            log_url=log_url,
        )
    except Exception as exc:
        _set_status(
            "failed",
            100,
            f"生成失败: {exc}",
            log_url=f"/api/v1/meetings/{meeting.id}/slides/logs",
        )


class CreateSlidesRequest(BaseModel):
    theme: Optional[str] = None


@router.post("/meetings/{meeting_id}/slides")
async def create_slides(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    payload: Optional[CreateSlidesRequest] = None,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
    summary = summary_result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    theme = (payload.theme if payload else None) or "default"

    slides_id = f"slides_{meeting_id}"
    existing = slides_status.get(slides_id)
    if existing and existing.get("status") == "processing":
        return {
            "slides_id": slides_id,
            "status": "processing",
            "message": existing.get("message") or "PPT 正在生成中",
        }
    slides_status[slides_id] = _status_payload(
        "processing",
        0,
        "开始生成...",
        log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
    )
    slides_status[slides_id]["started_at"] = time.time()
    background_tasks.add_task(run_slidev_pipeline, slides_id, meeting, summary, None, theme)
    return {"slides_id": slides_id, "status": "processing", "message": "PPT 生成已开始"}


class SlideMarkdownRequest(BaseModel):
    markdown: str


class SlideBackgroundRequest(BaseModel):
    global_id: Optional[str] = None
    slides: Optional[dict] = None


def _extract_keywords(*texts: Optional[str]) -> set[str]:
    raw = " ".join([text for text in texts if text])
    if not raw:
        return set()
    tokens = re.split(r"[^a-zA-Z0-9\u4e00-\u9fff]+", raw.lower())
    return {token for token in tokens if len(token) > 1}


def _recommend_presets(keywords: set[str], limit: int = 6) -> list[dict]:
    presets = list_preset_assets()
    if not presets:
        return []
    tag_hints = {
        "增长": "growth",
        "销售": "business",
        "市场": "business",
        "客户": "business",
        "转化": "growth",
        "增长率": "growth",
        "指标": "data",
        "数据": "data",
        "分析": "data",
        "技术": "tech",
        "研发": "tech",
        "开发": "tech",
        "产品": "product",
        "方案": "product",
        "项目": "project",
        "会议": "meeting",
        "协作": "team",
        "团队": "team",
        "business": "business",
        "growth": "growth",
        "data": "data",
        "tech": "tech",
        "meeting": "meeting",
        "team": "team",
    }
    desired_tags = set()
    for token in keywords:
        if token in tag_hints:
            desired_tags.add(tag_hints[token])
        if token in {"okr", "kpi", "okr/kpi"}:
            desired_tags.add("data")
    if not desired_tags:
        desired_tags = {"business", "tech", "data", "blue"}

    scored = []
    for asset in presets:
        tags = {str(tag).lower() for tag in asset.get("tags") or []}
        score = len(tags & desired_tags)
        scored.append((score, asset))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = [asset for score, asset in scored if score > 0][:limit]
    if len(top) < limit:
        for _, asset in scored:
            if asset in top:
                continue
            top.append(asset)
            if len(top) >= limit:
                break
    return top


def _sanitize_assets(assets: list[dict]) -> list[dict]:
    cleaned = []
    for asset in assets:
        payload = dict(asset)
        payload.pop("file", None)
        payload.pop("file_path", None)
        cleaned.append(payload)
    return cleaned

@router.post("/meetings/{meeting_id}/slides/markdown")
async def create_slides_from_markdown(
    meeting_id: str,
    payload: SlideMarkdownRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
    summary = summary_result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    slides_id = f"slides_{meeting_id}"
    existing = slides_status.get(slides_id)
    if existing and existing.get("status") == "processing":
        return {
            "slides_id": slides_id,
            "status": "processing",
            "message": existing.get("message") or "PPT 正在生成中",
        }
    slides_status[slides_id] = _status_payload(
        "processing",
        0,
        "应用编辑并重新生成...",
        log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
    )
    slides_status[slides_id]["started_at"] = time.time()
    background_tasks.add_task(run_slidev_pipeline, slides_id, meeting, summary, payload.markdown)
    return {"slides_id": slides_id, "status": "processing", "message": "PPT 重建已开始"}


@router.get("/meetings/{meeting_id}/slides/markdown")
async def get_slides_markdown(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    markdown_path = (SLIDES_ROOT / meeting_id / "slides.md").resolve()
    if not markdown_path.exists():
        raise HTTPException(status_code=404, detail="Slides markdown not found")
    return {"markdown": markdown_path.read_text(encoding="utf-8")}


@router.get("/ppt-backgrounds")
async def list_ppt_backgrounds(
    source: str = Query("preset", pattern="^(preset|upload)$"),
    current_user: User = Depends(get_current_user_slides),
):
    if source == "preset":
        assets = list_preset_assets()
    else:
        assets = list_upload_assets(str(current_user.id))
    return {"assets": _sanitize_assets(assets)}


@router.post("/ppt-backgrounds/upload")
async def upload_ppt_background(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_slides),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    asset_id = uuid.uuid4().hex
    user_dir = UPLOADS_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    dest_path = user_dir / f"{asset_id}{ext}"

    file_size = 0
    with open(dest_path, "wb") as handle:
        while chunk := await file.read(1024 * 1024):
            handle.write(chunk)
            file_size += len(chunk)

    public_url = f"/uploads/assets/ppt_backgrounds/uploads/{current_user.id}/{dest_path.name}"
    asset_payload = {
        "id": asset_id,
        "file": dest_path.name,
        "file_path": str(dest_path),
        "name": file.filename,
        "url": public_url,
        "size": file_size,
        "created_at": time.time(),
        "source": "upload",
    }
    record_upload_asset(str(current_user.id), asset_payload)
    asset_payload["id"] = f"upload:{asset_id}"
    asset_payload.pop("file_path", None)
    return {"asset": asset_payload}


@router.get("/meetings/{meeting_id}/slides/backgrounds")
async def get_slides_backgrounds(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return load_background_config(meeting_id)


@router.post("/meetings/{meeting_id}/slides/backgrounds")
async def set_slides_backgrounds(
    meeting_id: str,
    payload: SlideBackgroundRequest,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return save_background_config(meeting_id, payload.dict(exclude_unset=True))


@router.post("/meetings/{meeting_id}/slides/backgrounds/recommend")
async def recommend_slides_backgrounds(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
    summary = summary_result.scalar_one_or_none()
    keywords = _extract_keywords(
        meeting.title or "",
        summary.abstract if summary else "",
        " ".join(summary.decisions or []) if summary else "",
        " ".join(summary.risks or []) if summary else "",
        " ".join([item.get("title", "") for item in (summary.action_items or [])]) if summary else "",
    )
    assets = _recommend_presets(keywords)
    return {"assets": _sanitize_assets(assets), "keywords": sorted(keywords)[:24]}


@router.get("/meetings/{meeting_id}/slides/status")
async def get_slides_status(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    slides_id = f"slides_{meeting_id}"
    status = slides_status.get(slides_id)
    if status:
        if status.get("status") == "processing":
            min_mtime = status.get("started_at")
            preview_url, export_urls, image_urls = _detect_existing_assets(meeting_id, min_mtime)
            if export_urls:
                status = _status_payload(
                    "completed",
                    100,
                    "已生成",
                    preview_url=preview_url,
                    export_urls=export_urls,
                    image_urls=image_urls,
                    log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
                )
                slides_status[slides_id] = status
            elif preview_url or image_urls:
                status = _partial_processing_payload(
                    base_status=status,
                    meeting_id=meeting_id,
                    preview_url=preview_url,
                    image_urls=image_urls,
                )
                slides_status[slides_id] = status
        elif status.get("status") == "completed":
            preview_url, export_urls, image_urls = _detect_existing_assets(meeting_id)
            status = _status_payload(
                "completed",
                100,
                status.get("message") or "已生成",
                preview_url=preview_url or status.get("preview_url"),
                export_urls=export_urls or status.get("export_urls"),
                image_urls=image_urls or status.get("image_urls"),
                log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
            )
            slides_status[slides_id] = status
        return status

    log_url = f"/api/v1/meetings/{meeting_id}/slides/logs"
    preview_url, export_urls, image_urls = _detect_existing_assets(meeting_id)
    if export_urls:
        return _status_payload(
            "completed",
            100,
            "已生成",
            preview_url=preview_url,
            export_urls=export_urls,
            image_urls=image_urls,
            log_url=log_url,
        )
    if preview_url or image_urls:
        return _status_payload(
            "processing",
            80,
            "预览已生成，正在检测导出文件...",
            preview_url=preview_url,
            image_urls=image_urls,
            log_url=log_url,
        )

    return _status_payload("idle", 0, "未生成", log_url=log_url)


@router.get("/meetings/{meeting_id}/slides/logs")
async def get_slides_logs(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    log_path = (SLIDES_ROOT / meeting_id / LOG_FILENAME).resolve()
    if not log_path.exists():
        return {"log": ""}
    return {"log": log_path.read_text(encoding="utf-8")}


@router.get("/meetings/{meeting_id}/slides/images")
async def list_slides_images(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    images = _list_slide_images(meeting_id)
    return {"images": images}


@router.get("/meetings/{meeting_id}/slides/preview/{path:path}")
async def preview_slides(
    meeting_id: str,
    path: str,
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    base_dir = (SLIDES_ROOT / meeting_id / "dist").resolve()
    file_path = (base_dir / path).resolve()
    if base_dir not in file_path.parents and base_dir != file_path:
        raise HTTPException(status_code=400, detail="Invalid path")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    response = FileResponse(str(file_path))
    if token:
        response.set_cookie("access_token", token, samesite="lax")
    return response


@router.get("/meetings/{meeting_id}/slides/export")
async def export_slides(
    meeting_id: str,
    format: str = Query(..., pattern="^(pdf|pptx)$"),
    inline: bool = Query(False),
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    export_dir = SLIDES_ROOT / meeting_id / "exports"
    files = list(export_dir.glob(f"*.{format}"))
    if not files:
        raise HTTPException(status_code=404, detail="Export not found")

    file_path = files[0]
    media_type = (
        "application/pdf"
        if format == "pdf"
        else "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    response = FileResponse(
        str(file_path),
        media_type=media_type,
        filename=None if inline else file_path.name,
    )
    if inline:
        response.headers["Content-Disposition"] = "inline"
    if token:
        response.set_cookie("access_token", token, samesite="lax")
    return response


@router.get("/meetings/{meeting_id}/slides/export/exists")
async def export_slides_exists(
    meeting_id: str,
    current_user: User = Depends(get_current_user_slides),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    export_dir = SLIDES_ROOT / meeting_id / "exports"
    return {
        "pdf": bool(_find_export_file(export_dir, "pdf")),
        "pptx": bool(_find_export_file(export_dir, "pptx")),
    }
