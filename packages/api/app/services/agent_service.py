from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.agent_presets import BUILTIN_AGENTS_MAP, BUILTIN_IDS
from app.models.agent import Agent
from app.models.chat import ChatMessage, Conversation
from app.models.database import get_db
from app.services.ai import get_ai_service
from app.tools.registry import ToolRegistry

# Ensure tools are registered
import app.tools.analysis_tools
import app.tools.calendar_tools
import app.tools.integrations
import app.tools.meetings
import app.tools.memory_tools
import app.tools.mindmap
import app.tools.projects
import app.tools.slides
import app.tools.tasks
import app.tools.translate_tool

logger = logging.getLogger(__name__)


class AgentService:
    def __init__(self):
        self.ai = get_ai_service()
        self.max_turns = 5

    async def chat(
        self,
        user_message: str,
        history: List[Dict] | None = None,
        conversation_id: str | None = None,
        user_id: str | None = None,
        agent: Optional[Dict[str, Any]] = None,
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the chat loop with persistence."""
        self.current_user_id = user_id

        messages: list[dict[str, Any]] = []
        history_messages: list[dict[str, Any]] = []
        tools_schema = ToolRegistry.get_tools_schema()
        resolved_agent: Optional[Dict[str, Any]] = None

        if conversation_id:
            async for db in get_db():
                conversation = await db.get(Conversation, conversation_id)
                if not conversation or (conversation.user_id and conversation.user_id != user_id):
                    return {
                        "type": "text",
                        "message": "会话不存在或您无权访问该会话。",
                        "suggestions": [],
                    }

                effective_agent_id = agent_id if agent_id is not None else conversation.agent_id
                if effective_agent_id == "default":
                    effective_agent_id = None

                if effective_agent_id:
                    if effective_agent_id in BUILTIN_IDS:
                        resolved_agent = BUILTIN_AGENTS_MAP[effective_agent_id]
                    else:
                        agent_stmt = await db.get(Agent, effective_agent_id)
                        if not agent_stmt or agent_stmt.user_id != user_id:
                            return {
                                "type": "text",
                                "message": "所选助手不存在或您无权访问。",
                                "suggestions": [],
                            }
                        resolved_agent = {
                            "id": agent_stmt.id,
                            "name": agent_stmt.name,
                            "description": agent_stmt.description,
                            "prompt": agent_stmt.prompt,
                        }
                elif agent:
                    resolved_agent = agent

                if agent_id is not None and conversation.agent_id != effective_agent_id:
                    conversation.agent_id = effective_agent_id

                db.add(
                    ChatMessage(
                        conversation_id=conversation_id,
                        role="user",
                        content=user_message,
                    )
                )
                await db.commit()

                from sqlalchemy import select

                stmt = (
                    select(ChatMessage)
                    .where(ChatMessage.conversation_id == conversation_id)
                    .order_by(ChatMessage.created_at)
                )
                result = await db.execute(stmt)
                db_messages = result.scalars().all()

                for msg in db_messages:
                    if msg.content:
                        history_messages.append({"role": msg.role, "content": msg.content})
                break
        else:
            if history:
                history_messages.extend(history)
            history_messages.append({"role": "user", "content": user_message})
            if agent_id and agent_id != "default":
                if agent_id in BUILTIN_IDS:
                    resolved_agent = BUILTIN_AGENTS_MAP[agent_id]
                else:
                    async for db in get_db():
                        agent_stmt = await db.get(Agent, agent_id)
                        if agent_stmt and agent_stmt.user_id == user_id:
                            resolved_agent = {
                                "id": agent_stmt.id,
                                "name": agent_stmt.name,
                                "description": agent_stmt.description,
                                "prompt": agent_stmt.prompt,
                            }
                        else:
                            return {
                                "type": "text",
                                "message": "所选助手不存在或您无权访问。",
                                "suggestions": [],
                            }
                        break
            elif agent:
                resolved_agent = agent

        system_prompt = self._build_system_prompt(tools_schema, agent=resolved_agent)
        messages.append({"role": "system", "content": system_prompt})
        messages.extend(history_messages)

        current_turn = 0
        final_response = None
        final_component = None

        try:
            while current_turn < self.max_turns:
                response = await self.ai.chat(messages, temperature=0.7)
                tool_call = self._parse_tool_call(response)

                if tool_call:
                    tool_name = tool_call.get("tool")
                    tool_args = tool_call.get("parameters", {})
                    tool = ToolRegistry.get_tool(tool_name)

                    if tool:
                        try:
                            logger.info("Executing tool: %s with %s", tool_name, tool_args)
                            result = await tool.run(user_id=user_id, **tool_args)
                            component = None

                            if result.get("success") and result.get("data"):
                                data = result["data"]
                                if "meetings" in data:
                                    component = {"type": "meeting_list", "data": data["meetings"]}
                                elif "tasks" in data:
                                    component = {"type": "task_list", "data": data["tasks"]}
                                elif "mindmap" in data:
                                    component = {"type": "mindmap", "data": data["mindmap"]}
                                elif "slides" in data:
                                    component = {"type": "slides", "data": data["slides"]}
                                elif "email" in data:
                                    component = {"type": "email", "data": data["email"]}
                                elif "events" in data:
                                    component = {"type": "calendar", "data": data["events"]}
                                elif "download" in data:
                                    component = {"type": "download", "data": data["download"]}
                                elif "analysis" in data:
                                    component = {"type": "analysis", "data": data["analysis"]}
                                elif "project" in data:
                                    component = {"type": "project", "data": data["project"]}
                                elif "projects" in data:
                                    component = {"type": "projects", "data": data["projects"]}
                                elif "memories" in data:
                                    component = {"type": "memories", "data": data["memories"]}
                                elif "translation" in data:
                                    component = {"type": "translation", "data": data["translation"]}
                                elif "meeting" in data:
                                    component = {"type": "meeting_detail", "data": data["meeting"]}

                            if result.get("require_input"):
                                component = {
                                    "type": "form",
                                    "form_type": result.get("form_type"),
                                    "fields": result.get("fields", []),
                                    "prefill": result.get("prefill", {}),
                                }

                            self.last_component = component

                            def json_serial(obj):
                                if isinstance(obj, datetime):
                                    return obj.isoformat()
                                return str(obj)

                            messages.append({"role": "assistant", "content": response})
                            messages.append(
                                {
                                    "role": "user",
                                    "content": (
                                        f"Tool '{tool_name}' Output: "
                                        f"{json.dumps(result, ensure_ascii=False, default=json_serial)}"
                                    ),
                                }
                            )
                        except Exception as exc:
                            messages.append(
                                {
                                    "role": "user",
                                    "content": f"Tool execution failed: {str(exc)}",
                                }
                            )
                    else:
                        messages.append(
                            {
                                "role": "user",
                                "content": f"Error: Tool '{tool_name}' not found.",
                            }
                        )

                    current_turn += 1
                    continue

                if "---SUGGESTIONS---" in response:
                    parts = response.split("---SUGGESTIONS---")
                    final_response = parts[0].strip()
                    try:
                        suggestions_json = parts[1].strip()
                        if suggestions_json.startswith("```json"):
                            suggestions_json = suggestions_json[7:-3]
                        elif suggestions_json.startswith("```"):
                            suggestions_json = suggestions_json[3:-3]
                        self.last_suggestions = json.loads(suggestions_json)
                    except Exception as exc:
                        logger.warning("Failed to parse dynamic suggestions: %s", exc)
                else:
                    final_response = response

                final_component = getattr(self, "last_component", None)
                self.last_component = None
                break

            if not final_response:
                final_response = "抱歉，我暂时没有完成这次处理。"

            if conversation_id:
                async for db in get_db():
                    db.add(
                        ChatMessage(
                            conversation_id=conversation_id,
                            role="assistant",
                            content=final_response,
                            component_data=final_component,
                        )
                    )

                    from sqlalchemy import update

                    convo = await db.get(Conversation, conversation_id)
                    new_title = None
                    if convo and (not convo.title or convo.title.lower() in ["new conversation", "新对话"]):
                        new_title = user_message[:30] if user_message else convo.title

                    update_values = {"updated_at": datetime.utcnow()}
                    if new_title:
                        update_values["title"] = new_title

                    await db.execute(
                        update(Conversation)
                        .where(Conversation.id == conversation_id)
                        .values(**update_values)
                    )
                    await db.commit()
                    break

            suggestions = getattr(self, "last_suggestions", None)
            if not suggestions:
                suggestions = self._generate_suggestions(final_response)
            self.last_suggestions = None

            return {
                "type": "text",
                "message": final_response,
                "component": final_component,
                "suggestions": suggestions,
            }
        except Exception as exc:
            logger.error("Agent Execution Error: %s", exc)
            raise

    def _build_system_prompt(self, tools_schema: List[Dict], agent: Optional[Dict[str, Any]] = None) -> str:
        tools_json = json.dumps(tools_schema, ensure_ascii=False, indent=2)

        agent_name = None
        agent_description = None
        agent_prompt = None
        if agent:
            agent_name = agent.get("name") or agent.get("title")
            agent_description = agent.get("description")
            agent_prompt = agent.get("prompt") or agent.get("system_prompt") or agent.get("instructions")

        intro_name = agent_name or "MeetMind Assistant"
        intro_line = f"You are {intro_name}, a MeetMind agent for managing meetings and tasks."
        if agent_description:
            intro_line = f"{intro_line} {agent_description}".strip()

        custom_block = ""
        if agent_prompt:
            custom_block = f"\nCUSTOM AGENT INSTRUCTIONS:\n{agent_prompt.strip()}\n"

        allowed_suggestions = [
            "查看我的任务",
            "查看会议列表",
            "搜索会议",
            "创建新会议",
            "分析会议录音",
            "导入会议任务",
            "生成会议PPT",
            "发送会议纪要邮件",
            "查看思维导图",
            "导出会议纪要",
            "查看日程",
            "完成任务",
            "创建项目",
            "查看项目列表",
            "查看项目OKR",
            "从会议生成OKR",
            "搜索记忆",
            "翻译文本",
        ]
        suggestions_list = json.dumps(allowed_suggestions, ensure_ascii=False)

        return f"""\
{intro_line}
{custom_block}
You have access to the following tools:
{tools_json}

CRITICAL INSTRUCTION ON TOOLS:
Before using any tool, you MUST verify if it exists in the list above.
If a user asks for an action that requires a tool NOT in this list, you must explicitly state you cannot perform that action.
Do not hallucinate tool calls.

RESPONSE FORMAT:
1. If you need to use a tool, output ONLY a JSON object:
{{
  "tool": "tool_name",
  "parameters": {{ ... }}
}}

2. If you do NOT need a tool:
   - Reply in plain Chinese text.
   - At the VERY END, append exactly 3 suggestions separated by '---SUGGESTIONS---'.

CRITICAL: INTERPRETING TOOL OUTPUT
When you receive a message like "Tool 'xxx' Output: {{...}}", you MUST:
- Check the "success" field in the output.
- If "success" is true, present the result positively and summarize the returned data.
- If "success" is false, explain the error from the "message" field.

SUGGESTIONS RULES:
You MUST ONLY select suggestions from the following predefined list:
{suggestions_list}

Do not generate suggestions outside this list.
"""

    def _parse_tool_call(self, content: str) -> dict | None:
        """Try to parse a JSON tool call from content."""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]

        try:
            data = json.loads(content)
            if "tool" in data:
                return data
        except Exception as exc:
            logger.warning("Failed to parse tool call from content: %s", exc)
        return None

    def _generate_suggestions(self, context: str) -> List[str]:
        return ["查看会议列表", "查看我的任务", "生成会议PPT"]


agent_service = AgentService()
