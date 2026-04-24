from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from app.tools.base import BaseTool
from app.tools.registry import ToolRegistry
from app.models.database import get_db

class ImportTasksSchema(BaseModel):
    meeting_id: str = Field(..., description="会议ID")

class ImportTasksTool(BaseTool):
    name = "import_tasks"
    description = "从会议中提取任务并导入到任务看板"
    args_schema = ImportTasksSchema

    async def run(self, meeting_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        """从会议导入任务"""
        async for db in get_db():
            try:
                from app.services.ai_analysis import get_meeting_tasks
                from app.models.task import Task
                from app.models.meeting import Meeting
                
                # Extract
                tasks_data = await get_meeting_tasks(meeting_id, db)
                
                if not tasks_data:
                    return {
                        "success": True,
                        "message": "未从会议中提取到新任务",
                        "data": {"count": 0}
                    }
                
                # Resolve created_by from meeting if available, fallback to user_id
                owner_id = user_id
                if meeting_id and not owner_id:
                    meeting = await db.get(Meeting, meeting_id)
                    owner_id = meeting.created_by if meeting else None

                # Save
                count = 0
                for t in tasks_data:
                    new_task = Task(
                        created_by=owner_id,
                        title=t.get('title', 'Untitled'),
                        description=t.get('description'),
                        assignee=t.get('assignee'),
                        due_date=t.get('due_date'),
                        priority=t.get('priority', 'medium'),
                        source_meeting_id=meeting_id,
                        status='todo'
                    )
                    db.add(new_task)
                    count += 1
                
                await db.commit()
                
                return {
                    "success": True,
                    "message": f"成功提取并导入 {count} 个任务",
                    "data": {"count": count, "tasks": tasks_data}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break

class QueryTasksSchema(BaseModel):
    status: Optional[str] = Field(None, description="任务状态 (todo, done, in_progress)")
    limit: int = Field(10, description="数量限制")

class QueryTasksTool(BaseTool):
    name = "query_tasks"
    description = "查询当前任务列表"
    args_schema = QueryTasksSchema
    
    async def run(self, status: str = None, limit: int = 10, user_id: str = None, **kwargs) -> Dict[str, Any]:
        """查询任务"""
        async for db in get_db():
            try:
                from sqlalchemy import select
                from app.models.task import Task
                
                sql = select(Task)
                if user_id:
                    sql = sql.where(Task.created_by == user_id)
                if status:
                    sql = sql.where(Task.status == status)
                
                sql = sql.limit(limit)
                result = await db.execute(sql)
                tasks = result.scalars().all()
                
                tasks_list = []
                for t in tasks:
                    tasks_list.append({
                        "id": t.id,
                        "title": t.title,
                        "status": t.status,
                        "priority": t.priority,
                        "assignee": t.assignee,
                        "due_date": t.due_date.isoformat() if t.due_date else None
                    })
                
                return {
                     "success": True,
                     "message": f"找到 {len(tasks_list)} 个任务",
                     "data": {"tasks": tasks_list}
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break

ToolRegistry.register(ImportTasksTool())
ToolRegistry.register(QueryTasksTool())


class CreateTaskSchema(BaseModel):
    title: Optional[str] = Field(None, description="任务标题")
    description: Optional[str] = Field(None, description="任务描述")
    assignee: Optional[str] = Field(None, description="负责人")
    due_date: Optional[str] = Field(None, description="截止日期 (YYYY-MM-DD)")
    priority: str = Field("medium", description="优先级 (low, medium, high)")
    source_meeting_id: Optional[str] = Field(None, description="来源会议ID")


class UpdateTaskSchema(BaseModel):
    task_id: str = Field(..., description="任务ID")
    title: Optional[str] = Field(None, description="任务标题")
    description: Optional[str] = Field(None, description="任务描述")
    assignee: Optional[str] = Field(None, description="负责人")
    due_date: Optional[str] = Field(None, description="截止日期 (YYYY-MM-DD)")
    priority: Optional[str] = Field(None, description="优先级 (low, medium, high)")
    status: Optional[str] = Field(None, description="状态 (todo, in_progress, done)")


class CompleteTaskSchema(BaseModel):
    task_id: str = Field(..., description="任务ID")
    result_description: Optional[str] = Field(None, description="完成说明")


class DeleteTaskSchema(BaseModel):
    task_id: str = Field(..., description="任务ID")


class TaskBoardSchema(BaseModel):
    status: Optional[str] = Field(None, description="任务状态 (todo, done, in_progress)")
    assignee: Optional[str] = Field(None, description="负责人")
    priority: Optional[str] = Field(None, description="优先级 (low, medium, high)")
    meeting_id: Optional[str] = Field(None, description="会议ID")


class CreateTaskTool(BaseTool):
    name = "create_task"
    description = "创建任务"
    args_schema = CreateTaskSchema

    async def run(self, title: str = None, description: str = None, assignee: str = None, due_date: str = None, priority: str = "medium", source_meeting_id: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        if not title:
            return {"success": False, "message": "请提供任务标题"}
        async for db in get_db():
            try:
                from datetime import date
                from app.models.task import Task

                parsed_due = None
                if due_date:
                    parsed_due = date.fromisoformat(due_date)

                new_task = Task(
                    created_by=user_id,
                    title=title,
                    description=description,
                    assignee=assignee,
                    due_date=parsed_due,
                    priority=priority or "medium",
                    source_meeting_id=source_meeting_id,
                    status="todo",
                )
                db.add(new_task)
                await db.commit()
                await db.refresh(new_task)

                return {
                    "success": True,
                    "message": "任务已创建",
                    "data": {
                        "tasks": [
                            {
                                "id": new_task.id,
                                "title": new_task.title,
                                "status": new_task.status,
                                "priority": new_task.priority,
                                "assignee": new_task.assignee,
                                "due_date": new_task.due_date.isoformat() if new_task.due_date else None,
                            }
                        ]
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class UpdateTaskTool(BaseTool):
    name = "update_task"
    description = "更新任务信息或状态"
    args_schema = UpdateTaskSchema

    async def run(self, task_id: str, title: str = None, description: str = None, assignee: str = None, due_date: str = None, priority: str = None, status: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from datetime import date
                from sqlalchemy import select
                from app.models.task import Task

                result = await db.execute(
                    select(Task).where(Task.id == task_id, Task.created_by == user_id)
                )
                task = result.scalar_one_or_none()
                if not task:
                    return {"success": False, "message": "任务不存在或无权限访问"}

                if title is not None:
                    task.title = title
                if description is not None:
                    task.description = description
                if assignee is not None:
                    task.assignee = assignee
                if due_date is not None:
                    task.due_date = date.fromisoformat(due_date) if due_date else None
                if priority is not None:
                    task.priority = priority
                if status is not None:
                    task.status = status

                await db.commit()
                await db.refresh(task)

                return {
                    "success": True,
                    "message": "任务已更新",
                    "data": {
                        "tasks": [
                            {
                                "id": task.id,
                                "title": task.title,
                                "status": task.status,
                                "priority": task.priority,
                                "assignee": task.assignee,
                                "due_date": task.due_date.isoformat() if task.due_date else None,
                            }
                        ]
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class CompleteTaskTool(BaseTool):
    name = "complete_task"
    description = "完成任务"
    args_schema = CompleteTaskSchema

    async def run(self, task_id: str, result_description: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from datetime import datetime, timezone
                from app.models.task import Task

                result = await db.execute(
                    select(Task).where(Task.id == task_id, Task.created_by == user_id)
                )
                task = result.scalar_one_or_none()
                if not task:
                    return {"success": False, "message": "任务不存在或无权限访问"}

                task.status = "done"
                task.completed_at = datetime.now(timezone.utc)
                task.result_description = result_description

                await db.commit()
                await db.refresh(task)

                return {
                    "success": True,
                    "message": "任务已完成",
                    "data": {
                        "tasks": [
                            {
                                "id": task.id,
                                "title": task.title,
                                "status": task.status,
                                "priority": task.priority,
                                "assignee": task.assignee,
                                "due_date": task.due_date.isoformat() if task.due_date else None,
                            }
                        ]
                    },
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class DeleteTaskTool(BaseTool):
    name = "delete_task"
    description = "删除任务"
    args_schema = DeleteTaskSchema

    async def run(self, task_id: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from app.models.task import Task

                result = await db.execute(
                    select(Task).where(Task.id == task_id, Task.created_by == user_id)
                )
                task = result.scalar_one_or_none()
                if not task:
                    return {"success": False, "message": "任务不存在或无权限访问"}

                await db.delete(task)
                await db.commit()
                return {"success": True, "message": "任务已删除"}
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


class TaskBoardTool(BaseTool):
    name = "get_task_board"
    description = "获取任务看板（支持筛选）"
    args_schema = TaskBoardSchema

    async def run(self, status: str = None, assignee: str = None, priority: str = None, meeting_id: str = None, user_id: str = None, **kwargs) -> Dict[str, Any]:
        async for db in get_db():
            try:
                from sqlalchemy import select
                from app.models.task import Task

                sql = select(Task).where(Task.created_by == user_id)
                if assignee:
                    sql = sql.where(Task.assignee == assignee)
                if status:
                    sql = sql.where(Task.status == status)
                if priority:
                    sql = sql.where(Task.priority == priority)
                if meeting_id:
                    sql = sql.where(Task.source_meeting_id == meeting_id)

                result = await db.execute(sql)
                tasks = result.scalars().all()
                tasks_list = [
                    {
                        "id": t.id,
                        "title": t.title,
                        "status": t.status,
                        "priority": t.priority,
                        "assignee": t.assignee,
                        "due_date": t.due_date.isoformat() if t.due_date else None,
                    }
                    for t in tasks
                ]

                return {
                    "success": True,
                    "message": f"找到 {len(tasks_list)} 个任务",
                    "data": {"tasks": tasks_list},
                }
            except Exception as e:
                return {"success": False, "message": str(e)}
            break


ToolRegistry.register(CreateTaskTool())
ToolRegistry.register(UpdateTaskTool())
ToolRegistry.register(CompleteTaskTool())
ToolRegistry.register(DeleteTaskTool())
ToolRegistry.register(TaskBoardTool())
