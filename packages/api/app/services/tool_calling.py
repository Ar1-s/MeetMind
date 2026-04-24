from __future__ import annotations
"""
Tool Calling Service

Implements natural language parsing and tool execution for the assistant using LangChain architecture.
"""

from typing import Optional, Any, List, Dict
from enum import Enum
import json
from datetime import datetime

# LangChain imports
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from app.models.database import get_db
from app.models.task import Task
from app.services.ai_analysis import get_meeting_tasks


class ToolType(str, Enum):
    IMPORT_TASKS = "import_tasks"
    GENERATE_EMAIL = "generate_email"
    EXPORT_CALENDAR = "export_calendar"
    ANALYZE_MEETING = "analyze_meeting"
    CREATE_MEETING = "create_meeting"
    SEARCH_MEETINGS = "search_meetings"


# Tool definitions for the assistant
AVAILABLE_TOOLS = {
    ToolType.IMPORT_TASKS: {
        "name": "import_tasks",
        "description": "从会议中提取任务并导入到任务看板",
        "parameters": {
            "meeting_id": {"type": "string", "required": True, "description": "会议ID"},
        },
    },
    ToolType.GENERATE_EMAIL: {
        "name": "generate_email",
        "description": "根据会议纪要生成邮件草稿",
        "parameters": {
            "meeting_id": {"type": "string", "required": True, "description": "会议ID"},
            "template": {"type": "string", "required": False, "description": "邮件模板类型"},
        },
    },
    ToolType.EXPORT_CALENDAR: {
        "name": "export_calendar",
        "description": "将会议事项导出到日历",
        "parameters": {
            "meeting_id": {"type": "string", "required": True, "description": "会议ID"},
        },
    },
    ToolType.ANALYZE_MEETING: {
        "name": "analyze_meeting",  
        "description": "分析会议录音，生成转写和纪要",
        "parameters": {
            "meeting_id": {"type": "string", "required": True, "description": "会议ID"},
        },
    },
    ToolType.CREATE_MEETING: {
        "name": "create_meeting",
        "description": "创建新会议",
        "parameters": {
            "title": {"type": "string", "required": True, "description": "会议标题"},
        },
    },
    ToolType.SEARCH_MEETINGS: {
        "name": "search_meetings",
        "description": "搜索会议",
        "parameters": {
            "query": {"type": "string", "required": False, "description": "搜索关键词"},
            "tags": {"type": "array", "required": False, "description": "标签过滤"},
        },
    },
}


# Pydantic model for tool parsing
class ToolCall(BaseModel):
    tool: Optional[str] = Field(None, description="工具名称")
    confidence: float = Field(default=0.0, description="匹配信心度")
    params: Dict[str, Any] = Field(default_factory=dict, description="工具参数")
    message: Optional[str] = Field(None, description="错误消息")


# LangChain tool implementation
class ImportTasksTool(BaseTool):
    name: str = "import_tasks"
    description: str = "从会议中提取任务并导入到任务看板"
    
    def _run(self, meeting_id: str = "today") -> Dict[str, Any]:
        """执行任务导入"""
        import asyncio
        
        async def import_tasks_async():
            # 获取数据库会话
            db = await anext(get_db())
            
            try:
                # 尝试从会议中提取任务
                tasks = await get_meeting_tasks(meeting_id, db)
                
                # 如果没有任务，返回空结果
                if not tasks:
                    return {
                        "success": True,
                        "message": f"会议 {meeting_id} 中没有可提取的任务",
                        "data": {"imported_count": 0, "meeting_id": meeting_id},
                    }
                
                # 导入任务到数据库
                imported_count = 0
                for task_data in tasks:
                    db_task = Task(
                        title=task_data.get("title", "未命名任务"),
                        description=task_data.get("description", ""),
                        assignee=task_data.get("assignee"),
                        due_date=task_data.get("due_date"),
                        priority=task_data.get("priority", "medium"),
                        source_meeting_id=meeting_id
                    )
                    db.add(db_task)
                    imported_count += 1
                
                await db.commit()
                
                return {
                    "success": True,
                    "message": f"已从会议 {meeting_id} 中提取 {imported_count} 个任务并导入看板",
                    "data": {"imported_count": imported_count, "meeting_id": meeting_id},
                }
            except Exception as e:
                print(f"Import tasks error: {str(e)}")
                return {
                    "success": False,
                    "message": f"导入任务失败: {str(e)}",
                    "data": {"imported_count": 0, "meeting_id": meeting_id},
                }
            finally:
                # 不需要手动关闭会话，async with会自动处理
                pass
        
        # Use existing event loop if available
        try:
            import asyncio
            
            # 检查是否在异步环境中
            try:
                loop = asyncio.get_event_loop()
                
                # 检查是否可以直接等待
                if hasattr(asyncio, 'current_task') and asyncio.current_task() is not None:
                    # 在异步环境中，直接等待
                    import inspect
                    if inspect.iscoroutinefunction(import_tasks_async):
                        # 这里我们需要在同步方法中运行异步函数
                        # 使用一个包装器来处理
                        def run_in_async():
                            return asyncio.run(import_tasks_async())
                        
                        # 创建一个新的事件循环来运行
                        new_loop = asyncio.new_event_loop()
                        return new_loop.run_until_complete(import_tasks_async())
                
                # 如果事件循环未运行，使用run
                if not loop.is_running():
                    return asyncio.run(import_tasks_async())
                else:
                    # 事件循环正在运行，使用新的事件循环
                    new_loop = asyncio.new_event_loop()
                    return new_loop.run_until_complete(import_tasks_async())
            except RuntimeError:
                # 没有事件循环，创建新的
                return asyncio.run(import_tasks_async())
        except Exception as e:
            print(f"Async execution error: {str(e)}")
            # Fallback to synchronous execution
            return {
                "success": False,
                "message": f"执行任务失败: {str(e)}",
                "data": {"imported_count": 0, "meeting_id": meeting_id},
            }


class GenerateEmailTool(BaseTool):
    name: str = "generate_email"
    description: str = "根据会议纪要生成邮件草稿"
    
    def _run(self, meeting_id: str = "today", template: str = "meeting_summary") -> Dict[str, Any]:
        """生成邮件草稿"""
        return {
            "success": True,
            "message": f"邮件草稿已生成，模板：{template}",
            "data": {
                "subject": "会议纪要",
                "body": "请查看附件中的会议纪要...",
                "meeting_id": meeting_id,
                "template": template,
            },
        }


class ExportCalendarTool(BaseTool):
    name: str = "export_calendar"
    description: str = "将会议事项导出到日历"
    
    def _run(self, meeting_id: str = "today") -> Dict[str, Any]:
        """导出日历事件"""
        return {
            "success": True,
            "message": f"日历事件已从会议 {meeting_id} 导出，请下载 ICS 文件",
            "data": {"events_count": 1, "meeting_id": meeting_id},
        }


class AnalyzeMeetingTool(BaseTool):
    name: str = "analyze_meeting"
    description: str = "分析会议录音，生成转写和纪要"
    
    def _run(self, meeting_id: str = "today") -> Dict[str, Any]:
        """分析会议录音"""
        import asyncio
        
        async def analyze_meeting_async():
            # 获取数据库会话
            db = await anext(get_db())
            
            try:
                from sqlalchemy import select
                from app.models.meeting import Meeting
                from app.models.recording import Recording
                from app.services.ai_analysis import analyze_meeting as ai_analyze_meeting
                from app.routes.analysis import resolve_audio_path
                
                # 查找会议
                meeting_result = await db.execute(
                    select(Meeting).where(Meeting.id == meeting_id)
                )
                meeting = meeting_result.scalar_one_or_none()
                
                if not meeting:
                    return {
                        "success": False,
                        "message": f"会议 {meeting_id} 不存在",
                        "data": {"status": "error", "meeting_id": meeting_id},
                    }
                
                # 查找会议的录音
                recording_result = await db.execute(
                    select(Recording).where(Recording.meeting_id == meeting_id)
                )
                recordings = recording_result.scalars().all()
                
                if not recordings:
                    return {
                        "success": False,
                        "message": f"会议 {meeting_id} 没有录音",
                        "data": {"status": "error", "meeting_id": meeting_id},
                    }
                
                # 使用第一个录音进行分析
                recording = recordings[0]
                
                if not recording.audio_uri:
                    return {
                        "success": False,
                        "message": f"录音 {recording.id} 缺少音频路径，无法分析",
                        "data": {"status": "error", "meeting_id": meeting_id},
                    }

                audio_path = resolve_audio_path(recording.audio_uri)

                # 调用AI分析服务
                analysis_result = await ai_analyze_meeting(recording.id, audio_path)
                
                return {
                    "success": True,
                    "message": f"会议 {meeting_id} 分析已完成",
                    "data": {
                        "status": "completed",
                        "meeting_id": meeting_id,
                        "recording_id": recording.id,
                        "analysis_result": analysis_result
                    },
                }
            except Exception as e:
                print(f"Analyze meeting error: {str(e)}")
                return {
                    "success": False,
                    "message": f"分析会议失败: {str(e)}",
                    "data": {"status": "error", "meeting_id": meeting_id},
                }
            finally:
                # 不需要手动关闭会话，async with会自动处理
                pass
        
        # Use existing event loop if available
        try:
            import asyncio
            
            # 检查是否在异步环境中
            try:
                loop = asyncio.get_event_loop()
                
                # 检查是否可以直接等待
                if hasattr(asyncio, 'current_task') and asyncio.current_task() is not None:
                    # 在异步环境中，直接等待
                    import inspect
                    if inspect.iscoroutinefunction(analyze_meeting_async):
                        # 这里我们需要在同步方法中运行异步函数
                        # 使用一个包装器来处理
                        def run_in_async():
                            return asyncio.run(analyze_meeting_async())
                        
                        # 创建一个新的事件循环来运行
                        new_loop = asyncio.new_event_loop()
                        return new_loop.run_until_complete(analyze_meeting_async())
                
                # 如果事件循环未运行，使用run
                if not loop.is_running():
                    return asyncio.run(analyze_meeting_async())
                else:
                    # 事件循环正在运行，使用新的事件循环
                    new_loop = asyncio.new_event_loop()
                    return new_loop.run_until_complete(analyze_meeting_async())
            except RuntimeError:
                # 没有事件循环，创建新的
                return asyncio.run(analyze_meeting_async())
        except Exception as e:
            print(f"Async execution error: {str(e)}")
            # Fallback to synchronous execution
            return {
                "success": False,
                "message": f"执行分析失败: {str(e)}",
                "data": {"status": "error", "meeting_id": meeting_id},
            }


class CreateMeetingTool(BaseTool):
    name: str = "create_meeting"
    description: str = "创建新会议"
    
    def _run(self, title: str = "新会议") -> Dict[str, Any]:
        """创建新会议"""
        return {
            "success": True,
            "message": f"会议 '{title}' 已创建",
            "data": {"title": title, "meeting_id": f"meeting_{int(datetime.now().timestamp())}"},
        }


class SearchMeetingsTool(BaseTool):
    name: str = "search_meetings"
    description: str = "搜索会议"
    
    def _run(self, query: str = "", tags: List[str] = None) -> Dict[str, Any]:
        """搜索会议"""
        import asyncio
        
        async def search_meetings_async():
            # 获取数据库会话
            db = await anext(get_db())
            
            try:
                from sqlalchemy import select
                from app.models.meeting import Meeting
                from app.models.user import User
                from sqlalchemy.ext.asyncio import AsyncSession
                
                # 构建查询
                base_query = select(Meeting)
                
                # 执行查询
                result = await db.execute(base_query)
                meetings = result.scalars().all()
                
                # 转换为响应格式
                meetings_list = []
                for meeting in meetings:
                    meetings_list.append({
                        "id": meeting.id,
                        "title": meeting.title,
                        "date": meeting.start_time.isoformat() if meeting.start_time else None,
                        "has_recording": len(meeting.recordings) > 0 if meeting.recordings else False,
                        "has_summary": meeting.summary is not None
                    })
                
                return {
                    "success": True,
                    "message": f"已找到 {len(meetings_list)} 个会议",
                    "data": {
                        "query": query,
                        "tags": tags or [],
                        "found_count": len(meetings_list),
                        "meetings": meetings_list,
                    },
                }
            except Exception as e:
                print(f"Search meetings error: {str(e)}")
                return {
                    "success": False,
                    "message": f"搜索会议失败: {str(e)}",
                    "data": {
                        "query": query,
                        "tags": tags or [],
                        "found_count": 0,
                        "meetings": [],
                    },
                }
            finally:
                # 不需要手动关闭会话，async with会自动处理
                pass
        
        # Use existing event loop if available
        try:
            import asyncio
            
            # 检查是否在异步环境中
            try:
                loop = asyncio.get_event_loop()
                
                # 检查是否可以直接等待
                if hasattr(asyncio, 'current_task') and asyncio.current_task() is not None:
                    # 在异步环境中，直接等待
                    import inspect
                    if inspect.iscoroutinefunction(search_meetings_async):
                        # 这里我们需要在同步方法中运行异步函数
                        # 使用一个包装器来处理
                        def run_in_async():
                            return asyncio.run(search_meetings_async())
                        
                        # 创建一个新的事件循环来运行
                        new_loop = asyncio.new_event_loop()
                        return new_loop.run_until_complete(search_meetings_async())
                
                # 如果事件循环未运行，使用run
                if not loop.is_running():
                    return asyncio.run(search_meetings_async())
                else:
                    # 事件循环正在运行，使用新的事件循环
                    new_loop = asyncio.new_event_loop()
                    return new_loop.run_until_complete(search_meetings_async())
            except RuntimeError:
                # 没有事件循环，创建新的
                return asyncio.run(search_meetings_async())
        except Exception as e:
            print(f"Async execution error: {str(e)}")
            # Fallback to synchronous execution
            return {
                "success": False,
                "message": f"执行搜索失败: {str(e)}",
                "data": {
                    "query": query,
                    "tags": tags or [],
                    "found_count": 0,
                    "meetings": [],
                },
            }


# Initialize tools
TOOLS = {
    ToolType.IMPORT_TASKS: ImportTasksTool(),
    ToolType.GENERATE_EMAIL: GenerateEmailTool(),
    ToolType.EXPORT_CALENDAR: ExportCalendarTool(),
    ToolType.ANALYZE_MEETING: AnalyzeMeetingTool(),
    ToolType.CREATE_MEETING: CreateMeetingTool(),
    ToolType.SEARCH_MEETINGS: SearchMeetingsTool(),
}


from app.services.ai import get_ai_service
from app.services.ai_analysis import get_meeting_tasks

# ...

async def parse_instruction(instruction: str) -> dict:
    """
    Parse natural language instruction to identify tool and parameters.
    
    Uses configured AI service to parse natural language instructions.
    """
    # 构建工具信息字符串
    tools_info = "\n".join([
        f"- {tool.value}: {info['description']}，参数：{json.dumps(info['parameters'], ensure_ascii=False)}"
        for tool, info in AVAILABLE_TOOLS.items()
    ])
    
    # 构建系统提示
    system_prompt = f"你是一个智能指令解析助手，负责分析用户的自然语言指令，并匹配到合适的工具。\n\n"
    system_prompt += f"可用工具列表：\n{tools_info}\n\n"
    system_prompt += "请按照以下步骤分析用户指令：\n"
    system_prompt += "1. 理解用户的意图\n"
    system_prompt += "2. 从可用工具列表中选择最匹配的工具\n"
    system_prompt += "3. 提取指令中的参数信息\n"
    system_prompt += "4. 生成符合要求的 JSON 格式输出\n\n"
    system_prompt += "输出格式要求：\n"
    system_prompt += "{\n"
    system_prompt += "  \"tool\": \"工具名称\",  # 从工具列表中选择的工具名称\n"
    system_prompt += "  \"confidence\": 0.9,  # 匹配信心度，0-1之间\n"
    system_prompt += "  \"params\": {  # 提取的参数\n"
    system_prompt += "    \"参数名\": \"参数值\"\n"
    system_prompt += "  }\n"
    system_prompt += "}\n\n"
    system_prompt += "如果无法匹配到合适的工具，请输出：\n"
    system_prompt += "{\n"
    system_prompt += "  \"tool\": null,\n"
    system_prompt += "  \"confidence\": 0,\n"
    system_prompt += "  \"params\": {},\n"
    system_prompt += "  \"message\": \"无法识别您的意图，请尝试更具体的描述\"\n"
    system_prompt += "}\n"
    
    
    try:
        service = get_ai_service()
        result = await service.parse_instruction(instruction, system_prompt)
            
        # 确保返回结果包含必要的字段
        if "tool" in result:
            return result
                
    except Exception as e:
        print(f"LLM instruction parsing failed: {str(e)}")
        # 继续执行备用方案
    
    # 使用备用解析（基于关键词）
    return fallback_parse_instruction(instruction)

def fallback_parse_instruction(instruction: str) -> dict:
    """
    Fallback instruction parser using simple keyword matching.
    """
    instruction_lower = instruction.lower()
    
    # Simple keyword-based parsing
    if any(kw in instruction_lower for kw in ["任务", "导入", "提取"]):
        return {
            "tool": ToolType.IMPORT_TASKS,
            "confidence": 0.8,
            "params": {},
        }
    
    if any(kw in instruction_lower for kw in ["邮件", "发送", "email"]):
        return {
            "tool": ToolType.GENERATE_EMAIL,
            "confidence": 0.8,
            "params": {"template": "meeting_summary"},
        }
    
    if any(kw in instruction_lower for kw in ["日历", "日程", "calendar"]):
        return {
            "tool": ToolType.EXPORT_CALENDAR,
            "confidence": 0.8,
            "params": {},
        }
    
    if any(kw in instruction_lower for kw in ["分析", "转写", "总结", "纪要"]):
        return {
            "tool": ToolType.ANALYZE_MEETING,
            "confidence": 0.8,
            "params": {},
        }
    
    if any(kw in instruction_lower for kw in ["新建", "创建", "新会议"]):
        return {
            "tool": ToolType.CREATE_MEETING,
            "confidence": 0.7,
            "params": {},
        }
    
    if any(kw in instruction_lower for kw in ["搜索", "查找", "找"]):
        return {
            "tool": ToolType.SEARCH_MEETINGS,
            "confidence": 0.7,
            "params": {},
        }
    
    return {
        "tool": None,
        "confidence": 0,
        "params": {},
        "message": "无法识别您的意图，请尝试更具体的描述",
    }


async def execute_tool(tool: ToolType, params: dict) -> dict:
    """
    Execute a tool with given parameters using LangChain architecture.
    
    Returns execution result.
    """
    # Get the tool instance
    tool_instance = TOOLS.get(tool)
    if not tool_instance:
        return {
            "success": False,
            "message": f"工具不存在: {tool.value}",
            "data": {},
        }
    
    try:
        # Execute the tool using _run method directly to avoid tool_input requirement
        result = tool_instance._run(**params)
        return result
    except Exception as e:
        print(f"Tool execution error: {str(e)}")
        return {
            "success": False,
            "message": f"工具执行失败: {str(e)}",
            "data": {},
        }


async def execute_tool_chain(tools: List[Dict[str, Any]]) -> dict:
    """
    Execute a chain of tools sequentially.
    
    Args:
        tools: List of tool calls with parameters
        
    Returns:
        Combined result of all tool executions
    """
    results = []
    
    for tool_call in tools:
        tool_name = tool_call.get("tool")
        params = tool_call.get("params", {})
        
        if not tool_name:
            continue
        
        try:
            tool_type = ToolType(tool_name)
            result = await execute_tool(tool_type, params)
            results.append({
                "tool": tool_name,
                "result": result
            })
        except Exception as e:
            print(f"Tool chain execution error: {str(e)}")
            results.append({
                "tool": tool_name,
                "error": str(e)
            })
    
    return {
        "success": all(r.get("error") is None for r in results),
        "results": results,
        "message": f"执行了 {len(results)} 个工具"
    }
