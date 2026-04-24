from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "active"
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ObjectiveCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "on_track"


class ObjectiveUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class KeyResultCreate(BaseModel):
    title: str
    current_value: float = 0
    target_value: float = 1
    unit: Optional[str] = None
    status: str = "on_track"


class KeyResultUpdate(BaseModel):
    title: Optional[str] = None
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    unit: Optional[str] = None
    status: Optional[str] = None


class KeyResultResponse(BaseModel):
    id: str
    objective_id: str
    title: str
    current_value: float
    target_value: float
    unit: Optional[str] = None
    status: str
    progress: float
    linked_task_count: int = 0
    completed_task_count: int = 0
    progress_source: str = "manual"
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ObjectiveResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str
    progress: float
    key_results: list[KeyResultResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    progress: float
    objective_count: int
    key_result_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    progress: float
    objectives: list[ObjectiveResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
