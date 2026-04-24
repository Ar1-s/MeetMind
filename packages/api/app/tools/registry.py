from __future__ import annotations
from typing import Dict, List, Type, Any
from app.tools.base import BaseTool

class ToolRegistry:
    _tools: Dict[str, BaseTool] = {}

    @classmethod
    def register(cls, tool: BaseTool):
        """Register a tool instance"""
        print(f"Registering tool: {tool.name}")
        cls._tools[tool.name] = tool

    @classmethod
    def get_tool(cls, name: str) -> BaseTool:
        """Get a tool by name"""
        return cls._tools.get(name)

    @classmethod
    def get_all_tools(cls) -> List[BaseTool]:
        """Get all registered tools"""
        return list(cls._tools.values())

    @classmethod
    def get_tools_schema(cls) -> List[Dict[str, Any]]:
        """Get schemas for all tools (for LLM context)"""
        return [tool.schema for tool in cls._tools.values()]
