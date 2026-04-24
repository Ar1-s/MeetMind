from __future__ import annotations
import asyncio
import html
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import uuid
import zipfile
from shutil import which
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable

from app.services.ai.factory import get_ai_service
from app.services.ppt_backgrounds import load_background_config, resolve_asset_path

REPO_ROOT = Path(__file__).resolve().parents[4]
WEB_DIR = REPO_ROOT / "packages" / "web"
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = BASE_DIR / "uploads"
SLIDES_ROOT = UPLOAD_ROOT / "slides"
LOG_FILENAME = "build.log"
TEMP_SLIDEV_DIR = WEB_DIR / ".slidev-temp"


_FRONTMATTER_KEYS = {
    "layout",
    "theme",
    "background",
    "title",
    "subtitle",
    "author",
    "date",
    "transition",
    "highlighter",
    "download",
    "export",
    "info",
}


def _extract_implicit_frontmatter(lines: List[str]) -> tuple[str, List[str]]:
    idx = 0
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    if idx >= len(lines):
        return "", lines

    first = lines[idx]
    if ":" not in first:
        return "", lines
    key = first.split(":", 1)[0].strip()
    if key not in _FRONTMATTER_KEYS:
        return "", lines

    fm_lines: List[str] = []
    in_block = False
    block_indent = 0
    i = idx
    while i < len(lines):
        line = lines[i]
        if in_block:
            if not line.strip():
                fm_lines.append(line)
                i += 1
                continue
            indent = len(line) - len(line.lstrip(" "))
            if indent > block_indent:
                fm_lines.append(line)
                i += 1
                continue
            in_block = False
            block_indent = 0
            break

        if not line.strip():
            fm_lines.append(line)
            i += 1
            continue

        if ":" not in line:
            break
        key = line.split(":", 1)[0].strip()
        if key not in _FRONTMATTER_KEYS:
            break
        fm_lines.append(line)
        if line.rstrip().endswith("|") or line.rstrip().endswith(">"):
            in_block = True
            block_indent = len(line) - len(line.lstrip(" "))
        i += 1

    if not fm_lines:
        return "", lines
    rest = lines[i:]
    fm = "\n".join(fm_lines).strip("\n")
    return fm, rest


def _sanitize_markdown_separators(markdown: str) -> str:
    lines = markdown.splitlines()
    cleaned: List[str] = []
    dash_run = 0
    for line in lines:
        if line.strip() == "---":
            dash_run += 1
            if dash_run > 1:
                continue
            cleaned.append("---")
            continue
        dash_run = 0
        cleaned.append(line)
    return "\n".join(cleaned).strip("\n")


def _unwrap_outer_markdown_fence(markdown: str) -> str:
    stripped = markdown.strip()
    if not stripped:
        return markdown

    lines = stripped.splitlines()
    if len(lines) < 3:
        return markdown

    first = lines[0].strip().lower()
    last = lines[-1].strip()
    if not last.startswith("```"):
        return markdown

    if first in {"```", "```markdown", "```md", "```slidev"}:
        inner = "\n".join(lines[1:-1]).strip("\n")
        return inner

    return markdown


_SLIDEV_WRAPPER_TAG_RE = re.compile(
    r"^\s*</?v-(?:click|clicks|after|motion|drag|mark)(?:\s+[^>]*)?>\s*$",
    re.IGNORECASE,
)

_REMOTE_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\((https?://[^)\s]+)\)")
_MERMAID_BLOCK_RE = re.compile(r"```mermaid\s*\n(.*?)\n```", re.IGNORECASE | re.DOTALL)
_ZERO_WIDTH_TRANSLATION = str.maketrans(
    {
        "\ufeff": "",
        "\u200b": "",
        "\u200c": "",
        "\u200d": "",
        "\u2060": "",
        "\xa0": " ",
    }
)
_SMART_PUNCT_TRANSLATION = str.maketrans(
    {
        "“": "\"",
        "”": "\"",
        "‘": "'",
        "’": "'",
        "：": ":",
        "（": "(",
        "）": ")",
        "，": ",",
        "；": ";",
    }
)


def _normalize_markdown_unicode(markdown: str) -> str:
    normalized = markdown.replace("\r\n", "\n").replace("\r", "\n").translate(_ZERO_WIDTH_TRANSLATION)
    return normalized.strip("\n")


def _sanitize_remote_images(markdown: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        alt = (match.group(1) or "").strip() or "远程图片"
        return f"> 插图占位：{alt}（已省略远程图片以提高导出稳定性）"

    return _REMOTE_IMAGE_RE.sub(_replace, markdown)


def _normalize_mermaid_block(content: str) -> str:
    lines = content.splitlines()
    if not lines:
        return content

    header = lines[0].strip().lower()
    normalized_lines: List[str] = [lines[0].strip()]

    for raw_line in lines[1:]:
        line = raw_line.translate(_SMART_PUNCT_TRANSLATION).rstrip()
        stripped = line.strip()
        if not stripped:
            normalized_lines.append("")
            continue

        if header == "pie" and not stripped.startswith("title"):
            match = re.match(r"^(?P<label>.+?)\s*:\s*(?P<value>-?\d+(?:\.\d+)?)\s*$", stripped)
            if match:
                label = match.group("label").strip().strip("\"'")
                value = match.group("value")
                normalized_lines.append(f'    "{label}" : {value}')
                continue

        if header == "gantt":
            if stripped.startswith(("title", "dateFormat", "axisFormat", "section", "todayMarker", "excludes", "tickInterval")):
                normalized_lines.append(f"    {stripped}")
                continue
            if ":" in stripped:
                left, right = stripped.split(":", 1)
                normalized_lines.append(f"    {left.strip()} : {right.strip()}")
                continue

        normalized_lines.append(line)

    return "\n".join(normalized_lines).strip("\n")


def _sanitize_mermaid_blocks(markdown: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        block = _normalize_mermaid_block(match.group(1))
        return f"```mermaid\n{block}\n```"

    return _MERMAID_BLOCK_RE.sub(_replace, markdown)


def _split_markdown_table_row(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip().replace("\\|", "|") for cell in stripped.split("|")]


def _is_markdown_table_delimiter_row(line: str) -> bool:
    cells = _split_markdown_table_row(line)
    if not cells:
        return False
    for cell in cells:
        normalized = cell.replace(" ", "")
        if not normalized or not re.fullmatch(r":?-{3,}:?", normalized):
            return False
    return True


def _is_markdown_table_row(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2


def _strip_inline_markdown(text: str) -> str:
    cleaned = (text or "").replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"__([^_]+)__", r"\1", cleaned)
    cleaned = re.sub(r"_([^_]+)_", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", cleaned)
    return cleaned.strip()


def _estimate_text_units(text: str) -> float:
    total = 0.0
    for char in text:
        if char == "\n":
            continue
        if char.isspace():
            total += 0.45
        elif ord(char) < 128:
            total += 0.72
        else:
            total += 1.18
    return total


def _wrap_svg_text(text: str, max_units: float) -> list[str]:
    normalized = _strip_inline_markdown(text)
    if not normalized:
        return [""]

    wrapped: list[str] = []
    for paragraph in normalized.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            wrapped.append("")
            continue
        current = ""
        current_units = 0.0
        for char in paragraph:
            char_units = _estimate_text_units(char)
            if current and current_units + char_units > max_units:
                wrapped.append(current)
                current = char
                current_units = char_units
            else:
                current += char
                current_units += char_units
        if current:
            wrapped.append(current)
    return wrapped or [""]


def _render_markdown_table_svg(
    *,
    headers: list[str],
    rows: list[list[str]],
    output_path: Path,
) -> None:
    font_family = "Microsoft YaHei, PingFang SC, Noto Sans SC, sans-serif"
    font_size = 24
    line_height = 34
    cell_padding_x = 18
    cell_padding_y = 14
    min_col_width = 140
    max_total_width = 1400
    outer_padding = 24

    table_data = [headers, *rows]
    col_count = max((len(row) for row in table_data), default=0)
    if col_count == 0:
        output_path.write_text("", encoding="utf-8")
        return

    normalized_rows: list[list[str]] = []
    for row in table_data:
        padded = row + [""] * (col_count - len(row))
        normalized_rows.append([_strip_inline_markdown(cell) for cell in padded])

    col_units: list[float] = [0.0] * col_count
    for row in normalized_rows:
        for index, cell in enumerate(row):
            longest_line = max((_estimate_text_units(part) for part in cell.split("\n")), default=0.0)
            col_units[index] = max(col_units[index], longest_line)

    total_units = sum(col_units) or float(col_count)
    usable_width = max_total_width - outer_padding * 2
    col_widths: list[int] = []
    for units in col_units:
        proposed = int((units / total_units) * usable_width) if total_units else min_col_width
        col_widths.append(max(min_col_width, proposed))

    width_overflow = sum(col_widths) - usable_width
    if width_overflow > 0:
        shrinkable_indexes = [idx for idx, value in enumerate(col_widths) if value > min_col_width]
        while width_overflow > 0 and shrinkable_indexes:
            for idx in list(shrinkable_indexes):
                if width_overflow <= 0:
                    break
                if col_widths[idx] > min_col_width:
                    col_widths[idx] -= 1
                    width_overflow -= 1
                else:
                    shrinkable_indexes.remove(idx)

    wrapped_rows: list[list[list[str]]] = []
    row_heights: list[int] = []
    for row_index, row in enumerate(normalized_rows):
        wrapped_cells: list[list[str]] = []
        max_lines = 1
        for col_index, cell in enumerate(row):
            max_units = max(8.0, (col_widths[col_index] - cell_padding_x * 2) / (font_size * 0.7))
            wrapped = _wrap_svg_text(cell, max_units)
            wrapped_cells.append(wrapped)
            max_lines = max(max_lines, len(wrapped))
        wrapped_rows.append(wrapped_cells)
        base_padding = cell_padding_y * 2
        if row_index == 0:
            base_padding += 4
        row_heights.append(base_padding + max_lines * line_height)

    total_width = outer_padding * 2 + sum(col_widths)
    total_height = outer_padding * 2 + sum(row_heights)

    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="{total_height}" viewBox="0 0 {total_width} {total_height}">',
        f'<rect width="{total_width}" height="{total_height}" fill="#ffffff" rx="24" />',
        f'<rect x="{outer_padding}" y="{outer_padding}" width="{sum(col_widths)}" height="{sum(row_heights)}" fill="#ffffff" stroke="#d7deea" stroke-width="2" rx="18" />',
    ]

    current_y = outer_padding
    for row_index, (wrapped_cells, row_height) in enumerate(zip(wrapped_rows, row_heights)):
        current_x = outer_padding
        row_fill = "#eef4ff" if row_index == 0 else ("#ffffff" if row_index % 2 else "#f8fbff")
        for col_index, wrapped in enumerate(wrapped_cells):
            cell_width = col_widths[col_index]
            svg_lines.append(
                f'<rect x="{current_x}" y="{current_y}" width="{cell_width}" height="{row_height}" fill="{row_fill}" stroke="#d7deea" stroke-width="1" />'
            )
            text_x = current_x + cell_padding_x
            text_y = current_y + cell_padding_y + font_size
            weight = "700" if row_index == 0 else "400"
            fill = "#183153" if row_index == 0 else "#243447"
            for line_index, line in enumerate(wrapped):
                y = text_y + line_index * line_height
                escaped = html.escape(line)
                svg_lines.append(
                    f'<text x="{text_x}" y="{y}" font-family="{font_family}" font-size="{font_size}" font-weight="{weight}" fill="{fill}">{escaped}</text>'
                )
            current_x += cell_width
        current_y += row_height

    svg_lines.append("</svg>")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(svg_lines), encoding="utf-8")


def _replace_markdown_tables_with_images(markdown: str, temp_dir: Path, log_path: Path) -> str:
    lines = markdown.splitlines()
    output_lines: list[str] = []
    table_index = 0
    i = 0
    assets_dir = temp_dir / "public" / "generated-tables"
    assets_dir.mkdir(parents=True, exist_ok=True)

    while i < len(lines):
        line = lines[i]
        if (
            i + 2 < len(lines)
            and _is_markdown_table_row(lines[i])
            and _is_markdown_table_delimiter_row(lines[i + 1])
        ):
            table_lines = [lines[i], lines[i + 1]]
            j = i + 2
            while j < len(lines) and _is_markdown_table_row(lines[j]):
                table_lines.append(lines[j])
                j += 1

            headers = _split_markdown_table_row(table_lines[0])
            rows = [_split_markdown_table_row(table_line) for table_line in table_lines[2:]]

            if headers and rows:
                table_index += 1
                asset_name = f"table_{table_index:02d}.svg"
                output_path = assets_dir / asset_name
                _render_markdown_table_svg(headers=headers, rows=rows, output_path=output_path)
                output_lines.append(f"![Table {table_index}](/generated-tables/{asset_name})")
                _append_log(log_path, f"Markdown 表格已转换为图片: {asset_name}")
                i = j
                continue

        output_lines.append(line)
        i += 1

    return "\n".join(output_lines).strip("\n")


def _sanitize_slidev_wrapper_tags(markdown: str) -> str:
    lines = markdown.splitlines()
    cleaned: List[str] = []
    for line in lines:
        if _SLIDEV_WRAPPER_TAG_RE.fullmatch(line.strip()):
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip("\n")


def _sanitize_unbalanced_code_fences(markdown: str) -> str:
    lines = markdown.splitlines()
    fence_indices: List[int] = []
    current_fence: Optional[str] = None
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            fence = stripped[:3]
            if current_fence is None:
                current_fence = fence
                fence_indices.append(idx)
            elif current_fence == fence:
                current_fence = None
                fence_indices.append(idx)
    if current_fence is None:
        return "\n".join(lines).strip("\n")

    # Drop the last unmatched fence line to avoid breaking Slidev/Vue compilation.
    last_index = fence_indices[-1]
    cleaned = [line for idx, line in enumerate(lines) if idx != last_index]
    return "\n".join(cleaned).strip("\n")


def _extract_global_frontmatter(markdown: str) -> tuple[str, str]:
    lines = markdown.splitlines()
    start = None
    for idx, line in enumerate(lines):
        if line.strip():
            if line.strip() == "---":
                start = idx
            break
    if start is None:
        fm, rest_lines = _extract_implicit_frontmatter(lines)
        if fm:
            global_fm = "\n".join(["---", fm, "---"])
            rest = "\n".join(rest_lines).lstrip("\n")
            return global_fm, rest
        return "", markdown

    end = None
    for idx in range(start + 1, len(lines)):
        if lines[idx].strip() == "---":
            end = idx
            break
    if end is None:
        return "", markdown

    global_fm = "\n".join(lines[start : end + 1]).strip("\n")
    rest = "\n".join(lines[end + 1 :]).lstrip("\n")
    return global_fm, rest


def _split_slides(markdown: str) -> List[str]:
    lines = markdown.splitlines()
    slides: List[str] = []
    current: List[str] = []
    in_frontmatter = False
    has_content = False

    def _is_frontmatter_start(start_index: int) -> bool:
        for idx in range(start_index, len(lines)):
            stripped = lines[idx].strip()
            if not stripped:
                continue
            if stripped == "---":
                return False
            if ":" not in stripped:
                return False
            key = stripped.split(":", 1)[0].strip()
            if key in _FRONTMATTER_KEYS:
                return True
            return bool(key and key[0].isalpha() and all(ch.isalnum() or ch in "_-" for ch in key))
        return False

    for idx, line in enumerate(lines):
        if line.strip() == "---":
            if in_frontmatter:
                current.append(line)
                in_frontmatter = False
                continue
            if not has_content and _is_frontmatter_start(idx + 1):
                current.append(line)
                in_frontmatter = True
                continue
            if current:
                slides.append("\n".join(current).strip("\n"))
            current = []
            has_content = False
            continue
        if line.strip():
            has_content = True
        current.append(line)

    if current:
        slides.append("\n".join(current).strip("\n"))
    return [slide for slide in slides if slide.strip()]


def _strip_background_lines(slide: str, asset_values: set[str]) -> str:
    if not asset_values:
        return slide
    lines = slide.splitlines()
    cleaned: List[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("background:"):
            value = stripped.split(":", 1)[1].strip()
            if (
                value in asset_values
                or value.startswith("./assets/")
                or value.startswith("/assets/")
                or value.startswith("/uploads/")
                or value.startswith("/ppt-backgrounds/")
                or value.startswith("http://")
                or value.startswith("https://")
            ):
                continue
        cleaned.append(line)
    return "\n".join(cleaned).strip("\n")


def _split_frontmatter(slide: str) -> tuple[List[str], List[str]]:
    lines = slide.splitlines()
    first_non_empty = None
    for idx, line in enumerate(lines):
        if line.strip():
            first_non_empty = idx
            break
    if first_non_empty is None:
        return [], []
    if lines[first_non_empty].strip() == "---":
        end = None
        for idx in range(first_non_empty + 1, len(lines)):
            if lines[idx].strip() == "---":
                end = idx
                break
        if end is None:
            return [], lines
        fm_lines = lines[first_non_empty + 1 : end]
        body_lines = lines[end + 1 :]
        return fm_lines, body_lines
    fm_text, rest_lines = _extract_implicit_frontmatter(lines)
    if not fm_text:
        return [], lines
    return fm_text.splitlines(), rest_lines


def _has_body_content(body_lines: List[str]) -> bool:
    return any(line.strip() for line in body_lines)


def _merge_frontmatter_lines(primary: List[str], secondary: List[str]) -> List[str]:
    merged: List[str] = []
    key_index: Dict[str, int] = {}
    for line in primary:
        stripped = line.strip()
        if ":" in stripped:
            key = stripped.split(":", 1)[0].strip()
            if key:
                key_index[key] = len(merged)
        merged.append(line)
    for line in secondary:
        stripped = line.strip()
        if ":" in stripped:
            key = stripped.split(":", 1)[0].strip()
            if key and key in key_index:
                merged[key_index[key]] = line
                continue
        merged.append(line)
    return merged


def _build_slide_from_parts(frontmatter: List[str], body_lines: List[str]) -> str:
    body = "\n".join(body_lines).strip("\n")
    if not frontmatter:
        return body
    fm = "\n".join([line for line in frontmatter]).strip("\n")
    fm_block = "\n".join(["---", fm, "---"]).strip("\n") if fm else "---\n---"
    return f"{fm_block}\n{body}".rstrip("\n") if body else fm_block


def _merge_frontmatter_only_slides(slides: List[str]) -> List[str]:
    merged: List[str] = []
    pending_fm: List[str] = []
    for slide in slides:
        fm_lines, body_lines = _split_frontmatter(slide)
        if not _has_body_content(body_lines):
            if fm_lines:
                pending_fm = _merge_frontmatter_lines(pending_fm, fm_lines)
            continue
        if pending_fm:
            fm_lines = _merge_frontmatter_lines(pending_fm, fm_lines)
            pending_fm = []
        merged.append(_build_slide_from_parts(fm_lines, body_lines))
    return merged


def _normalize_slide_frontmatter(slide: str) -> str:
    lines = slide.splitlines()
    first_non_empty = None
    for idx, line in enumerate(lines):
        if line.strip():
            first_non_empty = idx
            break
    if first_non_empty is None:
        return slide
    if lines[first_non_empty].strip() != "---":
        return slide
    end = None
    for idx in range(first_non_empty + 1, len(lines)):
        if lines[idx].strip() == "---":
            end = idx
            break
    if end is None:
        del lines[first_non_empty]
        return "\n".join(lines).lstrip("\n")
    return slide


def _assemble_slides(slides: List[str]) -> str:
    assembled: List[str] = []
    for idx, slide in enumerate(slides):
        chunk = slide.strip("\n")
        if idx == 0:
            assembled.append(chunk)
            continue
        assembled.append(f"----\n{chunk}" if chunk else "----")
    return "\n".join(assembled).strip("\n")


def _is_truly_blank_slide(frontmatter: List[str], body_lines: List[str]) -> bool:
    has_body = any(line.strip() for line in body_lines)
    has_frontmatter = any(line.strip() for line in frontmatter)
    return not has_body and not has_frontmatter


def _remove_structurally_empty_slides(markdown: str) -> str:
    global_frontmatter, body = _extract_global_frontmatter(markdown)
    slides = _split_slides(body)
    cleaned_slides: List[str] = []

    for slide in slides:
        frontmatter, body_lines = _split_frontmatter(slide)
        normalized_body = [line.rstrip() for line in body_lines]
        if _is_truly_blank_slide(frontmatter, normalized_body):
            continue
        rebuilt = _build_slide_from_parts(frontmatter, normalized_body).strip("\n")
        if rebuilt:
            cleaned_slides.append(rebuilt)

    assembled = _assemble_slides(cleaned_slides)
    if global_frontmatter:
        return f"{global_frontmatter}\n\n{assembled}".strip("\n") if assembled else global_frontmatter
    return assembled


def _upsert_background_frontmatter(slide: str, background_path: str) -> str:
    lines = slide.splitlines()
    first_non_empty = None
    for idx, line in enumerate(lines):
        if line.strip():
            first_non_empty = idx
            break
    if first_non_empty is not None and lines[first_non_empty].strip() == "---":
        end = None
        for idx in range(first_non_empty + 1, len(lines)):
            if lines[idx].strip() == "---":
                end = idx
                break
        if end is not None:
            fm_lines = [
                line for line in lines[first_non_empty + 1 : end] if not line.strip().startswith("background:")
            ]
            layout_index = None
            layout_value = ""
            for idx, line in enumerate(fm_lines):
                stripped = line.strip()
                if stripped.startswith("layout:"):
                    layout_index = idx
                    layout_value = stripped.split(":", 1)[1].strip().strip("'\"")
                    break
            if layout_index is None:
                fm_lines.append("layout: background")
            elif layout_value == "default":
                fm_lines[layout_index] = "layout: background"
            fm_lines.append(f"background: {background_path}")
            return "\n".join(
                [*lines[:first_non_empty], "---", *fm_lines, "---", *lines[end + 1 :]]
            )
    return "\n".join(["---", "layout: background", f"background: {background_path}", "---", slide])


def _apply_backgrounds_to_markdown(
    markdown: str, config: Dict[str, Any], asset_map: Dict[str, str]
) -> str:
    global_frontmatter, body = _extract_global_frontmatter(markdown)
    slides = _split_slides(body)
    slides = _merge_frontmatter_only_slides(slides)
    global_id = config.get("global_id")
    slides_map = config.get("slides") or {}
    has_global = bool(global_id and asset_map.get(global_id))
    asset_values = set(asset_map.values())

    updated: List[str] = []
    if not slides:
        return global_frontmatter or markdown

    for index, slide in enumerate(slides, start=1):
        normalized_slide = _strip_background_lines(slide, asset_values)
        normalized_slide = _normalize_slide_frontmatter(normalized_slide)
        if not normalized_slide.lstrip().startswith("---"):
            fm, rest_lines = _extract_implicit_frontmatter(normalized_slide.splitlines())
            if fm:
                body_block = "\n".join(rest_lines).lstrip("\n")
                normalized_slide = (
                    "\n".join(["---", fm, "---", body_block]).rstrip("\n")
                    if body_block
                    else "\n".join(["---", fm, "---"])
                )
        else:
            normalized_slide = normalized_slide.strip("\n")
        slide_key = str(index)
        slide_bg_id = slides_map.get(slide_key)
        if slide_bg_id and slide_bg_id in asset_map:
            updated.append(_upsert_background_frontmatter(normalized_slide, asset_map[slide_bg_id]))
        elif has_global:
            updated.append(_upsert_background_frontmatter(normalized_slide, asset_map[global_id]))
        else:
            updated.append(normalized_slide)
    assembled = _assemble_slides(updated)
    if global_frontmatter:
        return f"{global_frontmatter}\n\n{assembled}" if assembled else global_frontmatter
    return assembled


def _prepare_background_assets(
    temp_dir: Path, meeting_id: str, owner_id: Optional[str], log_path: Path
) -> Dict[str, str]:
    config = load_background_config(meeting_id)
    global_id = config.get("global_id")
    slides_map = config.get("slides") or {}
    asset_ids = {value for value in slides_map.values() if value}
    if global_id:
        asset_ids.add(global_id)
    asset_ids = {asset_id for asset_id in asset_ids if isinstance(asset_id, str)}
    if not asset_ids:
        return {}

    public_dir = temp_dir / "public" / "ppt-backgrounds"
    public_dir.mkdir(parents=True, exist_ok=True)

    mapping: Dict[str, str] = {}
    for asset_id in sorted(asset_ids):
        src_path = resolve_asset_path(asset_id, owner_id)
        if not src_path or not src_path.exists():
            _append_log(log_path, f"背景素材不存在: {asset_id}")
            continue
        dest_name = f"{asset_id.replace(':', '_')}{src_path.suffix.lower()}"
        dest_path = public_dir / dest_name
        try:
            shutil.copy2(src_path, dest_path)
        except OSError:
            _append_log(log_path, f"背景素材复制失败: {asset_id}")
            continue
        mapping[asset_id] = f"/ppt-backgrounds/{dest_name}"
    return mapping


def _ensure_background_layout(temp_dir: Path, log_path: Path) -> None:
    layout_dir = temp_dir / "layouts"
    layout_dir.mkdir(parents=True, exist_ok=True)
    layout_path = layout_dir / "background.vue"
    content = """<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  background: {
    default: '',
  },
})

function resolveAssetUrl(url: string) {
  if (url.startsWith('/'))
    return import.meta.env.BASE_URL + url.slice(1)
  return url
}

const style = computed(() => {
  const background = props.background || ''
  if (!background)
    return {}
  const isColor = ['#', 'rgb', 'hsl'].some(v => background.indexOf(v) === 0)
  if (isColor)
    return { background }
  return {
    backgroundImage: `url("${resolveAssetUrl(background)}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }
})
</script>

<template>
  <div class="slidev-layout default" :style="style">
    <slot />
  </div>
</template>
"""
    try:
        layout_path.write_text(content, encoding="utf-8")
        _append_log(log_path, f"写入背景 layout: {layout_path}")
    except OSError:
        _append_log(log_path, "写入背景 layout 失败")


def _format_meeting_time(raw_time: Optional[str]) -> str:
    if not raw_time:
        return ""
    try:
        return datetime.fromisoformat(raw_time.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return raw_time


def _safe_filename(value: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in value).strip("_") or "meeting"


def _get_slidev_command() -> List[str]:
    override = os.getenv("SLIDEV_CLI", "").strip()
    if override:
        return shlex.split(override)
    slidev_cmd = WEB_DIR / "node_modules" / ".bin" / "slidev.CMD"
    slidev_ps1 = WEB_DIR / "node_modules" / ".bin" / "slidev.ps1"
    slidev_unix = WEB_DIR / "node_modules" / ".bin" / "slidev"
    if os.name == "nt":
        if slidev_cmd.exists():
            return [str(slidev_cmd)]
        if slidev_ps1.exists():
            return [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(slidev_ps1),
            ]
    if slidev_unix.exists():
        return [str(slidev_unix)]

    pnpm_override = os.getenv("PNPM_CLI", "").strip()
    if pnpm_override:
        return shlex.split(pnpm_override) + ["-C", str(WEB_DIR), "exec", "slidev"]

    if os.name == "nt":
        for candidate in (
            which("pnpm.cmd"),
            which("pnpm"),
            str(Path.home() / "AppData" / "Roaming" / "npm" / "pnpm.cmd"),
            str(Path.home() / "AppData" / "Roaming" / "npm" / "pnpm"),
        ):
            if candidate and Path(candidate).exists():
                return [candidate, "-C", str(WEB_DIR), "exec", "slidev"]
    else:
        pnpm_path = which("pnpm")
        if pnpm_path:
            return [pnpm_path, "-C", str(WEB_DIR), "exec", "slidev"]
    return ["pnpm", "-C", str(WEB_DIR), "exec", "slidev"]


def _get_pnpm_command() -> List[str]:
    override = os.getenv("PNPM_CLI", "").strip()
    if override:
        return shlex.split(override)
    if os.name == "nt":
        for candidate in (
            which("pnpm.cmd"),
            which("pnpm"),
            str(Path.home() / "AppData" / "Roaming" / "npm" / "pnpm.cmd"),
            str(Path.home() / "AppData" / "Roaming" / "npm" / "pnpm"),
        ):
            if candidate and Path(candidate).exists():
                return [candidate]
    else:
        pnpm_path = which("pnpm")
        if pnpm_path:
            return [pnpm_path]
    return ["pnpm"]


def _get_node_command() -> List[str]:
    override = os.getenv("NODE_CLI", "").strip()
    if override:
        return shlex.split(override)
    candidates: List[str] = []
    if os.name == "nt":
        candidates.extend(
            candidate
            for candidate in (
                which("node.exe"),
                which("node"),
                str(Path.home() / "AppData" / "Local" / "Programs" / "nodejs" / "node.exe"),
                r"C:\Program Files\nodejs\node.exe",
                r"C:\Program Files (x86)\nodejs\node.exe",
            )
            if candidate
        )
    else:
        node_path = which("node")
        if node_path:
            candidates.append(node_path)
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return [candidate]
    return ["node"]


def _get_export_flags() -> List[str]:
    timeout = os.getenv("SLIDEV_EXPORT_TIMEOUT", "120000").strip()
    wait = os.getenv("SLIDEV_EXPORT_WAIT", "2000").strip()
    wait_until = os.getenv("SLIDEV_EXPORT_WAIT_UNTIL", "load").strip()
    flags: List[str] = []
    if timeout:
        flags += ["--timeout", timeout]
    if wait:
        flags += ["--wait", wait]
    if wait_until:
        flags += ["--wait-until", wait_until]
    return flags


def _pick_free_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        return int(sock.getsockname()[1])


def _append_log(log_path: Path, message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] {message}\n")


def _prepare_slidev_entry(
    temp_dir: Path,
    markdown: str,
    log_path: Path,
) -> Path:
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_markdown_path = temp_dir / "slides.md"
    temp_markdown_path.write_text(markdown, encoding="utf-8")
    _append_log(log_path, f"写入临时 Markdown: {temp_markdown_path}")
    return temp_markdown_path


def _cleanup_slidev_entry(temp_dir: Path, log_path: Path) -> None:
    if os.getenv("SLIDEV_KEEP_TEMP", "").strip():
        _append_log(log_path, "保留临时 Slidev 文件")
        return
    if temp_dir.exists():
        for child in temp_dir.rglob("*"):
            if child.is_file():
                child.unlink(missing_ok=True)
        for child in sorted(temp_dir.rglob("*"), reverse=True):
            if child.is_dir():
                child.rmdir()
        temp_dir.rmdir()
        _append_log(log_path, "清理临时 Slidev 文件完成")


def _get_slidev_cli_root() -> Path:
    candidates = [
        WEB_DIR / "node_modules" / ".pnpm",
        REPO_ROOT / "node_modules" / ".pnpm",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return WEB_DIR / "node_modules" / ".pnpm"


_RUNTIME_PACKAGE_PREFERRED_VERSIONS: Dict[str, str] = {
    "@babel/parser": "7.28.6",
    "@jridgewell/sourcemap-codec": "1.5.5",
    "entities": "7.0.1",
    "estree-walker": "2.0.2",
    "magic-string": "0.30.21",
    "nanoid": "3.3.11",
    "picocolors": "1.1.1",
    "postcss": "8.5.6",
    "source-map-js": "1.2.1",
}


def _find_pnpm_package_dir(package_name: str, preferred_version: Optional[str] = None) -> Optional[Path]:
    pnpm_root = _get_slidev_cli_root()
    encoded = package_name.replace("/", "+")
    matches = sorted(pnpm_root.glob(f"{encoded}@*/node_modules/{package_name}"))
    if preferred_version:
        version_marker = f"{encoded}@{preferred_version}"
        for match in matches:
            if version_marker in str(match):
                return match
    for match in reversed(matches):
        if match.exists():
            return match
    return None


def _ensure_slidev_unocss_runtime(log_path: Path) -> None:
    root = _get_slidev_cli_root()
    client_node_modules_dirs = list(root.glob("@slidev+client@*/node_modules"))
    if not client_node_modules_dirs:
        _append_log(log_path, "鏈壘鍒?@slidev/client 杩愯鐩綍锛岃烦杩?UnoCSS 琛ュ叏")
        return

    required_packages = [
        "@unocss/extractor-mdc",
        "@unocss/preset-mini",
        "@unocss/core",
        "@unocss/rule-utils",
        "@unocss/extractor-arbitrary-variants",
    ]
    repaired = 0
    for client_node_modules in client_node_modules_dirs:
        for package_name in required_packages:
            destination = client_node_modules / package_name
            if destination.exists():
                continue
            source = _find_pnpm_package_dir(package_name)
            if not source:
                _append_log(log_path, f"鏈壘鍒?UnoCSS 渚濊禆鍖? {package_name}")
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(source, destination, dirs_exist_ok=True)
            repaired += 1
            _append_log(log_path, f"宸茶ˉ鍏?UnoCSS 渚濊禆: {package_name} -> {destination}")

    if repaired == 0:
        _append_log(log_path, "UnoCSS 杩愯鏃朵緷璧栧凡瀹屾暣")


def _patch_vite_windows_realpath(log_path: Path) -> None:
    if os.name != "nt":
        return

    targets: List[Path] = []
    pnpm_root = REPO_ROOT / "node_modules" / ".pnpm"
    if pnpm_root.exists():
        targets.extend(pnpm_root.glob("vite@*/node_modules/vite/dist/node/chunks/config.js"))
    targets += list((WEB_DIR / "node_modules" / "vite" / "dist" / "node" / "chunks").glob("config.js"))
    targets += list((REPO_ROOT / "node_modules" / "vite" / "dist" / "node" / "chunks").glob("config.js"))

    if not targets:
        _append_log(log_path, "未找到 Vite config.js，跳过 Windows realpath 补丁")
        return

    old_block = """\texec("net use", (error$1, stdout) => {\n\t\tif (error$1) return;\n\t\tconst lines = stdout.split("\\n");\n\t\tfor (const line of lines) {\n\t\t\tconst m = parseNetUseRE.exec(line);\n\t\t\tif (m) windowsNetworkMap.set(m[2], m[1]);\n\t\t}\n\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;\n\t\telse safeRealpathSync = windowsMappedRealpathSync;\n\t});"""
    new_block = """\ttry {\n\t\texec("net use", (error$1, stdout) => {\n\t\t\tif (error$1) {\n\t\t\t\tsafeRealpathSync = fs.realpathSync.native;\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tconst lines = stdout.split("\\n");\n\t\t\tfor (const line of lines) {\n\t\t\t\tconst m = parseNetUseRE.exec(line);\n\t\t\t\tif (m) windowsNetworkMap.set(m[2], m[1]);\n\t\t\t}\n\t\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;\n\t\t\telse safeRealpathSync = windowsMappedRealpathSync;\n\t\t});\n\t} catch (error$1) {\n\t\tsafeRealpathSync = fs.realpathSync.native;\n\t}"""

    applied = 0
    for target in targets:
        try:
            content = target.read_text(encoding="utf-8")
        except OSError:
            continue

        if "try {\n\t\texec(\"net use\"" in content:
            continue
        if old_block not in content:
            continue

        content = content.replace(old_block, new_block, 1)
        try:
            target.write_text(content, encoding="utf-8")
        except OSError:
            continue
        applied += 1

    if applied:
        _append_log(log_path, f"已应用 Vite Windows realpath 补丁: {applied} 个文件")
    else:
        _append_log(log_path, "Vite Windows realpath 补丁已存在或未应用")


def _package_dir_ready(path: Path) -> bool:
    try:
        return (path / "package.json").exists()
    except OSError:
        return False


def _read_package_version(path: Path) -> Optional[str]:
    try:
        data = json.loads((path / "package.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    version = data.get("version")
    return str(version) if version else None


def _copy_runtime_package(package_name: str, destination_root: Path, log_path: Path) -> int:
    destination = destination_root.joinpath(*package_name.split("/"))
    source = _find_pnpm_package_dir(
        package_name, preferred_version=_RUNTIME_PACKAGE_PREFERRED_VERSIONS.get(package_name)
    )
    if not source:
        _append_log(log_path, f"未找到运行时依赖包: {package_name}")
        return 0

    source_version = _read_package_version(source)
    destination_version = _read_package_version(destination) if _package_dir_ready(destination) else None
    if destination_version and destination_version == source_version:
        return 0

    try:
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
    except OSError:
        pass

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, dirs_exist_ok=True)
    _append_log(log_path, f"已补齐运行时依赖: {package_name} -> {destination}")
    return 1


def _ensure_slidev_runtime_packages(log_path: Path) -> None:
    root_runtime_packages = [
        "@babel/parser",
        "@jridgewell/sourcemap-codec",
        "entities",
        "estree-walker",
        "magic-string",
        "nanoid",
        "picocolors",
        "postcss",
        "source-map-js",
    ]
    repaired = 0
    for package_name in root_runtime_packages:
        repaired += _copy_runtime_package(package_name, REPO_ROOT / "node_modules", log_path)

    local_pkg_node_modules_dirs = list(_get_slidev_cli_root().glob("local-pkg@*/node_modules"))
    if not local_pkg_node_modules_dirs:
        _append_log(log_path, "未找到 local-pkg 运行目录，跳过 Vue 编译器补齐")
    else:
        for node_modules_dir in local_pkg_node_modules_dirs:
            for package_name in (
                "@vue/compiler-core",
                "@vue/compiler-dom",
                "@vue/compiler-sfc",
                "@vue/compiler-ssr",
                "@vue/shared",
            ):
                repaired += _copy_runtime_package(package_name, node_modules_dir, log_path)

    if repaired == 0:
        _append_log(log_path, "Slidev 运行时依赖已齐全")


def _patch_slidev_build(log_path: Path) -> None:
    if os.getenv("SLIDEV_SKIP_PATCH", "").strip():
        _append_log(log_path, "跳过 Slidev build 补丁")
        return

    root = _get_slidev_cli_root()
    targets = list(root.glob("@slidev+cli@*/node_modules/@slidev/cli/dist/build-*.mjs"))
    targets += list((WEB_DIR / "node_modules" / "@slidev" / "cli" / "dist").glob("build-*.mjs"))
    targets += list((REPO_ROOT / "node_modules" / "@slidev" / "cli" / "dist").glob("build-*.mjs"))
    if not targets:
        _append_log(log_path, "未找到 Slidev build 脚本，跳过补丁")
        return

    applied = 0
    for target in targets:
        try:
            content = target.read_text(encoding="utf-8")
        except OSError:
            continue

        if "unlink(indexPath).catch" in content or "access(indexPath)" in content:
            continue

        marker = "else await fs$1.unlink(indexPath);"
        if marker not in content:
            continue

        content = content.replace(
            marker,
            "else await fs$1.unlink(indexPath).catch(() => {});",
            1,
        )
        try:
            target.write_text(content, encoding="utf-8")
        except OSError:
            continue
        applied += 1

    if applied:
        _append_log(log_path, f"已应用 Slidev build 补丁: {applied} 个文件")
    else:
        _append_log(log_path, "Slidev build 补丁已存在或未应用")


def _ensure_slidev_deps(log_path: Path) -> None:
    theme_dir = WEB_DIR / "node_modules" / "@slidev" / "theme-default"
    slidev_bin = WEB_DIR / "node_modules" / ".bin" / "slidev"
    slidev_cmd = WEB_DIR / "node_modules" / ".bin" / "slidev.CMD"
    _ensure_slidev_unocss_runtime(log_path)
    if theme_dir.exists() and (slidev_bin.exists() or slidev_cmd.exists()):
        _ensure_slidev_runtime_packages(log_path)
        _patch_vite_windows_realpath(log_path)
        _patch_slidev_build(log_path)
        _patch_slidev_export(log_path)
        _patch_slidev_export_cli_port(log_path)
        return

    _append_log(log_path, "Slidev 依赖缺失，尝试自动安装...")
    cmd = _get_pnpm_command() + ["-C", str(WEB_DIR), "install"]
    try:
        result = subprocess.run(
            cmd,
            cwd=str(WEB_DIR),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError as exc:
        raise RuntimeError(f"鏃犳硶鎵惧埌 pnpm 鍛戒护: {exc}") from exc
    _append_log(log_path, f"运行命令: {' '.join(cmd)}")
    if result.stdout:
        _append_log(log_path, f"stdout:\n{result.stdout}")
    if result.stderr:
        _append_log(log_path, f"stderr:\n{result.stderr}")

    if result.returncode != 0:
        raise RuntimeError("Slidev 依赖安装失败，请先执行 pnpm install")
    if not theme_dir.exists():
        raise RuntimeError("Slidev 主题仍缺失，请检查 packages/web 依赖是否完整")
    _ensure_slidev_unocss_runtime(log_path)
    _patch_slidev_build(log_path)
    _patch_slidev_export(log_path)
    _patch_slidev_export_cli_port(log_path)


def _patch_slidev_export(log_path: Path) -> None:
    if os.getenv("SLIDEV_SKIP_PATCH", "").strip():
        _append_log(log_path, "跳过 Slidev 导出补丁")
        return

    root = _get_slidev_cli_root()
    targets = list(root.glob("@slidev+cli@*/node_modules/@slidev/cli/dist/export-*.mjs"))
    targets += list((WEB_DIR / "node_modules" / "@slidev" / "cli" / "dist").glob("export-*.mjs"))
    targets += list((REPO_ROOT / "node_modules" / "@slidev" / "cli" / "dist").glob("export-*.mjs"))
    if not targets:
        _append_log(log_path, "未找到 Slidev export 脚本，跳过补丁")
        return

    applied = 0
    for target in targets:
        try:
            content = target.read_text(encoding="utf-8")
        except OSError:
            continue

        bad_marker = "\\tpage.setDefaultTimeout(timeout);"
        if bad_marker in content:
            content = content.replace(bad_marker, "\tpage.setDefaultTimeout(timeout);")
            try:
                target.write_text(content, encoding="utf-8")
            except OSError:
                continue
            applied += 1
            continue

        if "page.setDefaultTimeout(timeout)" in content:
            continue

        marker = "})).newPage();"
        if marker not in content:
            continue

        content = content.replace(
            marker,
            f"{marker}\n\tpage.setDefaultTimeout(timeout);",
            1,
        )
        try:
            target.write_text(content, encoding="utf-8")
        except OSError:
            continue
        applied += 1

    if applied:
        _append_log(log_path, f"已应用 Slidev 导出补丁: {applied} 个文件")
    else:
        _append_log(log_path, "Slidev 导出补丁已存在或未应用")


def _patch_slidev_export_cli_port(log_path: Path) -> None:
    root = _get_slidev_cli_root()
    targets = list(root.glob("@slidev+cli@*/node_modules/@slidev/cli/dist/cli.mjs"))
    targets += list((WEB_DIR / "node_modules" / "@slidev" / "cli" / "dist").glob("cli.mjs"))
    targets += list((REPO_ROOT / "node_modules" / "@slidev" / "cli" / "dist").glob("cli.mjs"))
    if not targets:
        _append_log(log_path, "Slidev cli.mjs not found, skipping export port patch")
        return

    old_block = (
        '\t\tconst server = await createServer(options, {\n'
        '\t\t\tserver: { port },\n'
        '\t\t\tclearScreen: false\n'
        '\t\t});\n'
        '\t\tawait server.listen(port);\n'
        '\t\tprintInfo(options);\n'
        '\t\tconst result = await exportSlides({\n'
        '\t\t\tport,'
    )
    new_block = (
        '\t\tconst server = await createServer(options, {\n'
        '\t\t\tserver: { port },\n'
        '\t\t\tclearScreen: false\n'
        '\t\t});\n'
        '\t\tawait server.listen(port);\n'
        '\t\tconst actualPort = Number(server.httpServer?.address()?.port || server.config.server.port || port);\n'
        '\t\tprintInfo(options);\n'
        '\t\tconst result = await exportSlides({\n'
        '\t\t\tport: actualPort,'
    )

    applied = 0
    for target in targets:
        try:
            content = target.read_text(encoding="utf-8")
        except OSError:
            continue
        if "const actualPort = Number(server.httpServer?.address()?.port || server.config.server.port || port);" in content:
            continue
        if old_block not in content:
            continue
        content = content.replace(old_block, new_block, 1)
        try:
            target.write_text(content, encoding="utf-8")
        except OSError:
            continue
        applied += 1

    _append_log(log_path, f"Slidev cli export port patch applied to {applied} file(s)")


def _run_slidev(args: List[str], cwd: Path, log_path: Optional[Path] = None) -> None:
    cmd = _get_slidev_command() + args
    env = os.environ.copy()
    node_opts = env.get("NODE_OPTIONS")
    if node_opts and "--localstorage-file" in node_opts:
        cleaned = " ".join(
            part for part in node_opts.split() if not part.startswith("--localstorage-file")
        ).strip()
        if cleaned:
            env["NODE_OPTIONS"] = cleaned
        else:
            env.pop("NODE_OPTIONS", None)
    if log_path:
        _append_log(log_path, f"Preparing command: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
    except FileNotFoundError as exc:
        if log_path:
            _append_log(log_path, f"Command not found: {exc}")
        raise RuntimeError(f"Slidev command not found: {exc}") from exc
    if log_path:
        _append_log(log_path, f"运行命令: {' '.join(cmd)}")
        if result.stdout:
            _append_log(log_path, f"stdout:\n{result.stdout}")
        if result.stderr:
            _append_log(log_path, f"stderr:\n{result.stderr}")
    if result.returncode != 0:
        if log_path:
            _append_log(log_path, f"命令失败，返回码: {result.returncode}")
        raise RuntimeError(
            "Slidev 命令失败: "
            + " ".join(cmd)
            + f"\nreturncode: {result.returncode}\nstdout: {result.stdout}\nstderr: {result.stderr}"
            + (f"\nlog: {log_path}" if log_path else "")
        )


def _run_node(args: List[str], cwd: Path, log_path: Optional[Path] = None) -> None:
    cmd = _get_node_command() + args
    env = os.environ.copy()
    node_opts = env.get("NODE_OPTIONS")
    if node_opts and "--localstorage-file" in node_opts:
        cleaned = " ".join(
            part for part in node_opts.split() if not part.startswith("--localstorage-file")
        ).strip()
        if cleaned:
            env["NODE_OPTIONS"] = cleaned
        else:
            env.pop("NODE_OPTIONS", None)
    if log_path:
        _append_log(log_path, f"Preparing node command: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
    except FileNotFoundError as exc:
        if log_path:
            _append_log(log_path, f"Node command not found: {exc}")
        raise RuntimeError(f"Node command not found: {exc}") from exc
    if log_path:
        _append_log(log_path, f"Ran node command: {' '.join(cmd)}")
        if result.stdout:
            _append_log(log_path, f"node stdout:\n{result.stdout}")
        if result.stderr:
            _append_log(log_path, f"node stderr:\n{result.stderr}")
    if result.returncode != 0:
        if log_path:
            _append_log(log_path, f"Node command failed with return code: {result.returncode}")
        raise RuntimeError(
            "Node command failed: "
            + " ".join(cmd)
            + f"\nreturncode: {result.returncode}\nstdout: {result.stdout}\nstderr: {result.stderr}"
            + (f"\nlog: {log_path}" if log_path else "")
        )


def _slide_image_sort_key(path: Path) -> tuple[int, str]:
    match = re.search(r"(\d+)(?!.*\d)", path.stem)
    if match:
        return int(match.group(1)), path.name.lower()
    return 10**9, path.name.lower()


def _collect_exported_slide_images(images_dir: Path) -> List[Path]:
    if not images_dir.exists():
        return []
    images = [
        path
        for path in images_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    ]
    return sorted(images, key=_slide_image_sort_key)


def _count_pptx_slides(pptx_path: Path) -> int:
    try:
        with zipfile.ZipFile(pptx_path) as archive:
            return sum(
                1
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            )
    except (OSError, zipfile.BadZipFile):
        return 0


def _get_pptxgenjs_module_path() -> Path:
    candidates = [
        REPO_ROOT / "node_modules" / "pptxgenjs" / "dist" / "pptxgen.cjs.js",
        REPO_ROOT / "node_modules" / ".pnpm" / "node_modules" / "pptxgenjs" / "dist" / "pptxgen.cjs.js",
    ]
    candidates.extend(
        sorted(
            (REPO_ROOT / "node_modules" / ".pnpm").glob(
                "pptxgenjs@*/node_modules/pptxgenjs/dist/pptxgen.cjs.js"
            )
        )
    )
    for candidate in candidates:
        try:
            if candidate.exists():
                return candidate
        except OSError:
            continue
    raise RuntimeError("pptxgenjs runtime not found under repo node_modules")


def _build_pptx_from_images(images_dir: Path, pptx_path: Path, log_path: Path) -> None:
    image_paths = _collect_exported_slide_images(images_dir)
    if not image_paths:
        raise RuntimeError(f"No slide images exported under {images_dir}")

    script_path = images_dir.parent / "__build_pptx_from_images.cjs"
    pptxgenjs_module = _get_pptxgenjs_module_path()
    script_source = """const fs = require('node:fs')
const path = require('node:path')
const PptxGenJS = require(__PPTXGENJS__)

async function main() {
  const [, , outputPath, ...imagePaths] = process.argv
  if (!outputPath)
    throw new Error('Missing output pptx path')
  if (!imagePaths.length)
    throw new Error('Missing slide images')

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'MeetMind'
  pptx.company = 'MeetMind'
  pptx.subject = 'MeetMind slide export'
  pptx.title = path.basename(outputPath, path.extname(outputPath))

  for (const imagePath of imagePaths) {
    const slide = pptx.addSlide()
    slide.addImage({
      path: imagePath,
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
    })
  }

  await pptx.writeFile({ fileName: outputPath, compression: true })
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error))
  process.exit(1)
})
"""
    script_source = script_source.replace("__PPTXGENJS__", json.dumps(str(pptxgenjs_module)))
    script_path.write_text(script_source, encoding="utf-8")
    try:
        _run_node(
            [str(script_path), str(pptx_path), *[str(path) for path in image_paths]],
            cwd=REPO_ROOT,
            log_path=log_path,
        )
    finally:
        try:
            script_path.unlink(missing_ok=True)
        except OSError:
            pass

    if not pptx_path.exists() or pptx_path.stat().st_size <= 0:
        raise RuntimeError(f"Rebuilt PPTX was not created: {pptx_path}")

    slide_count = _count_pptx_slides(pptx_path)
    _append_log(
        log_path,
        f"Rebuilt PPTX from {len(image_paths)} exported slide images. slide_count={slide_count}",
    )


def _clear_dir(path: Path) -> None:
    if not path.exists():
        return
    for child in path.iterdir():
        if child.is_file():
            child.unlink(missing_ok=True)
        elif child.is_dir():
            for nested in child.rglob("*"):
                if nested.is_file():
                    nested.unlink(missing_ok=True)
            for nested in sorted(child.rglob("*"), reverse=True):
                if nested.is_dir():
                    nested.rmdir()
            child.rmdir()


def _build_fallback_slides(
    meeting_title: str,
    meeting_time: str,
    summary: Dict[str, Any],
    transcript: List[Dict[str, Any]],
) -> str:
    slides: List[str] = []
    cover = "\n".join(
        [
            "---",
            "theme: default",
            "layout: cover",
            "---",
            f"# {meeting_title}",
            "",
            meeting_time,
        ]
    )
    slides.append(cover)

    agenda_points = []
    if summary.get("abstract"):
        agenda_points.append("会议摘要")
    if summary.get("decisions"):
        agenda_points.append("关键决策")
    if summary.get("risks"):
        agenda_points.append("风险与问题")
    if summary.get("action_items"):
        agenda_points.append("行动项")
    if transcript:
        agenda_points.append("讨论要点")
    agenda_slide = "---\nlayout: default\n---\n# 会议议程\n\n" + "\n".join(f"- {p}" for p in agenda_points)
    slides.append(agenda_slide)

    if summary.get("abstract"):
        abstract = summary["abstract"]
        if len(abstract) > 120:
            abstract = abstract[:120] + "..."
        slides.append(f"---\nlayout: default\n---\n# 会议摘要\n\n- {abstract}")

    if summary.get("decisions"):
        decisions = "\n".join(f"- {item[:60]}" for item in summary["decisions"][:5])
        slides.append(f"---\nlayout: default\n---\n# 关键决策\n\n{decisions}")

    if summary.get("risks"):
        risks = "\n".join(f"- {item[:60]}" for item in summary["risks"][:5])
        slides.append(f"---\nlayout: default\n---\n# 风险与问题\n\n{risks}")

    if summary.get("action_items"):
        items = []
        for item in summary["action_items"][:5]:
            assignee = item.get("assignee") or "待定"
            due = item.get("due_date") or "未定"
            priority = item.get("priority") or "medium"
            title = item.get("title", "")[:40]
            items.append(f"| {title} | {assignee} | {due} | {priority} |")
        header = "| 事项 | 负责人 | 截止日期 | 优先级 |\n| --- | --- | --- | --- |"
        slides.append(f"---\nlayout: default\n---\n# 行动项\n\n{header}\n" + "\n".join(items))

    if transcript:
        highlights = transcript[:8]
        lines = [
            f"- **{seg.get('speaker','发言人')}**: {seg.get('text','')[:80]}"
            for seg in highlights
            if seg.get("text")
        ]
        if lines:
            slides.append("---\nlayout: default\n---\n# 讨论要点\n\n" + "\n".join(lines[:5]))

    slides.append("---\nlayout: default\n---\n# 下一步\n\n- 跟进行动项并定期回顾进度\n- 补充未决事项的负责人和截止时间")
    return "\n\n".join(slides)


async def generate_slidev_markdown(
    meeting_title: str,
    meeting_time: Optional[str],
    summary: Dict[str, Any],
    transcript: List[Dict[str, Any]],
) -> str:
    ai_service = get_ai_service()
    formatted_time = _format_meeting_time(meeting_time)
    transcript_sample = transcript[:120]
    try:
        return await ai_service.generate_slidev_markdown(
            meeting_title=meeting_title,
            meeting_time=formatted_time,
            summary=summary,
            transcript=transcript_sample,
        )
    except Exception:
        return _build_fallback_slides(meeting_title, formatted_time, summary, transcript_sample)


THEME_CONFIGS: Dict[str, str] = {
    "default": "",
    "dark": "\ncolorSchema: dark\n",
    "minimal": "\ncolorSchema: light\n",
    "corporate": "\ncolorSchema: light\n",
}

THEME_STYLES: Dict[str, str] = {
    "default": "",
    "dark": "\n<style>\n:root { --slidev-theme-primary: #64B5F6; }\n.slidev-layout { background: #1a1a2e; color: #e0e0e0; }\n</style>\n",
    "minimal": "\n<style>\n:root { --slidev-theme-primary: #333; }\n.slidev-layout { font-family: 'Helvetica Neue', sans-serif; }\n.slidev-layout h1 { font-weight: 300; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }\n</style>\n",
    "corporate": "\n<style>\n:root { --slidev-theme-primary: #1565C0; }\n.slidev-layout { background: linear-gradient(180deg, #f8f9fa 0%, #e8eaf0 100%); color: #263238; }\n.slidev-layout h1 { color: #1565C0; }\n</style>\n",
}


def _inject_theme(markdown: str, theme: str) -> str:
    if not theme or theme == "default":
        return markdown
    fm_extra = THEME_CONFIGS.get(theme, "")
    style_block = THEME_STYLES.get(theme, "")
    global_fm, body = _extract_global_frontmatter(markdown)
    if global_fm:
        # Insert theme config into existing global frontmatter
        lines = global_fm.splitlines()
        # Insert before closing ---
        if len(lines) >= 2 and lines[-1].strip() == "---":
            lines.insert(-1, fm_extra.strip())
            global_fm = "\n".join(lines)
        result = f"{global_fm}\n{style_block}\n{body}" if body else f"{global_fm}\n{style_block}"
    else:
        fm_block = f"---\ntheme: default{fm_extra}---\n{style_block}"
        result = f"{fm_block}\n{markdown}"
    return result


def build_slidev_assets(
    meeting_id: str,
    meeting_title: str,
    meeting_time: Optional[str],
    summary: Dict[str, Any],
    transcript: List[Dict[str, Any]],
    owner_id: Optional[str] = None,
    status_hook: Optional[Callable[[str, int, str], None]] = None,
    markdown_override: Optional[str] = None,
    theme: Optional[str] = None,
) -> Dict[str, str]:
    SLIDES_ROOT.mkdir(parents=True, exist_ok=True)
    meeting_dir = SLIDES_ROOT / meeting_id
    meeting_dir.mkdir(parents=True, exist_ok=True)
    dist_dir = meeting_dir / "dist"
    export_dir = meeting_dir / "exports"
    images_dir = meeting_dir / "images"
    dist_dir.mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    log_path = meeting_dir / LOG_FILENAME
    _append_log(log_path, "开始生成 PPT 资源")
    if status_hook:
        status_hook("processing", 10, "检查 Slidev 依赖...")

    _ensure_slidev_deps(log_path)

    if status_hook:
        status_hook("processing", 15, "清理旧的输出...")
    _clear_dir(dist_dir)
    _clear_dir(export_dir)
    _clear_dir(images_dir)

    if status_hook:
        status_hook("processing", 20, "生成幻灯片内容...")

    markdown_path = meeting_dir / "slides.md"
    if markdown_override:
        markdown = markdown_override
        _append_log(log_path, "使用自定义 Markdown 构建")
    else:
        markdown = asyncio.run(
            generate_slidev_markdown(meeting_title, meeting_time, summary, transcript)
        )

    original_markdown = markdown
    markdown = _normalize_markdown_unicode(markdown)
    markdown = _unwrap_outer_markdown_fence(markdown)
    markdown = _sanitize_remote_images(markdown)
    markdown = _sanitize_markdown_separators(markdown)
    markdown = _sanitize_slidev_wrapper_tags(markdown)
    markdown = _sanitize_unbalanced_code_fences(markdown)
    markdown = _sanitize_mermaid_blocks(markdown)
    if markdown != original_markdown:
        _append_log(log_path, "已清理 Slidev Markdown 中的分隔符、远程图片和 Mermaid 语法风险")

    if theme and theme != "default":
        markdown = _inject_theme(markdown, theme)

    run_id = uuid.uuid4().hex[:8]
    temp_dir = TEMP_SLIDEV_DIR / meeting_id / run_id
    temp_dir.mkdir(parents=True, exist_ok=True)

    background_config = load_background_config(meeting_id)
    has_backgrounds = bool(background_config.get("global_id") or (background_config.get("slides") or {}))
    asset_map: Dict[str, str] = {}
    if has_backgrounds:
        asset_map = _prepare_background_assets(temp_dir, meeting_id, owner_id, log_path)
        if asset_map:
            markdown = _apply_backgrounds_to_markdown(markdown, background_config, asset_map)
            _ensure_background_layout(temp_dir, log_path)
            _append_log(log_path, "已应用 PPT 背景配置")

    markdown_path.write_text(markdown, encoding="utf-8")
    _append_log(log_path, f"写入 Markdown: {markdown_path}")
    runtime_markdown = _replace_markdown_tables_with_images(markdown, temp_dir, log_path)
    if runtime_markdown != markdown:
        _append_log(log_path, "已将 Markdown 表格转换为本地图片，以提高 PPT/PDF 导出稳定性")
    temp_markdown_path = _prepare_slidev_entry(temp_dir, runtime_markdown, log_path)

    def ensure_temp_markdown() -> None:
        if not temp_markdown_path.exists():
            temp_markdown_path.parent.mkdir(parents=True, exist_ok=True)
            temp_markdown_path.write_text(runtime_markdown, encoding="utf-8")
            _append_log(log_path, f"临时 Markdown 丢失，已重建: {temp_markdown_path}")

    def ensure_temp_assets() -> None:
        if not asset_map:
            return
        for asset_id, rel_path in asset_map.items():
            dest_path = None
            if rel_path.startswith("/ppt-backgrounds/"):
                dest_path = temp_dir / "public" / rel_path.lstrip("/")
            elif rel_path.startswith("./"):
                rel = rel_path.replace("./", "")
                dest_path = temp_dir / rel
            if dest_path is None:
                continue
            if dest_path.exists():
                continue
            src_path = resolve_asset_path(asset_id, owner_id)
            if not src_path or not src_path.exists():
                _append_log(log_path, f"背景素材丢失: {asset_id}")
                continue
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_path, dest_path)
            _append_log(log_path, f"重新复制背景素材: {dest_path}")

    def ensure_temp_layout() -> None:
        if not asset_map:
            return
        layout_path = temp_dir / "layouts" / "background.vue"
        if layout_path.exists():
            return
        _ensure_background_layout(temp_dir, log_path)

    if status_hook:
        status_hook("processing", 40, "构建预览页面...")

    ensure_temp_markdown()
    ensure_temp_assets()
    ensure_temp_layout()
    _run_slidev(
        ["build", str(temp_markdown_path), "--out", str(dist_dir)],
        cwd=WEB_DIR,
        log_path=log_path,
    )

    safe_title = _safe_filename(meeting_title)
    pdf_path = export_dir / f"{safe_title}.pdf"
    pptx_path = export_dir / f"{safe_title}.pptx"
    run_images_dir = temp_dir / "__images_export"
    run_images_dir.mkdir(parents=True, exist_ok=True)

    if status_hook:
        status_hook("processing", 55, "导出预览图片...")
    try:
        _clear_dir(run_images_dir)
        ensure_temp_markdown()
        ensure_temp_assets()
        ensure_temp_layout()
        _run_slidev(
            [
                "export",
                str(temp_markdown_path),
                "--format",
                "png",
                "--output",
                str(run_images_dir),
                "--per-slide",
                *_get_export_flags(),
            ],
            cwd=WEB_DIR,
            log_path=log_path,
        )
        _append_log(
            log_path,
            f"PNG export completed: {run_images_dir}; count={len(_collect_exported_slide_images(run_images_dir))}",
        )

        if status_hook:
            status_hook("processing", 65, "导出 PDF...")
        ensure_temp_markdown()
        ensure_temp_assets()
        ensure_temp_layout()
        _run_slidev(
            [
                "export",
                str(temp_markdown_path),
                "--format",
                "pdf",
                "--output",
                str(pdf_path),
                *_get_export_flags(),
            ],
            cwd=WEB_DIR,
            log_path=log_path,
        )
        _append_log(log_path, f"PDF 导出完成: {pdf_path}")

        if status_hook:
            status_hook("processing", 80, "导出 PPTX...")
        _build_pptx_from_images(run_images_dir, pptx_path, log_path)
        _clear_dir(images_dir)
        images_dir.mkdir(parents=True, exist_ok=True)
        for image_path in _collect_exported_slide_images(run_images_dir):
            shutil.copy2(image_path, images_dir / image_path.name)
        _append_log(log_path, f"Copied final slide images to shared directory: {images_dir}")
        _append_log(log_path, f"PPTX rebuilt from exported slide images: {pptx_path}")
    finally:
        _cleanup_slidev_entry(temp_dir, log_path)
    _append_log(log_path, "PPT 资源生成完成")

    preview_url = f"/api/v1/meetings/{meeting_id}/slides/preview/index.html"
    return {
        "preview_url": preview_url,
        "pdf_path": str(pdf_path),
        "pptx_path": str(pptx_path),
    }
