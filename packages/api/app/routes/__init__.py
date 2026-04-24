from __future__ import annotations
from app.routes.meetings import router as meetings_router
from app.routes.recordings import router as recordings_router
from app.routes.tasks import router as tasks_router
from app.routes.assistant import router as assistant_router
from app.routes.analysis import router as analysis_router
from app.routes.integrations import router as integrations_router
from app.routes.auth import router as auth_router
from app.routes.memory import router as memory_router
from app.routes.agents import router as agents_router
from app.routes.translate import router as translate_router
from app.routes.projects import router as projects_router

__all__ = [
    "meetings_router",
    "recordings_router",
    "tasks_router",
    "assistant_router",
    "analysis_router",
    "integrations_router",
    "auth_router",
    "memory_router",
    "agents_router",
    "translate_router",
    "projects_router",
]
