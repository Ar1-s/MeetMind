from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Dict, Any, Type
from pydantic import BaseModel

class BaseTool(ABC):
    name: str
    description: str
    
    @property
    @abstractmethod
    def args_schema(self) -> Type[BaseModel]:
        """Pydantic model for arguments"""
        pass

    @abstractmethod
    async def run(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool"""
        pass
    
    @property
    def schema(self) -> Dict[str, Any]:
        """Return JSON schema for the tool"""
        schema = self.args_schema.model_json_schema()
        # Clean up schema for LLM consumption
        parameters = {
            "type": "object",
            "properties": schema.get("properties", {}),
            "required": schema.get("required", [])
        }
        return {
            "name": self.name,
            "description": self.description,
            "parameters": parameters
        }
