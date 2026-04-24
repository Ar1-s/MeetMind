from __future__ import annotations
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class ActionItem(BaseModel):
    title: str = Field(description="Action item title")
    assignee: Optional[str] = Field(None, description="Person responsible for the task")
    due_date: Optional[str] = Field(None, description="Due date in YYYY-MM-DD format")
    priority: str = Field("medium", description="Priority level: high, medium, or low")
    source_segment_start: Optional[float] = Field(
        None,
        description="Best matching transcript segment start time in seconds for this action item",
    )
    source_segment_end: Optional[float] = Field(
        None,
        description="Best matching transcript segment end time in seconds for this action item",
    )
    source_quote: Optional[str] = Field(
        None,
        description="Short supporting quote from the transcript for this action item",
    )

class MindmapNode(BaseModel):
    """Single node in the mind map"""
    id: str = Field(description="Unique node ID, e.g. 'node_1'")
    type: str = Field("topic", description="Node type: 'topic' (main), 'subtopic' (sub), 'detail' (leaf)")
    label: str = Field(description="Node display text")
    description: Optional[str] = Field(None, description="Optional detailed description")
    parent_id: Optional[str] = Field(None, description="Parent node ID for building edges, null for root")

class MindMap(BaseModel):
    """Mind map structure compatible with ReactFlow"""
    type: str = Field("reactflow", description="Format type, always 'reactflow'")
    nodes: List[MindmapNode] = Field(description="List of mind map nodes")

class MeetingSummary(BaseModel):
    abstract: str = Field(description="Concise summary of the meeting")
    decisions: List[str] = Field(default_factory=list, description="List of decisions made")
    risks: List[str] = Field(default_factory=list, description="List of risks identified")
    action_items: List[ActionItem] = Field(default_factory=list, description="List of action items")
    mindmap_nodes: List[MindmapNode] = Field(default_factory=list, description="Mind map nodes list for ReactFlow visualization")
    sentiment_score: float = Field(0.0, description="Overall sentiment score between 0 and 1")
    emotion_flags: List[str] = Field(default_factory=list, description="Emotion or risk flags")

class ToolParsingResult(BaseModel):
    tool: Optional[str] = Field(None, description="Name of the tool to execute")
    confidence: float = Field(description="Confidence score between 0 and 1")
    params: Dict[str, Any] = Field(default_factory=dict, description="Parameters for the tool")
    message: Optional[str] = Field(None, description="Message to the user if no tool is matched or if there's ambiguity")


class TranslationResult(BaseModel):
    translation: str = Field(description="Translated text")
    detected_language: Optional[str] = Field(None, description="Detected source language code when auto")


class TranscriptLanguageDecision(BaseModel):
    detected_language: Optional[str] = Field(
        None,
        description="Detected primary language code or language name for the transcript sample",
    )
    should_translate_to_chinese: bool = Field(
        False,
        description="Whether the transcript should be translated into Simplified Chinese",
    )


class TranscriptSegmentRewrite(BaseModel):
    index: int = Field(description="Original transcript segment index")
    text: str = Field(description="Rewritten or translated transcript text in Simplified Chinese")


class TranscriptNormalizationResult(BaseModel):
    detected_language: Optional[str] = Field(
        None,
        description="Detected language code or language name for this chunk",
    )
    segments: List[TranscriptSegmentRewrite] = Field(
        default_factory=list,
        description="Transcript segments rewritten into Simplified Chinese while preserving indexes",
    )


class OKRKeyResult(BaseModel):
    title: str = Field(description="Key result title")
    target_value: float = Field(1, description="Target numeric value")
    unit: Optional[str] = Field(None, description="Unit for the metric, e.g. %, 人, 次")
    linked_action_titles: List[str] = Field(default_factory=list, description="Related action item titles")


class OKRObjective(BaseModel):
    title: str = Field(description="Objective title")
    description: Optional[str] = Field(None, description="Objective description")
    key_results: List[OKRKeyResult] = Field(default_factory=list, description="Key results")


class OKRPlan(BaseModel):
    project_name: str = Field(description="Project/OKR name")
    project_description: Optional[str] = Field(None, description="Project description")
    objectives: List[OKRObjective] = Field(default_factory=list, description="Objectives list")
