from __future__ import annotations
import asyncio
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from sqlalchemy import select

from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


class GenerateSlidesSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    markdown: Optional[str] = Field(None, description="可选的自定义 Slide Markdown")


class SlidesStatusSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


class GenerateSlidesTool(BaseTool):
    name = "generate_slides"
    description = "根据会议内容生成 PPT（PDF/PPTX）"
    args_schema = GenerateSlidesSchema

    async def run(self, meeting_id: str, markdown: Optional[str] = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.models.summary import Summary
                from app.routes.slides import run_slidev_pipeline, slides_status, _status_payload, _detect_existing_assets

                result = await db.execute(
                    select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == user_id)
                )
                meeting = result.scalar_one_or_none()
                if not meeting:
                    return {"success": False, "message": "会议不存在或无权限访问"}

                summary_result = await db.execute(select(Summary).where(Summary.meeting_id == meeting_id))
                summary = summary_result.scalar_one_or_none()
                if not summary:
                    return {"success": False, "message": "会议纪要未生成，无法生成 PPT"}

                preview_url, export_urls, image_urls = _detect_existing_assets(meeting_id)
                if preview_url or export_urls or image_urls:
                    status = _status_payload(
                        "completed",
                        100,
                        "已生成",
                        preview_url=preview_url,
                        export_urls=export_urls,
                        image_urls=image_urls,
                        log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
                    )
                    status["meeting_id"] = meeting_id
                    return {
                        "success": True,
                        "message": "PPT 已生成，可直接下载",
                        "data": {"slides": status, "slides_id": f"slides_{meeting_id}"},
                    }

                slides_id = f"slides_{meeting_id}"
                slides_status[slides_id] = _status_payload(
                    "processing",
                    0,
                    "开始生成...",
                    log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
                )
                slides_status[slides_id]["meeting_id"] = meeting_id
                asyncio.create_task(run_slidev_pipeline(slides_id, meeting, summary, markdown))

                return {
                    "success": True,
                    "message": "PPT 生成已开始",
                    "data": {"slides": slides_status[slides_id], "slides_id": slides_id},
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class SlidesStatusTool(BaseTool):
    name = "get_slides_status"
    description = "获取 PPT 生成状态与下载链接"
    args_schema = SlidesStatusSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.meeting import Meeting
                from app.routes.slides import slides_status, _status_payload, _detect_existing_assets

                result = await db.execute(
                    select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == user_id)
                )
                meeting = result.scalar_one_or_none()
                if not meeting:
                    return {"success": False, "message": "会议不存在或无权限访问"}

                slides_id = f"slides_{meeting_id}"
                status = slides_status.get(slides_id)
                if status:
                    if status.get("status") == "processing":
                        preview_url, export_urls, image_urls = _detect_existing_assets(meeting_id)
                        if preview_url or export_urls or image_urls:
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
                    status["meeting_id"] = meeting_id
                else:
                    preview_url, export_urls, image_urls = _detect_existing_assets(meeting_id)
                    status = (
                        _status_payload(
                            "completed",
                            100,
                            "已生成",
                            preview_url=preview_url,
                            export_urls=export_urls,
                            image_urls=image_urls,
                            log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
                        )
                        if preview_url or export_urls or image_urls
                        else _status_payload(
                            "idle",
                            0,
                            "未生成",
                            log_url=f"/api/v1/meetings/{meeting_id}/slides/logs",
                        )
                    )
                    status["meeting_id"] = meeting_id

                return {
                    "success": True,
                    "message": status.get("message", "已获取状态"),
                    "data": {"slides": status, "meeting_id": meeting_id},
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


ToolRegistry.register(GenerateSlidesTool())
ToolRegistry.register(SlidesStatusTool())
