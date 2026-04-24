from __future__ import annotations

import copy
import re
from typing import Any

CHINESE_NAME_PATTERN = re.compile(r"^[\u4e00-\u9fff·]{2,4}$")
NAME_PREFIX_VARIANTS = ("老", "小")
NAME_TITLE_VARIANTS = ("总", "总监", "经理", "老师", "主任", "同学", "老板", "工")


def _alias_suffix(index: int) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    value = index + 1
    result = ""
    while value > 0:
        value, remainder = divmod(value - 1, len(alphabet))
        result = alphabet[remainder] + result
    return result


def build_participant_aliases(
    participants: list[dict] | None,
    existing_aliases: dict[str, str] | None = None,
) -> dict[str, str]:
    aliases: dict[str, str] = {}
    used_aliases: set[str] = set()
    existing = existing_aliases or {}
    next_index = 0

    for participant in participants or []:
        name = (participant or {}).get("name")
        if not name or name in aliases:
            continue

        existing_alias = existing.get(name)
        if isinstance(existing_alias, str) and existing_alias and existing_alias not in used_aliases:
            aliases[name] = existing_alias
            used_aliases.add(existing_alias)
            continue

        while True:
            candidate = f"参会人{_alias_suffix(next_index)}"
            next_index += 1
            if candidate not in used_aliases:
                aliases[name] = candidate
                used_aliases.add(candidate)
                break

    return aliases


def _build_name_variants(participant: dict[str, Any], target_name: str) -> list[tuple[str, str]]:
    name = (participant or {}).get("name")
    if not isinstance(name, str) or not name.strip():
        return []

    name = name.strip()
    variants: list[tuple[str, str]] = [(name, target_name)]
    email = (participant or {}).get("email")
    if isinstance(email, str) and email.strip():
        variants.append((email.strip(), target_name))

    if CHINESE_NAME_PATTERN.match(name):
        surname = name[0]
        for prefix in NAME_PREFIX_VARIANTS:
            variants.append((f"{prefix}{surname}", target_name))
        for suffix in NAME_TITLE_VARIANTS:
            variants.append((f"{surname}{suffix}", target_name))

    return variants


def build_participant_name_map(
    participants: list[dict] | None,
    replacements: dict[str, str] | None = None,
) -> dict[str, str]:
    name_map: dict[str, str] = {}
    replacements = replacements or {}

    for participant in participants or []:
        name = (participant or {}).get("name")
        if not isinstance(name, str) or not name.strip():
            continue

        target_name = replacements.get(name, name)
        for variant, target in _build_name_variants(participant, target_name):
            if variant and target and variant not in name_map:
                name_map[variant] = target

    return name_map


def replace_participant_names(text: str | None, name_map: dict[str, str] | None) -> str | None:
    if not isinstance(text, str) or not text or not name_map:
        return text

    result = text
    for source, target in sorted(name_map.items(), key=lambda item: len(item[0]), reverse=True):
        if not source or source == target:
            continue
        result = result.replace(source, target)
    return result


def build_participant_context(meeting: Any) -> dict[str, Any]:
    participants = copy.deepcopy(getattr(meeting, "participants", None) or [])
    participant_aliases = build_participant_aliases(
        participants,
        copy.deepcopy(getattr(meeting, "participant_aliases", None) or {}),
    )
    anonymize_enabled = bool(getattr(meeting, "anonymize_participants", False))
    replacement_map = build_participant_name_map(
        participants,
        participant_aliases if anonymize_enabled else None,
    )
    canonical_name_map = build_participant_name_map(participants)

    return {
        "participants": participants,
        "participant_aliases": participant_aliases,
        "anonymize_participants": anonymize_enabled,
        "replacement_map": replacement_map,
        "canonical_name_map": canonical_name_map,
    }


def anonymize_transcript_segments(
    transcript: list[dict[str, Any]] | None,
    replacement_map: dict[str, str] | None,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for segment in transcript or []:
        item = dict(segment or {})
        item["speaker"] = replace_participant_names(item.get("speaker"), replacement_map)
        item["text"] = replace_participant_names(item.get("text"), replacement_map)
        result.append(item)
    return result


def transform_summary_with_name_map(
    summary: dict[str, Any] | None,
    replacement_map: dict[str, str] | None,
    *,
    include_transcript: bool = True,
) -> dict[str, Any]:
    summary = copy.deepcopy(summary or {})
    if not replacement_map:
        return summary

    summary["abstract"] = replace_participant_names(summary.get("abstract"), replacement_map)
    summary["decisions"] = [
        replace_participant_names(item, replacement_map) or item for item in (summary.get("decisions") or [])
    ]
    summary["risks"] = [
        replace_participant_names(item, replacement_map) or item for item in (summary.get("risks") or [])
    ]

    action_items: list[dict[str, Any]] = []
    for item in summary.get("action_items") or []:
        action = dict(item or {})
        action["title"] = replace_participant_names(action.get("title"), replacement_map)
        action["assignee"] = replace_participant_names(action.get("assignee"), replacement_map)
        action_items.append(action)
    summary["action_items"] = action_items

    mindmap = copy.deepcopy(summary.get("mindmap"))
    if isinstance(mindmap, dict) and isinstance(mindmap.get("nodes"), list):
        for node in mindmap["nodes"]:
            if not isinstance(node, dict):
                continue
            node["label"] = replace_participant_names(node.get("label"), replacement_map)
            node["description"] = replace_participant_names(node.get("description"), replacement_map)
        summary["mindmap"] = mindmap

    if include_transcript:
        summary["transcript"] = anonymize_transcript_segments(summary.get("transcript"), replacement_map)
    return summary


def transform_task_payload(
    task_payload: dict[str, Any],
    replacement_map: dict[str, str] | None,
) -> dict[str, Any]:
    payload = dict(task_payload or {})
    if not replacement_map:
        return payload

    payload["title"] = replace_participant_names(payload.get("title"), replacement_map)
    payload["description"] = replace_participant_names(payload.get("description"), replacement_map)
    payload["assignee"] = replace_participant_names(payload.get("assignee"), replacement_map)
    return payload
