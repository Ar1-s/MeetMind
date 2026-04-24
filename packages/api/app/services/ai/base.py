from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class AIService(ABC):
    @abstractmethod
    async def transcribe_audio(self, audio_path: str) -> Dict[str, Any]:
        """
        Transcribe audio file to text.
        
        Args:
            audio_path: Path to the audio file.
            
        Returns:
            Dict containing transcription 'segments' (list of {start, end, speaker, text, confidence})
            and 'duration'.
        """
        pass

    @abstractmethod
    async def generate_summary(
        self,
        transcript: list[dict],
        participant_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate meeting summary from transcript.
        
        Args:
            transcript: List of transcript segments.
            participant_context: Optional meeting participant roster and anonymization context.
            
        Returns:
            Dict with abstract, decisions, risks, action_items, mindmap.
        """
        pass

    @abstractmethod
    async def generate_slidev_markdown(
        self,
        meeting_title: str,
        meeting_time: str,
        summary: Dict[str, Any],
        transcript: list[dict],
    ) -> str:
        """
        Generate Slidev markdown for meeting slides.
        """
        pass

    @abstractmethod
    async def edit_mindmap(self, current_mindmap: Dict[str, Any], instruction: str) -> Dict[str, Any]:
        """
        Edit mind map based on natural language instruction.
        
        Args:
            current_mindmap: Current mind map data (nodes list).
            instruction: Natural language instruction for editing.
            
        Returns:
            Dict with updated mind map structure (type, nodes).
        """
        pass

    @abstractmethod
    async def translate_text(
        self, text: str, source_lang: str, target_lang: str, enhance: bool
    ) -> Dict[str, Any]:
        """
        Translate text between languages.
        """
        pass

    @abstractmethod
    async def generate_okr(self, meeting_title: str, summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate OKR plan from meeting title and summary.
        """
        pass
