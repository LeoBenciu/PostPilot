from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    userId: str
    sessionId: str
    message: str
    history: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    systemPrompt: str = ""


class ChatResponse(BaseModel):
    reply: str
    action: str = "ai_reply"
    provider: str = "crewai"
