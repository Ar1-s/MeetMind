from __future__ import annotations

from dataclasses import dataclass

from app.models.key_result import KeyResult


@dataclass(frozen=True)
class KeyResultProgressSnapshot:
    current_value: float
    target_value: float
    progress: float
    status: str
    linked_task_count: int
    completed_task_count: int
    progress_source: str
    unit: str | None


def get_key_result_progress_snapshot(kr: KeyResult) -> KeyResultProgressSnapshot:
    tasks = list(kr.tasks or [])
    linked_task_count = len(tasks)
    completed_task_count = sum(1 for task in tasks if task.status == "done")

    if linked_task_count > 0:
        progress = round((completed_task_count / linked_task_count) * 100, 1)
        if completed_task_count == linked_task_count:
            status = "completed"
        elif kr.status in {"at_risk", "off_track"}:
            status = kr.status
        else:
            status = "on_track"

        return KeyResultProgressSnapshot(
            current_value=float(completed_task_count),
            target_value=float(linked_task_count),
            progress=progress,
            status=status,
            linked_task_count=linked_task_count,
            completed_task_count=completed_task_count,
            progress_source="tasks",
            unit="项",
        )

    current_value = float(kr.current_value or 0)
    target_value = float(kr.target_value or 0)
    if target_value <= 0:
        progress = 0.0
    else:
        progress = round(min(max(current_value / target_value, 0.0), 1.0) * 100, 1)

    status = kr.status
    if target_value > 0 and current_value >= target_value:
        status = "completed"

    return KeyResultProgressSnapshot(
        current_value=current_value,
        target_value=target_value,
        progress=progress,
        status=status,
        linked_task_count=0,
        completed_task_count=0,
        progress_source="manual",
        unit=kr.unit,
    )
