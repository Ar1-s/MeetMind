from __future__ import annotations

import asyncio
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .base import AIService
from .config import get_ai_config

T = TypeVar("T")


class QwenService(AIService):
    def __init__(self):
        config = get_ai_config().tongyi
        self.api_key = config.api_key
        self.base_url = config.base_url.rstrip("/")
        self.model = config.model
        self.chat_model = config.chat_model
        self.transcription_model = config.transcription_model
        self.http_client = httpx.Client(
            trust_env=False,
            timeout=300.0,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )

    def _extract_message_text(self, response: Any) -> str:
        if isinstance(response, dict):
            content = (
                response.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
        else:
            content = response.choices[0].message.content

        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        parts.append(item.get("text", ""))
                    elif "text" in item:
                        parts.append(str(item["text"]))
                else:
                    text_value = getattr(item, "text", None)
                    if text_value:
                        parts.append(str(text_value))
            return "".join(parts)
        return ""

    def _parse_json_text(self, text: str) -> dict[str, Any]:
        stripped = (text or "").strip()
        if not stripped:
            raise ValueError("Model returned empty response for JSON task.")
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            match = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", stripped, re.DOTALL)
            if match:
                return json.loads(match.group(1))

            snippet = self._extract_balanced_json_snippet(stripped)
            if snippet:
                return json.loads(snippet)
            raise

    def _extract_balanced_json_snippet(self, text: str) -> str | None:
        start = next((idx for idx, char in enumerate(text) if char in "{["), None)
        if start is None:
            return None

        opening = text[start]
        closing = "}" if opening == "{" else "]"
        depth = 0
        in_string = False
        escape = False

        for idx in range(start, len(text)):
            char = text[idx]
            if in_string:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == "\"":
                    in_string = False
                continue

            if char == "\"":
                in_string = True
                continue
            if char == opening:
                depth += 1
                continue
            if char == closing:
                depth -= 1
                if depth == 0:
                    return text[start : idx + 1]

        return None

    async def _repair_json_with_model(
        self,
        *,
        model: str,
        schema: Type[BaseModel],
        raw_text: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
        repair_messages = [
            {
                "role": "system",
                "content": (
                    "You repair malformed JSON. Return ONLY valid JSON with no markdown fences "
                    "and no explanation. Preserve the original meaning as much as possible."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Fix the following malformed JSON so it matches this JSON schema.\n"
                    f"JSON schema:\n{schema_json}\n\n"
                    f"Malformed JSON:\n{raw_text[:12000]}"
                ),
            },
        ]

        def _chat():
            return self._chat_completion_request(
                model=model,
                messages=repair_messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        response = await self._run_in_thread_with_retry("json repair", _chat, attempts=2)
        repaired_raw = self._extract_message_text(response)
        return self._parse_json_text(repaired_raw)

    def _chat_completion_request(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        response = self.http_client.post(
            f"{self.base_url}/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        response.raise_for_status()
        return response.json()

    async def _chat_json(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        schema: Type[BaseModel],
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
        instruction = (
            "Return ONLY valid JSON. Do not include markdown fences or extra text.\n"
            f"JSON schema:\n{schema_json}"
        )
        full_messages = [{"role": "system", "content": instruction}, *messages]

        system_prompt = (
            "你是专业的会议演示文档助手。请输出纯 Slidev Markdown，不要额外解释。"
            "不要输出 <v-click>、</v-click>、<v-clicks>、</v-clicks>、<v-after> 等 Vue/HTML 交互标签。"
            "不要输出未闭合或孤立的 HTML 标签。"
            "如需强调内容，请使用普通 Markdown 列表、标题、引用、表格和分栏语法。"
        )
        user_prompt = (
            "基于以下素材生成 8-12 页 Slidev。\n"
            "要求：结构清晰、适合汇报、兼容 Slidev 构建，不要输出任何自定义 HTML/Vue 包裹标签。\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )

        def _chat():
            return self._chat_completion_request(
                model=model,
                messages=full_messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        response = await self._run_in_thread_with_retry("chat completion", _chat)
        raw = self._extract_message_text(response)
        parsed = self._parse_json_text(raw)
        validated = schema.model_validate(parsed)
        return validated.model_dump()

    async def _chat_json(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        schema: Type[BaseModel],
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
        instruction = (
            "Return ONLY valid JSON. Do not include markdown fences or extra text.\n"
            f"JSON schema:\n{schema_json}"
        )
        full_messages = [{"role": "system", "content": instruction}, *messages]

        def _chat():
            return self._chat_completion_request(
                model=model,
                messages=full_messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        response = await self._run_in_thread_with_retry("chat completion", _chat)
        raw = self._extract_message_text(response)
        parsed = self._parse_json_text(raw)
        validated = schema.model_validate(parsed)
        return validated.model_dump()

    async def _chat_json(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        schema: Type[BaseModel],
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
        instruction = (
            "Return ONLY valid JSON. Do not include markdown fences or extra text.\n"
            f"JSON schema:\n{schema_json}"
        )
        full_messages = [{"role": "system", "content": instruction}, *messages]

        def _chat():
            return self._chat_completion_request(
                model=model,
                messages=full_messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        response = await self._run_in_thread_with_retry("chat completion", _chat)
        raw = self._extract_message_text(response)

        try:
            parsed = self._parse_json_text(raw)
            validated = schema.model_validate(parsed)
            return validated.model_dump()
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            repaired = await self._repair_json_with_model(
                model=model,
                schema=schema,
                raw_text=raw,
                temperature=0,
                max_tokens=max_tokens,
            )
            try:
                validated = schema.model_validate(repaired)
                return validated.model_dump()
            except ValidationError:
                raise exc

    async def _get_audio_duration(self, audio_path: str) -> float:
        def _probe():
            ffprobe_bin = self._resolve_binary("ffprobe")
            if not ffprobe_bin:
                raise FileNotFoundError("ffprobe")
            cmd = [
                ffprobe_bin,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                audio_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return float(result.stdout.strip())

        try:
            return await asyncio.to_thread(_probe)
        except FileNotFoundError as exc:
            raise RuntimeError("音频转写需要 ffprobe 处理长音频切片，但当前环境未安装或未配置 ffprobe。") from exc

    def _audio_format_from_path(self, audio_path: str) -> str:
        ext = os.path.splitext(audio_path)[1].lower().lstrip(".")
        return ext if ext in {"wav", "mp3", "m4a", "aac", "flac", "ogg", "webm"} else "mp3"

    def _resolve_binary(self, name: str) -> str | None:
        env_name = "FFPROBE_PATH" if name == "ffprobe" else "FFMPEG_PATH" if name == "ffmpeg" else None
        if env_name:
            configured = os.getenv(env_name, "").strip()
            if configured and Path(configured).exists():
                return configured

        discovered = shutil.which(name)
        if discovered:
            return discovered
        return None

    def _binary_exists(self, name: str) -> bool:
        return self._resolve_binary(name) is not None

    def _make_temp_chunk_path(self, prefix: str, suffix: str = ".mp3") -> str:
        fd, temp_path = tempfile.mkstemp(prefix=prefix, suffix=suffix)
        os.close(fd)
        return temp_path

    def _is_retryable_remote_error(self, exc: BaseException | None) -> bool:
        if exc is None:
            return False

        pending: list[BaseException] = [exc]
        seen: set[int] = set()
        markers = (
            "connection aborted",
            "connection reset",
            "connection forcibly closed",
            "远程主机强迫关闭了一个现有的连接",
            "10054",
            "receive batching backend response failed",
            "batching backend response failed",
            "read timed out",
            "timed out",
            "timeout",
            "connection broken",
            "remote end closed connection",
        )

        while pending:
            current = pending.pop()
            current_id = id(current)
            if current_id in seen:
                continue
            seen.add(current_id)

            if isinstance(current, (ConnectionError, TimeoutError, httpx.TransportError, httpx.TimeoutException)):
                return True
            if getattr(current, "winerror", None) == 10054:
                return True

            message = str(current).lower()
            if any(marker in message for marker in markers):
                return True

            cause = getattr(current, "__cause__", None)
            context = getattr(current, "__context__", None)
            if isinstance(cause, BaseException):
                pending.append(cause)
            if isinstance(context, BaseException):
                pending.append(context)

        return False

    async def _run_in_thread_with_retry(
        self,
        label: str,
        func: Callable[[], T],
        *,
        attempts: int = 3,
        base_delay_seconds: float = 1.0,
    ) -> T:
        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                return await asyncio.to_thread(func)
            except Exception as exc:
                last_error = exc
                if attempt >= attempts or not self._is_retryable_remote_error(exc):
                    raise

                delay_seconds = base_delay_seconds * attempt
                print(
                    f"[Qwen] {label} failed on attempt {attempt}/{attempts}: "
                    f"{exc}. Retrying in {delay_seconds:.1f}s..."
                )
                await asyncio.sleep(delay_seconds)

        assert last_error is not None
        raise last_error

    async def _safe_remove_temp_file(
        self, file_path: str, *, attempts: int = 10, delay_seconds: float = 0.5
    ) -> None:
        if not file_path:
            return

        last_error: OSError | None = None
        for attempt in range(1, attempts + 1):
            try:
                await asyncio.to_thread(os.remove, file_path)
                return
            except FileNotFoundError:
                return
            except PermissionError as exc:
                last_error = exc
            except OSError as exc:
                if getattr(exc, "winerror", None) != 32:
                    print(f"[Qwen] Failed to remove temporary chunk {file_path}: {exc}")
                    return
                last_error = exc

            if attempt < attempts:
                await asyncio.sleep(delay_seconds)

        if last_error is not None:
            print(
                "[Qwen] Temporary chunk remained locked after retries; "
                f"skipping cleanup for now: {file_path} ({last_error})"
            )

    @contextmanager
    def _without_proxy_env(self):
        proxy_keys = [
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "http_proxy",
            "https_proxy",
            "ALL_PROXY",
            "all_proxy",
        ]
        original = {key: os.environ.pop(key) for key in proxy_keys if key in os.environ}
        try:
            yield
        finally:
            os.environ.update(original)

    def _dashscope_http_api_url(self) -> str:
        if "/compatible-mode/v1" in self.base_url:
            return self.base_url.replace("/compatible-mode/v1", "/api/v1")
        return "https://dashscope.aliyuncs.com/api/v1"

    def _extract_qwen_asr_text(self, response: Any) -> str:
        output = getattr(response, "output", None)
        choices = getattr(output, "choices", None) or []
        if not choices:
            return ""

        message = getattr(choices[0], "message", None)
        content = getattr(message, "content", None) or []
        if isinstance(content, str):
            return content.strip()

        texts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
            else:
                text = getattr(item, "text", None)
            if text:
                texts.append(str(text))
        return "\n".join(texts).strip()

    def _dashscope_file_uri(self, audio_path: str) -> str:
        resolved = Path(audio_path).resolve()
        posix_path = resolved.as_posix()
        if re.match(r"^[A-Za-z]:/", posix_path):
            return f"file://{posix_path}"
        return resolved.as_uri()

    async def _transcribe_with_qwen_asr_sdk_chunk(self, audio_path: str) -> tuple[str, float]:
        def _run():
            try:
                import dashscope
            except ImportError as exc:
                raise RuntimeError("当前环境缺少 dashscope SDK，无法使用通义语音转写。") from exc

            dashscope.api_key = self.api_key
            dashscope.base_http_api_url = self._dashscope_http_api_url()

            with self._without_proxy_env():
                resp = dashscope.MultiModalConversation.call(
                    model=self.transcription_model,
                    messages=[{"role": "user", "content": [{"audio": self._dashscope_file_uri(audio_path)}]}],
                    result_format="message",
                    asr_options={"enable_itn": False},
                )

            status_code = getattr(resp, "status_code", None)
            if status_code and int(status_code) >= 400:
                raise RuntimeError(
                    f"通义语音转写失败: {getattr(resp, 'code', '')} {getattr(resp, 'message', '')}".strip()
                )

            text = self._extract_qwen_asr_text(resp)
            if not text:
                raise RuntimeError("通义语音转写返回为空。")

            usage = getattr(resp, "usage", None)
            seconds = getattr(usage, "seconds", None) if usage is not None else None
            return text, float(seconds or 0)

        return await self._run_in_thread_with_retry("Qwen ASR SDK request", _run, attempts=4)

    async def _transcribe_with_qwen_asr(self, audio_path: str) -> Dict[str, Any]:
        limit_bytes = 10 * 1024 * 1024
        chunk_duration = 60
        file_size = os.path.getsize(audio_path)

        try:
            text, duration_seconds = await self._transcribe_with_qwen_asr_sdk_chunk(audio_path)
            return {
                "segments": [
                    {
                        "start": 0.0,
                        "end": duration_seconds,
                        "speaker": "Speaker",
                        "text": text,
                        "confidence": 0.9,
                    }
                ],
                "duration": duration_seconds,
            }
        except Exception as exc:
            direct_error = str(exc).strip() or exc.__class__.__name__
            if file_size <= limit_bytes:
                raise RuntimeError(f"通义语音转写失败: {direct_error}") from exc

            if not (self._binary_exists("ffprobe") and self._binary_exists("ffmpeg")):
                raise RuntimeError(
                    "通义整文件转写失败，且当前环境未安装 ffprobe/ffmpeg，无法继续对大文件做本地切片。"
                    f" 原始错误: {direct_error}"
                ) from exc

        full_duration = await self._get_audio_duration(audio_path)
        num_chunks = math.ceil(full_duration / chunk_duration)
        all_segments: list[dict[str, Any]] = []

        for index in range(num_chunks):
            start_time = index * chunk_duration
            chunk_filename = self._make_temp_chunk_path(prefix=f"qwen_chunk_{index}_")

            def _split_chunk():
                ffmpeg_bin = self._resolve_binary("ffmpeg")
                if not ffmpeg_bin:
                    raise FileNotFoundError("ffmpeg")
                cmd = [
                    ffmpeg_bin,
                    "-y",
                    "-i",
                    audio_path,
                    "-ss",
                    str(start_time),
                    "-t",
                    str(chunk_duration),
                    "-acodec",
                    "libmp3lame",
                    "-b:a",
                    "64k",
                    chunk_filename,
                ]
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            await asyncio.to_thread(_split_chunk)
            try:
                text, _ = await self._transcribe_with_qwen_asr_sdk_chunk(chunk_filename)
                actual_duration = min(chunk_duration, max(0.0, full_duration - start_time))
                all_segments.append(
                    {
                        "start": float(start_time),
                        "end": float(start_time + actual_duration),
                        "speaker": "Speaker",
                        "text": text,
                        "confidence": 0.9,
                    }
                )
            finally:
                await self._safe_remove_temp_file(chunk_filename)

        return {"segments": all_segments, "duration": full_duration}

    async def transcribe_audio(self, audio_path: str) -> Dict[str, Any]:
        print(f"[Qwen] Transcribing with {self.transcription_model}: {audio_path}")
        return await self._transcribe_with_qwen_asr(audio_path)

    async def generate_summary(
        self,
        transcript: list[dict],
        participant_context: dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        from app.schemas.ai_output import MeetingSummary

        transcript_text = "\n".join(
            [
                f"[start={int(float(seg.get('start', 0) or 0))} end={int(float(seg.get('end', 0) or 0))}] "
                f"{seg.get('speaker', 'Speaker')}: {seg.get('text', '')}"
                for seg in transcript
            ]
        )
        if len(transcript_text) > 100000:
            transcript_text = transcript_text[:100000] + "...(truncated)"

        participant_context = participant_context or {}
        participant_lines: list[str] = []
        for participant in participant_context.get("participants") or []:
            name = participant.get("name")
            if not name:
                continue
            extras: list[str] = []
            if participant.get("role"):
                extras.append(f"角色: {participant['role']}")
            alias = (participant_context.get("participant_aliases") or {}).get(name)
            if alias:
                extras.append(f"匿名显示名: {alias}")
            participant_lines.append(f"- {name}" + (f"（{'，'.join(extras)}）" if extras else ""))

        participant_block = "\n".join(participant_lines) if participant_lines else "- 未提供参会人名单"
        anonymize_enabled = bool(participant_context.get("anonymize_participants"))

        system_prompt = (
            "你是专业的会议纪要生成助手。请根据会议转写文本生成结构化会议纪要。"
            "需要输出 abstract、decisions、risks、action_items、mindmap_nodes、sentiment_score、emotion_flags。"
            "参会人名单是识别人名和责任人的唯一标准来源。"
            "如果转写中出现“张总、老张、小李”等称呼，请尽量映射为名单中的标准姓名。"
            "输出时不要使用昵称或自创化名，统一使用参会人名单中的标准姓名。"
            "如果无法确认责任人，请将 assignee 设为 null。"
            "请尽量为每个 action_items 提供 source_segment_start、source_segment_end、source_quote。"
            "时间字段必须直接使用转写文本中的秒数，无法确认时填写 null。"
        )
        if anonymize_enabled:
            system_prompt += (
                "当前会议启用了匿名展示，系统会在界面层将标准姓名映射为化名，"
                "所以你仍然必须输出标准姓名，不要直接输出化名。"
            )

        user_prompt = (
            f"参会人名单：\n{participant_block}\n\n"
            f"会议转写文本（每段都带 start/end 秒数）：\n{transcript_text}\n\n"
            "请输出会议纪要 JSON，并尽可能为每个 action_items 提供来源时间段。"
        )

        data = await self._chat_json(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            schema=MeetingSummary,
            temperature=0.3,
            max_tokens=4000,
        )
        data["mindmap"] = {"type": "reactflow", "nodes": data.pop("mindmap_nodes", [])}
        return data

    async def generate_slidev_markdown(
        self,
        meeting_title: str,
        meeting_time: str,
        summary: Dict[str, Any],
        transcript: list[dict],
    ) -> str:
        transcript_text = "\n".join([f"{seg.get('speaker', 'Unknown')}: {seg.get('text', '')}" for seg in transcript])
        if len(transcript_text) > 120000:
            transcript_text = transcript_text[:120000] + "...(truncated)"

        system_prompt = "你是专业的会议演示文档助手。请输出纯 Slidev Markdown，不要代码块，不要额外解释。"
        payload = {
            "meeting": {"title": meeting_title, "time": meeting_time},
            "summary": summary,
            "transcript": transcript,
        }
        user_prompt = f"基于以下素材生成 8-12 页 Slidev：\n{json.dumps(payload, ensure_ascii=False)}"

        def _chat():
            return self._chat_completion_request(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=6000,
            )

        response = await self._run_in_thread_with_retry("slide generation", _chat)
        return self._extract_message_text(response).strip()

    async def parse_instruction(self, instruction: str, system_prompt: str) -> Dict[str, Any]:
        from app.schemas.ai_output import ToolParsingResult

        return await self._chat_json(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction},
            ],
            schema=ToolParsingResult,
            temperature=0.1,
            max_tokens=1200,
        )

    async def chat(self, messages: list[dict], temperature: float = 0.7) -> str:
        def _chat():
            return self._chat_completion_request(
                model=self.chat_model,
                messages=messages,
                temperature=temperature,
                max_tokens=500,
            )

        response = await self._run_in_thread_with_retry("chat", _chat)
        return self._extract_message_text(response)

    async def edit_mindmap(self, current_mindmap: dict, instruction: str) -> dict:
        from app.schemas.ai_output import MindMap

        current_nodes_str = json.dumps(current_mindmap.get("nodes", []), ensure_ascii=False, indent=2)
        system_prompt = (
            "你是思维导图编辑助手。根据用户指令修改导图。"
            "节点 type 只能是 topic、subtopic、detail；根节点 parent_id 为 null。"
        )
        user_prompt = f"当前导图节点：\n{current_nodes_str}\n\n用户指令：{instruction}"

        return await self._chat_json(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            schema=MindMap,
            temperature=0.3,
            max_tokens=2000,
        )

    async def edit_mindmap(self, current_mindmap: dict, instruction: str) -> dict:
        from app.schemas.ai_output import MindMap

        current_nodes_str = json.dumps(current_mindmap.get("nodes", []), ensure_ascii=False, indent=2)
        system_prompt = (
            "你是思维导图编辑助手。请根据用户指令修改思维导图，并且只返回合法 JSON。"
            "不要输出 markdown、解释、注释、代码块或任何前后缀文字。"
            "返回格式必须是 {\"type\":\"reactflow\",\"nodes\":[...]}。"
            "节点 type 只能是 topic、subtopic、detail；根节点 parent_id 必须为 null。"
            "尽量保留原有节点 id；新增节点时使用 node_数字。"
            "label 要简短，description 保持单段文本，避免未转义双引号和多余换行。"
        )
        user_prompt = (
            f"当前导图节点：\n{current_nodes_str}\n\n"
            f"用户指令：{instruction}\n\n"
            "请直接返回修改后的完整 JSON。"
        )

        return await self._chat_json(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            schema=MindMap,
            temperature=0.2,
            max_tokens=4000,
        )

    async def translate_text(
        self, text: str, source_lang: str, target_lang: str, enhance: bool
    ) -> Dict[str, Any]:
        from app.schemas.ai_output import TranslationResult

        system_prompt = (
            "You are a professional translation engine. "
            "Translate from source_lang to target_lang. "
            "If source_lang is auto, detect and fill detected_language."
        )
        user_prompt = json.dumps(
            {
                "text": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "enhance": enhance,
            },
            ensure_ascii=False,
        )

        return await self._chat_json(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            schema=TranslationResult,
            temperature=0.2,
            max_tokens=1200,
        )

    async def generate_okr(self, meeting_title: str, summary: Dict[str, Any]) -> Dict[str, Any]:
        from app.schemas.ai_output import OKRPlan

        payload = {"meeting_title": meeting_title, "summary": summary}
        return await self._chat_json(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是 OKR 规划助手，请基于会议纪要生成可量化 OKR。"},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            schema=OKRPlan,
            temperature=0.3,
            max_tokens=2500,
        )

    def _collect_transcript_language_sample(self, segments: list[dict[str, Any]]) -> str:
        sample_parts: list[str] = []
        remaining = 2400
        for segment in segments:
            text = str(segment.get("text") or "").strip()
            if not text:
                continue
            if len(text) > remaining:
                sample_parts.append(text[:remaining])
                break
            sample_parts.append(text)
            remaining -= len(text)
            if remaining <= 0:
                break
        return "\n".join(sample_parts)

    async def _detect_transcript_language(self, sample_text: str) -> dict[str, Any]:
        from app.schemas.ai_output import TranscriptLanguageDecision

        if not sample_text.strip():
            return {
                "detected_language": "zh",
                "should_translate_to_chinese": False,
            }

        return await self._chat_json(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是会议转写语言识别助手。"
                        "请识别输入转写样本的主要语言。"
                        "如果内容已经主要是简体中文或中文口语，只需返回 should_translate_to_chinese=false。"
                        "如果内容主要是英文、日文、韩文、法文、德文、西班牙文、俄文或其他非中文语言，"
                        "返回 should_translate_to_chinese=true。"
                        "只返回 JSON。"
                    ),
                },
                {
                    "role": "user",
                    "content": sample_text[:2400],
                },
            ],
            schema=TranscriptLanguageDecision,
            temperature=0,
            max_tokens=300,
        )

    def _chunk_transcript_segments_for_translation(
        self,
        segments: list[dict[str, Any]],
        *,
        max_segments: int = 10,
        max_chars: int = 3200,
    ) -> list[list[dict[str, Any]]]:
        chunks: list[list[dict[str, Any]]] = []
        current_chunk: list[dict[str, Any]] = []
        current_chars = 0

        for index, segment in enumerate(segments):
            text = str(segment.get("text") or "").strip()
            if not text:
                continue
            chunk_item = {"index": index, "text": text}
            projected_chars = current_chars + len(text)

            if current_chunk and (
                len(current_chunk) >= max_segments or projected_chars > max_chars
            ):
                chunks.append(current_chunk)
                current_chunk = []
                current_chars = 0

            current_chunk.append(chunk_item)
            current_chars += len(text)

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    async def _normalize_transcript_chunk_to_chinese(
        self,
        chunk: list[dict[str, Any]],
        detected_language: str | None,
    ) -> dict[str, Any]:
        from app.schemas.ai_output import TranscriptNormalizationResult

        payload = {
            "detected_language": detected_language or "auto",
            "target_language": "zh-CN",
            "segments": chunk,
        }
        return await self._chat_json(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是多语言会议转写整理助手。"
                        "请把输入的每一条转写片段统一输出为简体中文。"
                        "如果原文已经是中文，只做轻度整理和标点修复，不要改变原意。"
                        "如果原文是英文或其他语言，请准确翻译成简体中文。"
                        "保持专业术语、产品名、API 名、专有名词尽量准确；必要时可保留原文术语。"
                        "必须与输入 segments 里的 index 一一对应，不能合并、拆分、遗漏或新增片段。"
                        "只返回 JSON。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                },
            ],
            schema=TranscriptNormalizationResult,
            temperature=0.1,
            max_tokens=2500,
        )

    async def _normalize_transcript_segments_to_chinese(
        self,
        segments: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not segments:
            return {
                "segments": segments,
                "detected_language": "zh",
                "translated": False,
            }

        sample_text = self._collect_transcript_language_sample(segments)
        language_decision = await self._detect_transcript_language(sample_text)
        detected_language = language_decision.get("detected_language")
        should_translate = bool(language_decision.get("should_translate_to_chinese"))

        if not should_translate:
            return {
                "segments": segments,
                "detected_language": detected_language or "zh",
                "translated": False,
            }

        translated_segments = [dict(segment) for segment in segments]
        translated_text_by_index: dict[int, str] = {}

        for chunk in self._chunk_transcript_segments_for_translation(segments):
            normalized = await self._normalize_transcript_chunk_to_chinese(chunk, detected_language)
            for item in normalized.get("segments", []):
                index = item.get("index")
                text = str(item.get("text") or "").strip()
                if isinstance(index, int) and text:
                    translated_text_by_index[index] = text

        for index, segment in enumerate(translated_segments):
            replacement = translated_text_by_index.get(index)
            if replacement:
                segment["text"] = replacement

        return {
            "segments": translated_segments,
            "detected_language": detected_language or "auto",
            "translated": True,
        }

    async def transcribe_audio(self, audio_path: str) -> Dict[str, Any]:
        print(f"[Qwen] Transcribing with {self.transcription_model}: {audio_path}")
        transcription = await self._transcribe_with_qwen_asr(audio_path)

        try:
            normalized = await self._normalize_transcript_segments_to_chinese(
                transcription.get("segments") or []
            )
        except Exception as exc:
            print(f"[Qwen] Transcript language normalization skipped: {exc}")
            return transcription

        transcription["segments"] = normalized["segments"]
        transcription["detected_language"] = normalized.get("detected_language")
        transcription["translated_to"] = "zh-CN" if normalized.get("translated") else None
        return transcription

    async def generate_slidev_markdown(
        self,
        meeting_title: str,
        meeting_time: str,
        summary: Dict[str, Any],
        transcript: list[dict],
    ) -> str:
        transcript_text = "\n".join(
            [f"{seg.get('speaker', 'Speaker')}: {seg.get('text', '')}" for seg in transcript if seg.get("text")]
        )
        if len(transcript_text) > 120000:
            transcript_text = transcript_text[:120000] + "...(truncated)"

        payload = {
            "meeting": {"title": meeting_title, "time": meeting_time},
            "summary": summary,
            "transcript_excerpt": transcript_text,
        }
        system_prompt = (
            "你是专业的会议演示文稿助手。"
            "请只输出可直接用于 Slidev 构建的 Markdown，不要输出代码块围栏，不要输出解释。"
            "请优先生成稳定、可导出的普通页面结构，避免花哨但不稳定的语法。"
            "严格遵守以下要求："
            "1. 不要输出 HTML 标签、Vue 组件、自定义标签或 v-click/v-motion 等交互语法；"
            "2. 不要输出远程图片链接、占位图链接、base64 图片；"
            "3. 除非语法绝对正确，否则不要输出 mermaid；优先用标题、表格、列表替代表达；"
            "4. 不要生成空白页，不要连续输出只有 --- 或只有 frontmatter 的页面；"
            "5. 每页正文必须有实际文本内容；"
            "6. 使用简体中文输出。"
        )
        user_prompt = (
            "请基于以下会议材料生成 8 到 10 页 Slidev Markdown，"
            "适合导出为 PDF 和 PPTX，内容要简洁、稳健、结构清晰。\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )

        def _chat():
            return self._chat_completion_request(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=6000,
            )

        response = await self._run_in_thread_with_retry("slide generation", _chat)
        return self._extract_message_text(response).strip()
