from __future__ import annotations

import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "development-guide.md"
TARGET = ROOT / "docs" / "development-guide.docx.html"


def inline_format(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    return escaped


def parse_table(lines: list[str], start: int) -> tuple[str, int]:
    table_lines: list[str] = []
    i = start
    while i < len(lines) and lines[i].lstrip().startswith("|"):
        table_lines.append(lines[i].rstrip("\n"))
        i += 1

    if len(table_lines) < 2:
        return f"<p>{inline_format(table_lines[0].strip())}</p>", i

    def split_row(row: str) -> list[str]:
        placeholder = "__PIPE__"
        row = row.replace(r"\|", placeholder).strip().strip("|")
        parts = [part.strip().replace(placeholder, "|") for part in row.split("|")]
        return parts

    headers = split_row(table_lines[0])
    body_rows = []
    for row in table_lines[2:]:
        body_rows.append(split_row(row))

    html_rows = ["<table>", "<thead><tr>"]
    for cell in headers:
        html_rows.append(f"<th>{inline_format(cell)}</th>")
    html_rows.append("</tr></thead><tbody>")
    for row in body_rows:
        html_rows.append("<tr>")
        for cell in row:
            html_rows.append(f"<td>{inline_format(cell)}</td>")
        html_rows.append("</tr>")
    html_rows.append("</tbody></table>")
    return "".join(html_rows), i


def parse_codeblock(lines: list[str], start: int) -> tuple[str, int]:
    first = lines[start].rstrip("\n")
    lang = first[3:].strip()
    code_lines: list[str] = []
    i = start + 1
    while i < len(lines) and not lines[i].startswith("```"):
        code_lines.append(lines[i].rstrip("\n"))
        i += 1
    if i < len(lines):
        i += 1
    code = "\n".join(code_lines)
    class_name = f' class="code {html.escape(lang)}"' if lang else ' class="code"'
    return f"<pre{class_name}>{html.escape(code)}</pre>", i


def parse_list(lines: list[str], start: int) -> tuple[str, int]:
    bullet = lines[start].lstrip().startswith("- ")
    tag = "ul" if bullet else "ol"
    items: list[str] = [f"<{tag}>"]
    i = start
    while i < len(lines):
        stripped = lines[i].lstrip()
        if bullet and stripped.startswith("- "):
            content = stripped[2:].strip()
            items.append(f"<li>{inline_format(content)}</li>")
            i += 1
            continue
        if not bullet and re.match(r"^\d+\.\s+", stripped):
            content = re.sub(r"^\d+\.\s+", "", stripped).strip()
            items.append(f"<li>{inline_format(content)}</li>")
            i += 1
            continue
        break
    items.append(f"</{tag}>")
    return "".join(items), i


def parse_paragraph(lines: list[str], start: int) -> tuple[str, int]:
    parts: list[str] = []
    i = start
    while i < len(lines):
        stripped = lines[i].rstrip("\n")
        if not stripped.strip():
            break
        if (
            stripped.startswith("#")
            or stripped.startswith("|")
            or stripped.startswith("```")
            or stripped.lstrip().startswith("- ")
            or re.match(r"^\s*\d+\.\s+", stripped)
            or stripped.strip() == "---"
        ):
            break
        parts.append(stripped.strip())
        i += 1
    return f"<p>{inline_format(' '.join(parts))}</p>", i


def render_body(markdown: str) -> str:
    lines = markdown.splitlines(keepends=True)
    i = 0
    blocks: list[str] = []
    while i < len(lines):
        line = lines[i].rstrip("\n")
        stripped = line.strip()
        if not stripped:
            i += 1
            continue
        if stripped == "---":
            blocks.append('<div class="hr"></div>')
            i += 1
            continue
        if line.startswith("```"):
            block, i = parse_codeblock(lines, i)
            blocks.append(block)
            continue
        if line.lstrip().startswith("|"):
            block, i = parse_table(lines, i)
            blocks.append(block)
            continue
        if line.lstrip().startswith("- ") or re.match(r"^\s*\d+\.\s+", line):
            block, i = parse_list(lines, i)
            blocks.append(block)
            continue
        heading_match = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            text = inline_format(heading_match.group(2).strip())
            html_level = min(level + 1, 5)
            blocks.append(f"<h{html_level}>{text}</h{html_level}>")
            i += 1
            continue
        block, i = parse_paragraph(lines, i)
        blocks.append(block)
    return "\n".join(blocks)


def build_cover() -> str:
    return """
<section class="cover">
  <p class="blank"></p>
  <p class="title-1"><b>绗崄涔濆眾鍏ㄥ浗澶у鐢熻蒋浠跺垱鏂板ぇ璧?/b></p>
  <p class="title-2">鏂囨。缂栧彿锛歋WC2026-MEETMIND</p>
  <p class="title-3">椤圭洰 LOGO锛氬緟琛ュ厖</p>
  <p class="project-name"><b>MeetMind</b></p>
  <p class="project-name"><b>MeetMind</b></p>
  <p class="doc-title"><b>椤圭洰寮€鍙戞枃妗?/b></p>
  <p class="version">Version: 1.1</p>
  <p class="title-3">Team LOGO锛氬緟琛ュ厖</p>
  <p class="team-name"><b>寰呰ˉ鍏?/b></p>
  <p class="date">2026-03-24</p>
  <p class="rights"><b>All Rights Reserved</b></p>
</section>
<div class="page-break"></div>
"""


def build_html(markdown: str) -> str:
    body = render_body(markdown)
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <title>MeetMind 椤圭洰寮€鍙戞枃妗?/title>
  <style>
    body {{
      font-family: "Times New Roman", "Songti SC", serif;
      font-size: 12pt;
      line-height: 1.7;
      color: #000;
      margin: 28pt 42pt;
    }}
    .cover p {{
      text-align: center;
      margin: 0;
    }}
    .blank {{ height: 24pt; }}
    .title-1 {{ font-size: 20pt; margin-top: 24pt; }}
    .title-2 {{ font-size: 13pt; margin-top: 12pt; }}
    .title-3 {{ font-size: 11pt; color: #666; margin-top: 18pt; }}
    .project-name {{ font-size: 24pt; margin-top: 28pt; }}
    .doc-title {{ font-size: 22pt; margin-top: 30pt; }}
    .version {{ font-size: 13pt; margin-top: 10pt; }}
    .team-name {{ font-size: 16pt; margin-top: 18pt; }}
    .date {{ font-size: 12pt; margin-top: 18pt; }}
    .rights {{ font-size: 12pt; margin-top: 10pt; }}
    .page-break {{ page-break-after: always; }}
    .hr {{
      border-top: 1px solid #999;
      margin: 16pt 0;
    }}
    h2 {{
      font-size: 18pt;
      margin: 18pt 0 8pt 0;
      text-align: left;
    }}
    h3 {{
      font-size: 16pt;
      margin: 16pt 0 6pt 0;
      text-align: left;
    }}
    h4 {{
      font-size: 14pt;
      margin: 12pt 0 4pt 0;
      text-align: left;
    }}
    h5 {{
      font-size: 12pt;
      margin: 10pt 0 4pt 0;
      text-align: left;
      font-weight: bold;
    }}
    p {{
      margin: 0 0 8pt 0;
      text-align: justify;
      text-indent: 2em;
    }}
    ul, ol {{
      margin: 0 0 8pt 28pt;
      padding-left: 18pt;
    }}
    li {{
      margin: 2pt 0;
    }}
    code {{
      font-family: "Courier New", monospace;
      font-size: 10pt;
      background: #f3f3f3;
      padding: 0 2pt;
    }}
    pre.code {{
      font-family: "Courier New", monospace;
      font-size: 9pt;
      line-height: 1.45;
      background: #fafafa;
      border: 1px solid #d8d8d8;
      padding: 8pt;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 8pt 0 12pt 0;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0 12pt 0;
      font-size: 10.5pt;
    }}
    th, td {{
      border: 1px solid #bfbfbf;
      padding: 4pt 6pt;
      vertical-align: top;
    }}
    th {{
      text-align: center;
      font-weight: bold;
      background: #f6f6f6;
    }}
  </style>
</head>
<body>
{build_cover()}
{body}
</body>
</html>
"""


def main() -> None:
    markdown = SOURCE.read_text(encoding="utf-8")
    marker = "## 鐩綍"
    if marker in markdown:
        markdown = markdown[markdown.index(marker) :]
    html_doc = build_html(markdown)
    TARGET.write_text(html_doc, encoding="utf-8")
    print(TARGET)


if __name__ == "__main__":
    main()
