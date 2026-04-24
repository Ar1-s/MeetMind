from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db


# --- Schemas ---

class CreateProjectSchema(BaseModel):
    name: Optional[str] = Field(None, description="项目名称")
    description: Optional[str] = Field(None, description="项目描述")
    start_date: Optional[str] = Field(None, description="开始日期 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="结束日期 (YYYY-MM-DD)")


class ListProjectsSchema(BaseModel):
    status: Optional[str] = Field(None, description="项目状态 (planning, active, on_hold, done)")


class CreateObjectiveSchema(BaseModel):
    project_id: str = Field(..., description="项目ID")
    title: str = Field(..., description="目标标题")
    description: Optional[str] = Field(None, description="目标描述")


class CreateKeyResultSchema(BaseModel):
    objective_id: str = Field(..., description="目标ID")
    title: str = Field(..., description="关键结果标题")
    target_value: float = Field(1, description="目标值")
    unit: Optional[str] = Field(None, description="单位 (%, 个, 次 等)")


class GetProjectOkrSchema(BaseModel):
    project_id: str = Field(..., description="项目ID")


class GenerateOkrFromMeetingSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")


# --- Tools ---

class CreateProjectTool(BaseTool):
    name = "create_project"
    description = "创建项目"
    args_schema = CreateProjectSchema

    async def run(self, name: str = None, description: str = None, start_date: str = None, end_date: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        if not name:
            return {
                "success": True,
                "require_input": True,
                "form_type": "create_project",
                "message": "请填写项目信息",
                "fields": [
                    {"name": "name", "label": "项目名称", "type": "text", "required": True},
                    {"name": "description", "label": "项目描述", "type": "textarea", "required": False},
                    {"name": "start_date", "label": "开始日期", "type": "date", "required": False},
                    {"name": "end_date", "label": "结束日期", "type": "date", "required": False},
                ]
            }

        async for db in get_db():
            try:
                from datetime import date
                from app.models.project import Project

                parsed_start = date.fromisoformat(start_date) if start_date else None
                parsed_end = date.fromisoformat(end_date) if end_date else None

                project = Project(
                    name=name,
                    description=description,
                    start_date=parsed_start,
                    end_date=parsed_end,
                    created_by=user_id,
                )
                db.add(project)
                await db.commit()
                await db.refresh(project)

                return {
                    "success": True,
                    "message": f"项目 '{name}' 已创建",
                    "data": {
                        "project": {
                            "id": project.id,
                            "name": project.name,
                            "status": project.status,
                        }
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class ListProjectsTool(BaseTool):
    name = "list_projects"
    description = "列出项目及进度"
    args_schema = ListProjectsSchema

    async def run(self, status: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from sqlalchemy.orm import selectinload
                from app.models.project import Project

                sql = select(Project).options(
                    selectinload(Project.objectives)
                ).where(Project.created_by == user_id)
                if status:
                    sql = sql.where(Project.status == status)

                result = await db.execute(sql)
                projects = result.scalars().all()

                projects_list = []
                for p in projects:
                    # Calculate progress from key results
                    total_kr = 0
                    completed_kr = 0
                    for obj in p.objectives:
                        # Need to load key_results separately since nested eager load may not work
                        from sqlalchemy import select as sel
                        from app.models.key_result import KeyResult
                        kr_result = await db.execute(
                            sel(KeyResult).where(KeyResult.objective_id == obj.id)
                        )
                        krs = kr_result.scalars().all()
                        for kr in krs:
                            total_kr += 1
                            if kr.current_value >= kr.target_value:
                                completed_kr += 1

                    progress = round(completed_kr / total_kr * 100) if total_kr > 0 else 0
                    projects_list.append({
                        "id": p.id,
                        "name": p.name,
                        "status": p.status,
                        "start_date": p.start_date.isoformat() if p.start_date else None,
                        "end_date": p.end_date.isoformat() if p.end_date else None,
                        "objectives_count": len(p.objectives),
                        "progress": progress,
                    })

                return {
                    "success": True,
                    "message": f"找到 {len(projects_list)} 个项目",
                    "data": {"projects": projects_list}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class CreateObjectiveTool(BaseTool):
    name = "create_objective"
    description = "为项目添加目标 (Objective)"
    args_schema = CreateObjectiveSchema

    async def run(self, project_id: str, title: str, description: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.project import Project
                from app.models.objective import Objective

                project = await db.get(Project, project_id)
                if not project or (user_id and project.created_by != user_id):
                    return {"success": False, "message": "项目不存在或无权限访问"}

                objective = Objective(
                    project_id=project_id,
                    title=title,
                    description=description,
                )
                db.add(objective)
                await db.commit()
                await db.refresh(objective)

                return {
                    "success": True,
                    "message": f"目标 '{title}' 已添加到项目 '{project.name}'",
                    "data": {
                        "objective": {
                            "id": objective.id,
                            "title": objective.title,
                            "project_id": project_id,
                        }
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class CreateKeyResultTool(BaseTool):
    name = "create_key_result"
    description = "为目标添加关键结果 (Key Result)"
    args_schema = CreateKeyResultSchema

    async def run(self, objective_id: str, title: str, target_value: float = 1, unit: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from app.models.objective import Objective
                from app.models.key_result import KeyResult

                objective = await db.get(Objective, objective_id)
                if not objective:
                    return {"success": False, "message": "目标不存在"}

                # Verify project ownership
                from app.models.project import Project
                project = await db.get(Project, objective.project_id)
                if not project or (user_id and project.created_by != user_id):
                    return {"success": False, "message": "无权限访问该目标"}

                kr = KeyResult(
                    objective_id=objective_id,
                    title=title,
                    target_value=target_value,
                    unit=unit,
                )
                db.add(kr)
                await db.commit()
                await db.refresh(kr)

                return {
                    "success": True,
                    "message": f"关键结果 '{title}' 已添加",
                    "data": {
                        "key_result": {
                            "id": kr.id,
                            "title": kr.title,
                            "target_value": kr.target_value,
                            "unit": kr.unit,
                            "objective_id": objective_id,
                        }
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class GetProjectOkrTool(BaseTool):
    name = "get_project_okr"
    description = "获取项目完整 OKR 树"
    args_schema = GetProjectOkrSchema

    async def run(self, project_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from sqlalchemy.orm import selectinload
                from app.models.project import Project

                result = await db.execute(
                    select(Project)
                    .options(selectinload(Project.objectives))
                    .where(Project.id == project_id)
                )
                project = result.scalar_one_or_none()
                if not project or (user_id and project.created_by != user_id):
                    return {"success": False, "message": "项目不存在或无权限访问"}

                objectives_data = []
                for obj in project.objectives:
                    from app.models.key_result import KeyResult
                    kr_result = await db.execute(
                        select(KeyResult).where(KeyResult.objective_id == obj.id)
                    )
                    krs = kr_result.scalars().all()

                    objectives_data.append({
                        "id": obj.id,
                        "title": obj.title,
                        "description": obj.description,
                        "status": obj.status,
                        "key_results": [
                            {
                                "id": kr.id,
                                "title": kr.title,
                                "current_value": kr.current_value,
                                "target_value": kr.target_value,
                                "unit": kr.unit,
                                "progress": round(kr.current_value / kr.target_value * 100) if kr.target_value else 0,
                                "status": kr.status,
                            }
                            for kr in krs
                        ]
                    })

                return {
                    "success": True,
                    "message": f"项目 '{project.name}' 的 OKR",
                    "data": {
                        "project": {
                            "id": project.id,
                            "name": project.name,
                            "status": project.status,
                            "objectives": objectives_data,
                        }
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class GenerateOkrFromMeetingTool(BaseTool):
    name = "generate_okr_from_meeting"
    description = "从会议纪要自动生成 OKR"
    args_schema = GenerateOkrFromMeetingSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from sqlalchemy.orm import selectinload
                from app.models.meeting import Meeting
                from app.models.project import Project
                from app.models.objective import Objective
                from app.models.key_result import KeyResult
                from app.services.ai import get_ai_service

                result = await db.execute(
                    select(Meeting)
                    .options(selectinload(Meeting.summary))
                    .where(Meeting.id == meeting_id)
                )
                meeting = result.scalar_one_or_none()
                if not meeting or (user_id and meeting.created_by != user_id):
                    return {"success": False, "message": "会议不存在或无权限访问"}

                if not meeting.summary:
                    return {"success": False, "message": "该会议尚未生成纪要，请先分析会议"}

                summary_data = {
                    "summary": meeting.summary.content if hasattr(meeting.summary, 'content') else str(meeting.summary),
                }

                ai = get_ai_service()
                okr_data = await ai.generate_okr(meeting.title, summary_data)

                # Create project and OKR structure
                project = Project(
                    name=okr_data.get("project_name", f"{meeting.title} - OKR"),
                    description=okr_data.get("description", f"从会议「{meeting.title}」自动生成"),
                    created_by=user_id,
                )
                db.add(project)
                await db.flush()

                objectives_created = []
                for obj_data in okr_data.get("objectives", []):
                    obj = Objective(
                        project_id=project.id,
                        title=obj_data.get("title", ""),
                        description=obj_data.get("description"),
                    )
                    db.add(obj)
                    await db.flush()

                    krs_created = []
                    for kr_data in obj_data.get("key_results", []):
                        kr = KeyResult(
                            objective_id=obj.id,
                            title=kr_data.get("title", ""),
                            target_value=kr_data.get("target_value", 1),
                            unit=kr_data.get("unit"),
                        )
                        db.add(kr)
                        krs_created.append({"title": kr.title, "target_value": kr.target_value, "unit": kr.unit})

                    objectives_created.append({
                        "title": obj.title,
                        "key_results": krs_created,
                    })

                await db.commit()

                return {
                    "success": True,
                    "message": f"已从会议「{meeting.title}」生成 OKR",
                    "data": {
                        "project": {
                            "id": project.id,
                            "name": project.name,
                            "objectives": objectives_created,
                        }
                    }
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


# Register tools
ToolRegistry.register(CreateProjectTool())
ToolRegistry.register(ListProjectsTool())
ToolRegistry.register(CreateObjectiveTool())
ToolRegistry.register(CreateKeyResultTool())
ToolRegistry.register(GetProjectOkrTool())
ToolRegistry.register(GenerateOkrFromMeetingTool())
