from __future__ import annotations
from fastapi import FastAPI, HTTPException, Request, Response
from dotenv import load_dotenv
from pathlib import Path
from fastapi.responses import FileResponse, StreamingResponse
import mimetypes
import re

APP_DIR = Path(__file__).resolve().parent
API_ROOT = APP_DIR.parent
load_dotenv(API_ROOT / ".env", override=False)

from fastapi.middleware.cors import CORSMiddleware

from app.routes import meetings, recordings, tasks, assistant, analysis, integrations, auth, calendar, chats, calendar_feed, slides, memory, agents, translate, projects, preferences
from app.models.database import init_db

app = FastAPI(
    title="MeetMind API",
    description="MeetMind Backend API - 浼氳鍔╂墜鍚庣鏈嶅姟",
    version="0.1.0",
)

UPLOAD_ROOT = APP_DIR / "uploads"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


UPLOAD_ROOT_RESOLVED = UPLOAD_ROOT.resolve()
RANGE_HEADER_RE = re.compile(r"bytes=(\d*)-(\d*)")
UPLOAD_CHUNK_SIZE = 1024 * 1024


def resolve_upload_path(file_path: str) -> Path:
    candidate = (UPLOAD_ROOT / file_path).resolve()
    if UPLOAD_ROOT_RESOLVED not in candidate.parents and candidate != UPLOAD_ROOT_RESOLVED:
        raise HTTPException(status_code=404, detail="File not found")
    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return candidate


def iter_file_chunks(path: Path, start: int, end: int):
    with path.open("rb") as file_obj:
        file_obj.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            chunk = file_obj.read(min(UPLOAD_CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@app.api_route("/uploads/{file_path:path}", methods=["GET", "HEAD"])
async def serve_upload(file_path: str, request: Request):
    path = resolve_upload_path(file_path)
    file_size = path.stat().st_size
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    common_headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'inline; filename="{path.name}"',
    }

    range_header = request.headers.get("range")
    if not range_header:
        if request.method == "HEAD":
            return Response(status_code=200, headers={**common_headers, "Content-Length": str(file_size)})
        return FileResponse(path, media_type=media_type, headers=common_headers)

    match = RANGE_HEADER_RE.fullmatch(range_header.strip())
    if not match:
        return Response(
            status_code=416,
            headers={**common_headers, "Content-Range": f"bytes */{file_size}"},
        )

    start_text, end_text = match.groups()
    if start_text == "" and end_text == "":
        return Response(
            status_code=416,
            headers={**common_headers, "Content-Range": f"bytes */{file_size}"},
        )

    if start_text == "":
        suffix_length = int(end_text)
        if suffix_length <= 0:
            return Response(
                status_code=416,
                headers={**common_headers, "Content-Range": f"bytes */{file_size}"},
            )
        start = max(file_size - suffix_length, 0)
        end = file_size - 1
    else:
        start = int(start_text)
        end = int(end_text) if end_text else file_size - 1

    if start >= file_size or end < start:
        return Response(
            status_code=416,
            headers={**common_headers, "Content-Range": f"bytes */{file_size}"},
        )

    end = min(end, file_size - 1)
    content_length = end - start + 1
    partial_headers = {
        **common_headers,
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Content-Length": str(content_length),
    }

    if request.method == "HEAD":
        return Response(status_code=206, headers=partial_headers)

    return StreamingResponse(
        iter_file_chunks(path, start, end),
        status_code=206,
        media_type=media_type,
        headers=partial_headers,
    )


# Register routers
app.include_router(meetings.router, prefix="/api/v1/meetings", tags=["meetings"])
app.include_router(recordings.router, prefix="/api/v1/recordings", tags=["recordings"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(assistant.router, prefix="/api/v1/assistant", tags=["assistant"])
app.include_router(analysis.router, prefix="/api/v1", tags=["analysis"])
app.include_router(integrations.router, prefix="/api/v1", tags=["integrations"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(calendar.router, prefix="/api/v1/calendar", tags=["calendar"])
app.include_router(calendar_feed.router, prefix="/api/v1/calendar", tags=["calendar"])
app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
app.include_router(slides.router, prefix="/api/v1", tags=["slides"])
app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(translate.router, prefix="/api/v1", tags=["translate"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(preferences.router, prefix="/api/v1/preferences", tags=["preferences"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3452)
