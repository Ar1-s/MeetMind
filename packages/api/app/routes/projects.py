from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.models.database import get_db
from app.models.project import Project
from app.models.objective import Objective
from app.models.key_result import KeyResult
from app.models.summary import Summary
from app.models.task import Task
from datetime import datetime, timezone
from app.models.meeting import Meeting
from app.models.user import User
from app.dependencies import get_current_user
from app.services.ai import get_ai_service
from app.services.project_progress import get_key_result_progress_snapshot
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ObjectiveCreate,
    ObjectiveUpdate,
    ObjectiveResponse,
    KeyResultCreate,
    KeyResultUpdate,
    KeyResultResponse,
)

router = APIRouter()


def _build_key_result_response(kr: KeyResult) -> KeyResultResponse:
    snapshot = get_key_result_progress_snapshot(kr)
    return KeyResultResponse(
        id=kr.id,
        objective_id=kr.objective_id,
        title=kr.title,
        current_value=snapshot.current_value,
        target_value=snapshot.target_value,
        unit=snapshot.unit,
        status=snapshot.status,
        progress=snapshot.progress,
        linked_task_count=snapshot.linked_task_count,
        completed_task_count=snapshot.completed_task_count,
        progress_source=snapshot.progress_source,
        created_at=kr.created_at,
        updated_at=kr.updated_at,
    )


def _build_objective_response(obj: Objective) -> ObjectiveResponse:
    key_results = obj.key_results or []
    kr_responses = [_build_key_result_response(kr) for kr in key_results]
    if key_results:
        progress = round(sum(kr.progress for kr in kr_responses) / len(kr_responses), 1)
    else:
        progress = 0.0
    return ObjectiveResponse(
        id=obj.id,
        project_id=obj.project_id,
        title=obj.title,
        description=obj.description,
        status=obj.status,
        progress=progress,
        key_results=kr_responses,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )


def _build_project_response(project: Project) -> ProjectResponse:
    objectives = project.objectives or []
    obj_responses = [_build_objective_response(obj) for obj in objectives]
    if obj_responses:
        progress = round(sum(obj.progress for obj in obj_responses) / len(obj_responses), 1)
    else:
        progress = 0.0
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        start_date=project.start_date,
        end_date=project.end_date,
        progress=progress,
        objectives=obj_responses,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


PROJECT_RELATIONS = (
    selectinload(Project.objectives)
    .selectinload(Objective.key_results)
    .selectinload(KeyResult.tasks)
)


def _normalize_title(text: str) -> str:
    return "".join(ch.lower() for ch in text if ch.isalnum())


@router.post("/from-meeting", response_model=ProjectResponse, status_code=201)
async def create_project_from_meeting(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    meeting_id = payload.get("meeting_id")
    if not meeting_id:
        raise HTTPException(status_code=400, detail="meeting_id required")

    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.created_by == current_user.id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.project_id:
        existing_project_result = await db.execute(
            select(Project)
            .where(Project.id == meeting.project_id, Project.created_by == current_user.id)
            .options(PROJECT_RELATIONS)
        )
        existing_project = existing_project_result.scalar_one_or_none()
        if existing_project:
            return _build_project_response(existing_project)

    summary_result = await db.execute(
        select(Summary).where(Summary.meeting_id == meeting_id)
    )
    summary = summary_result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found")

    summary_payload = {
        "abstract": summary.abstract,
        "decisions": summary.decisions or [],
        "risks": summary.risks or [],
        "action_items": summary.action_items or [],
    }

    ai = get_ai_service()
    try:
        okr_plan = await ai.generate_okr(meeting.title, summary_payload)
    except Exception:
        okr_plan = {
            "project_name": meeting.title or "会议 OKR",
            "project_description": summary.abstract or "",
            "objectives": [
                {
                    "title": "推进会议目标",
                    "description": summary.abstract or "",
                    "key_results": [
                        {
                            "title": item.get("title") if isinstance(item, dict) else str(item),
                            "target_value": 1,
                            "unit": None,
                            "linked_action_titles": [
                                item.get("title") if isinstance(item, dict) else str(item)
                            ],
                        }
                        for item in (summary.action_items or [])[:4]
                    ],
                }
            ],
        }

    project_name = okr_plan.get("project_name") or meeting.title or "会议 OKR"
    db_project = Project(
        created_by=current_user.id,
        name=project_name,
        description=okr_plan.get("project_description") or summary.abstract,
        status="active",
    )
    db.add(db_project)
    await db.flush()
    meeting.project_id = db_project.id

    created_krs: list[tuple[KeyResult, list[str]]] = []
    for obj in okr_plan.get("objectives", [])[:3]:
        db_objective = Objective(
            project_id=db_project.id,
            title=obj.get("title") or "目标",
            description=obj.get("description"),
            status="on_track",
        )
        db.add(db_objective)
        await db.flush()

        for kr in obj.get("key_results", [])[:4]:
            target_value = kr.get("target_value") or 1
            try:
                target_value = float(target_value)
            except Exception:
                target_value = 1
            if target_value <= 0:
                target_value = 1
            db_kr = KeyResult(
                objective_id=db_objective.id,
                title=kr.get("title") or "关键结果",
                current_value=0,
                target_value=target_value,
                unit=kr.get("unit"),
                status="on_track",
            )
            db.add(db_kr)
            created_krs.append((db_kr, kr.get("linked_action_titles") or []))

    await db.commit()

    # Link meeting tasks to key results using action titles
    task_result = await db.execute(
        select(Task).where(Task.created_by == current_user.id, Task.source_meeting_id == meeting_id)
    )
    meeting_tasks = task_result.scalars().all()
    if meeting_tasks and created_krs:
        task_map = {_normalize_title(t.title): t for t in meeting_tasks}
        for kr, action_titles in created_krs:
            for title in action_titles:
                norm = _normalize_title(title or "")
                if norm and norm in task_map:
                    task_map[norm].key_result_id = kr.id
            # Fallback: link by similar substring if no action titles matched
            if not action_titles:
                for t in meeting_tasks:
                    if _normalize_title(kr.title) in _normalize_title(t.title):
                        t.key_result_id = kr.id
        await db.commit()

    # Reload project with objectives and key results
    project_result = await db.execute(
        select(Project)
        .where(Project.id == db_project.id)
        .options(PROJECT_RELATIONS)
    )
    project = project_result.scalar_one()
    return _build_project_response(project)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.created_by == current_user.id)
        .options(PROJECT_RELATIONS)
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return [_build_project_response(project) for project in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.created_by == current_user.id)
        .options(PROJECT_RELATIONS)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _build_project_response(project)


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    db_project = Project(
        created_by=current_user.id,
        name=project.name,
        description=project.description,
        status=project.status,
        start_date=project.start_date,
        end_date=project.end_date,
    )
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    result = await db.execute(
        select(Project)
        .where(Project.id == db_project.id)
        .options(PROJECT_RELATIONS)
    )
    created = result.scalar_one()
    return _build_project_response(created)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.created_by == current_user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    await db.commit()
    result = await db.execute(
        select(Project)
        .where(Project.id == project.id)
        .options(PROJECT_RELATIONS)
    )
    updated = result.scalar_one()
    return _build_project_response(updated)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.created_by == current_user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.post("/{project_id}/objectives", response_model=ObjectiveResponse, status_code=201)
async def create_objective(
    project_id: str,
    objective: ObjectiveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project_result = await db.execute(
        select(Project).where(Project.id == project_id, Project.created_by == current_user.id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db_objective = Objective(
        project_id=project_id,
        title=objective.title,
        description=objective.description,
        status=objective.status,
    )
    db.add(db_objective)
    await db.commit()
    result = await db.execute(
        select(Objective)
        .where(Objective.id == db_objective.id)
        .options(selectinload(Objective.key_results).selectinload(KeyResult.tasks))
    )
    created = result.scalar_one()
    return _build_objective_response(created)


@router.patch("/objectives/{objective_id}", response_model=ObjectiveResponse)
async def update_objective(
    objective_id: str,
    objective_update: ObjectiveUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Objective)
        .join(Project)
        .where(Objective.id == objective_id, Project.created_by == current_user.id)
        .options(selectinload(Objective.key_results).selectinload(KeyResult.tasks))
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")
    update_data = objective_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(objective, field, value)
    await db.commit()
    refreshed = await db.execute(
        select(Objective)
        .where(Objective.id == objective.id)
        .options(selectinload(Objective.key_results).selectinload(KeyResult.tasks))
    )
    return _build_objective_response(refreshed.scalar_one())


@router.delete("/objectives/{objective_id}", status_code=204)
async def delete_objective(
    objective_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Objective)
        .join(Project)
        .where(Objective.id == objective_id, Project.created_by == current_user.id)
    )
    objective = result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")
    await db.delete(objective)
    await db.commit()


@router.post("/objectives/{objective_id}/key-results", response_model=KeyResultResponse, status_code=201)
async def create_key_result(
    objective_id: str,
    key_result: KeyResultCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    objective_result = await db.execute(
        select(Objective)
        .join(Project)
        .where(Objective.id == objective_id, Project.created_by == current_user.id)
    )
    objective = objective_result.scalar_one_or_none()
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")
    db_key_result = KeyResult(
        objective_id=objective_id,
        title=key_result.title,
        current_value=key_result.current_value,
        target_value=key_result.target_value,
        unit=key_result.unit,
        status=key_result.status,
    )
    db.add(db_key_result)
    await db.commit()
    created = await db.execute(
        select(KeyResult)
        .where(KeyResult.id == db_key_result.id)
        .options(selectinload(KeyResult.tasks))
    )
    return _build_key_result_response(created.scalar_one())


@router.patch("/key-results/{key_result_id}", response_model=KeyResultResponse)
async def update_key_result(
    key_result_id: str,
    key_result_update: KeyResultUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KeyResult)
        .join(Objective)
        .join(Project)
        .where(KeyResult.id == key_result_id, Project.created_by == current_user.id)
        .options(selectinload(KeyResult.tasks))
    )
    key_result = result.scalar_one_or_none()
    if not key_result:
        raise HTTPException(status_code=404, detail="Key result not found")
    update_data = key_result_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(key_result, field, value)
    await db.commit()
    await db.refresh(key_result)
    snapshot = get_key_result_progress_snapshot(key_result)
    should_complete = key_result.status == "completed"
    if not should_complete and snapshot.progress_source == "manual":
        should_complete = snapshot.status == "completed"

    if should_complete:
        task_result = await db.execute(
            select(Task).where(Task.key_result_id == key_result.id, Task.created_by == current_user.id)
        )
        tasks = task_result.scalars().all()
        updated = False
        for task in tasks:
            if task.status != "done":
                task.status = "done"
                task.completed_at = datetime.now(timezone.utc)
                updated = True
        if updated:
            await db.commit()
    refreshed = await db.execute(
        select(KeyResult)
        .where(KeyResult.id == key_result.id)
        .options(selectinload(KeyResult.tasks))
    )
    return _build_key_result_response(refreshed.scalar_one())


@router.delete("/key-results/{key_result_id}", status_code=204)
async def delete_key_result(
    key_result_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KeyResult)
        .join(Objective)
        .join(Project)
        .where(KeyResult.id == key_result_id, Project.created_by == current_user.id)
    )
    key_result = result.scalar_one_or_none()
    if not key_result:
        raise HTTPException(status_code=404, detail="Key result not found")
    await db.delete(key_result)
    await db.commit()
