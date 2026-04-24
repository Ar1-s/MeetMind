from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timezone, date

from app.models.database import get_db
from app.models.task import Task
from app.models.meeting import Meeting
from app.models.user import User
from app.models.key_result import KeyResult
from app.models.objective import Objective
from app.models.project import Project
from app.dependencies import get_current_user
from app.services.project_progress import get_key_result_progress_snapshot
from app.services.participant_privacy import build_participant_context, transform_task_payload
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskComplete,
    TaskResponse,
    TaskBoardResponse,
    TaskStatistics,
    SourceMeeting,
)

router = APIRouter()


def task_to_dict(t: Task) -> dict:
    """Serialize a Task ORM object to a dictionary."""
    payload = {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "assignee": t.assignee,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "priority": t.priority,
        "status": t.status,
        "source_meeting_id": t.source_meeting_id,
        "key_result_id": t.key_result_id,
        "source_segment_start": t.source_segment_start,
        "source_segment_end": t.source_segment_end,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }
    if t.source_meeting:
        payload = transform_task_payload(
            payload,
            build_participant_context(t.source_meeting).get("replacement_map"),
        )
    return payload


async def _load_task_with_source_meeting(db: AsyncSession, task_id: str) -> Task:
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.source_meeting),
            selectinload(Task.key_result).selectinload(KeyResult.tasks),
            selectinload(Task.key_result).selectinload(KeyResult.objective).selectinload(Objective.project),
        )
    )
    return result.scalar_one()


def _build_task_response(task: Task) -> TaskResponse:
    payload = task_to_dict(task)
    source_meeting = None
    if task.source_meeting:
        source_meeting = SourceMeeting(
            meeting_id=task.source_meeting.id,
            title=task.source_meeting.title,
            date=task.source_meeting.start_time.date() if task.source_meeting.start_time else None,
        )

    okr = None
    if task.key_result and task.key_result.objective and task.key_result.objective.project:
        kr = task.key_result
        obj = kr.objective
        proj = obj.project
        snapshot = get_key_result_progress_snapshot(kr)
        okr = {
            "project_id": proj.id,
            "project_name": proj.name,
            "objective_id": obj.id,
            "objective_title": obj.title,
            "key_result_id": kr.id,
            "key_result_title": kr.title,
            "progress": snapshot.progress,
        }

    return TaskResponse(
        id=payload["id"],
        title=payload["title"],
        description=payload["description"],
        assignee=payload["assignee"],
        due_date=task.due_date,
        priority=task.priority,
        status=task.status,
        source_meeting=source_meeting,
        key_result_id=task.key_result_id,
        okr=okr,
        source_segment_start=task.source_segment_start,
        source_segment_end=task.source_segment_end,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
    )


@router.get("/related")
async def get_related_tasks(
    project_id: Optional[str] = Query(None),
    exclude_meeting_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取同项目下其他会议的未完成任务"""
    if not project_id:
        return []

    query = select(Task).where(
        Task.created_by == current_user.id,
        Task.status != "done",
    ).options(selectinload(Task.source_meeting))

    # Filter by project: tasks linked to meetings in the same project
    meeting_ids_query = select(Meeting.id).where(
        Meeting.project_id == project_id,
        Meeting.created_by == current_user.id,
    )
    if exclude_meeting_id:
        meeting_ids_query = meeting_ids_query.where(Meeting.id != exclude_meeting_id)

    query = query.where(Task.source_meeting_id.in_(meeting_ids_query))
    query = query.order_by(Task.created_at.desc()).limit(20)

    result = await db.execute(query)
    tasks = result.scalars().all()
    return [task_to_dict(t) for t in tasks]


@router.get("/board", response_model=TaskBoardResponse)
async def get_task_board(
    view: str = Query("kanban"),
    assignee: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    meeting_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取任务看板"""
    query = (
        select(Task)
        .where(Task.created_by == current_user.id)
        .options(
            selectinload(Task.source_meeting),
            selectinload(Task.key_result).selectinload(KeyResult.tasks),
            selectinload(Task.key_result).selectinload(KeyResult.objective).selectinload(Objective.project),
        )
        .order_by(Task.created_at.desc())
    )
    
    if assignee:
        query = query.where(Task.assignee == assignee)
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if meeting_id:
        query = query.where(Task.source_meeting_id == meeting_id)
    
    result = await db.execute(query)
    tasks = result.scalars().all()

    # Calculate statistics
    all_tasks_result = await db.execute(select(Task).where(Task.created_by == current_user.id))
    all_tasks = all_tasks_result.scalars().all()
    
    today = date.today()
    stats = TaskStatistics(
        total_tasks=len(all_tasks),
        todo_count=sum(1 for t in all_tasks if t.status == "todo"),
        in_progress_count=sum(1 for t in all_tasks if t.status == "in_progress"),
        done_count=sum(1 for t in all_tasks if t.status == "done"),
        overdue_count=sum(1 for t in all_tasks if t.due_date and t.due_date < today and t.status != "done"),
    )
    
    # Build response
    task_responses = [_build_task_response(task) for task in tasks]
    
    return TaskBoardResponse(tasks=task_responses, statistics=stats)


@router.post("", response_model=TaskResponse, status_code=201)
async def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建任务"""
    db_task = Task(
        created_by=current_user.id,
        title=task.title,
        description=task.description,
        assignee=task.assignee,
        due_date=task.due_date,
        priority=task.priority,
        source_meeting_id=task.source_meeting_id,
        key_result_id=task.key_result_id,
        source_segment_start=task.source_segment_start,
        source_segment_end=task.source_segment_end,
    )
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    
    db_task = await _load_task_with_source_meeting(db, db_task.id)
    return _build_task_response(db_task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新任务"""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.created_by == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    if "status" in update_data:
        if task.status == "done":
            task.completed_at = datetime.now(timezone.utc)
        elif task.completed_at is not None:
            task.completed_at = None
    
    await db.commit()
    await db.refresh(task)
    
    task = await _load_task_with_source_meeting(db, task.id)
    return _build_task_response(task)


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: str,
    complete_data: TaskComplete,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """完成任务并填写结果"""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.created_by == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = "done"
    task.completed_at = datetime.now(timezone.utc)
    task.result_description = complete_data.result_description
    
    await db.commit()
    await db.refresh(task)
    
    task = await _load_task_with_source_meeting(db, task.id)
    return _build_task_response(task)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除任务"""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.created_by == current_user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.delete(task)
    await db.commit()
