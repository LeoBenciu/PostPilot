from typing import Any

from pydantic import BaseModel, Field


class PostImage(BaseModel):
    url: str
    type: str = ""
    caption: str = ""
    date: str = ""
    likes: int = 0
    comments: int = 0


class ChatRequest(BaseModel):
    userId: str
    sessionId: str
    message: str
    history: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    systemPrompt: str = ""
    postImages: list[PostImage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    action: str = "ai_reply"
    provider: str = "crewai"
