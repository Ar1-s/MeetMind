from __future__ import annotations
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "meeting_copilot.db"
DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite+aiosqlite:///{DEFAULT_DB_PATH.as_posix()}"

engine = create_async_engine(
    DATABASE_URL, 
    echo=True,
    connect_args={"timeout": 30} # Increase timeout
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Enable WAL mode for better concurrency
from sqlalchemy import event
from sqlalchemy.engine import Engine

# Note: For aiosqlite, we need to attach listener to the sync connection or use a specific async approach.
# However, SQLAlchemy's event listening on 'connect' usually works with the underlying DBAPI connection.
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

class Base(DeclarativeBase):
    pass


async def init_db():
    from app.models import meeting, recording, task, summary, chat, user, memory, agent, project, objective, key_result, preference, analysis_job  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _migrate_tasks_created_by(conn)
        await _migrate_user_calendar_token(conn)
        await _migrate_task_segments(conn)
        await _migrate_task_key_result(conn)
        await _migrate_summary_emotion(conn)
        await _migrate_conversations_agent(conn)
        await _migrate_meeting_anonymization(conn)


async def get_db():
    async with async_session() as session:
        yield session


async def _migrate_tasks_created_by(conn):
    """
    Lightweight migration: add tasks.created_by if missing and backfill from meetings.created_by.
    This keeps dev SQLite DB working without Alembic.
    """
    # Check columns
    info = await conn.exec_driver_sql("PRAGMA table_info('tasks')")
    columns = [row[1] for row in info.all()]  # row[1] = column name
    if "created_by" in columns:
        return

    # Add column
    await conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN created_by VARCHAR(36)")

    # Best-effort backfill using source meeting owner
    await conn.exec_driver_sql(
        """
        UPDATE tasks
        SET created_by = (
            SELECT created_by FROM meetings WHERE meetings.id = tasks.source_meeting_id
        )
        WHERE created_by IS NULL
        """
    )


async def _migrate_user_calendar_token(conn):
    """
    Add calendar_token to users if missing and generate random tokens.
    """
    info = await conn.exec_driver_sql("PRAGMA table_info('users')")
    columns = [row[1] for row in info.all()]
    if "calendar_token" not in columns:
        # SQLite cannot add UNIQUE column via ALTER TABLE; add plain column first
        await conn.exec_driver_sql("ALTER TABLE users ADD COLUMN calendar_token VARCHAR(64)")

    # Ensure all users have a token
    await conn.exec_driver_sql(
        "UPDATE users SET calendar_token = lower(hex(randomblob(16))) WHERE calendar_token IS NULL"
    )

    # Best-effort unique index (may fail if duplicates, but tokens are random so should succeed)
    try:
        await conn.exec_driver_sql(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_calendar_token ON users(calendar_token)"
        )
    except Exception:
        pass


async def _migrate_task_segments(conn):
    """Add source_segment_start/end to tasks if missing."""
    info = await conn.exec_driver_sql("PRAGMA table_info('tasks')")
    columns = [row[1] for row in info.all()]
    if "source_segment_start" in columns and "source_segment_end" in columns:
        return
    if "source_segment_start" not in columns:
        await conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN source_segment_start INTEGER")
    if "source_segment_end" not in columns:
        await conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN source_segment_end INTEGER")


async def _migrate_task_key_result(conn):
    """Add key_result_id to tasks if missing."""
    info = await conn.exec_driver_sql("PRAGMA table_info('tasks')")
    columns = [row[1] for row in info.all()]
    if "key_result_id" in columns:
        return
    await conn.exec_driver_sql("ALTER TABLE tasks ADD COLUMN key_result_id VARCHAR(36)")


async def _migrate_summary_emotion(conn):
    """Add sentiment_score/emotion_flags to summaries if missing."""
    info = await conn.exec_driver_sql("PRAGMA table_info('summaries')")
    columns = [row[1] for row in info.all()]
    if "sentiment_score" not in columns:
        await conn.exec_driver_sql("ALTER TABLE summaries ADD COLUMN sentiment_score FLOAT")
    if "emotion_flags" not in columns:
        await conn.exec_driver_sql("ALTER TABLE summaries ADD COLUMN emotion_flags JSON")


async def _migrate_conversations_agent(conn):
    """Add agent_id to conversations if missing."""
    info = await conn.exec_driver_sql("PRAGMA table_info('conversations')")
    columns = [row[1] for row in info.all()]
    if "agent_id" not in columns:
        await conn.exec_driver_sql("ALTER TABLE conversations ADD COLUMN agent_id VARCHAR(36)")


async def _migrate_meeting_anonymization(conn):
    """Add anonymization settings to meetings if missing."""
    info = await conn.exec_driver_sql("PRAGMA table_info('meetings')")
    columns = [row[1] for row in info.all()]
    if "anonymize_participants" not in columns:
        await conn.exec_driver_sql(
            "ALTER TABLE meetings ADD COLUMN anonymize_participants BOOLEAN DEFAULT 0"
        )
    if "participant_aliases" not in columns:
        await conn.exec_driver_sql(
            "ALTER TABLE meetings ADD COLUMN participant_aliases JSON"
        )
    await conn.exec_driver_sql(
        "UPDATE meetings SET anonymize_participants = 0 WHERE anonymize_participants IS NULL"
    )
    await conn.exec_driver_sql(
        "UPDATE meetings SET participant_aliases = '{}' WHERE participant_aliases IS NULL"
    )
