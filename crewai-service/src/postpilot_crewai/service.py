import atexit
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import yaml
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from posthog import Posthog, new_context, identify_context, set_context_session

from .crew import (
    PostPilotCrew,
    _format_account_context,
    _history_summary,
    _resolve_language_name,
)
from .schemas import ChatRequest, ChatResponse

posthog_client = Posthog(
    os.environ.get("POSTHOG_API_KEY", ""),
    host=os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com"),
    enable_exception_autocapture=True,
)
atexit.register(posthog_client.shutdown)


CONFIG_DIR = Path(__file__).resolve().parent / "config"


def _load_yaml(name: str) -> dict:
    with (CONFIG_DIR / name).open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _build_system_prompt_from_yaml(
    *, message: str, account_context: str, history_summary: str, language: str
) -> str:
    """YAML is the single source of truth for the agent's prompt.

    Builds the system message by combining:
      - agent role/goal/backstory  (from agents.yaml)
      - task description           (from tasks.yaml, with placeholders substituted)
    """
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    strategist = agents_cfg.get("strategist", {}) or {}
    role = str(strategist.get("role", "")).strip()
    goal = " ".join(str(strategist.get("goal", "")).split())
    backstory = " ".join(str(strategist.get("backstory", "")).split())

    task = tasks_cfg.get("compose_response", {}) or {}
    description = str(task.get("description", ""))
    # Use str.replace instead of str.format so stray curly braces in the YAML
    # template (e.g. examples, emojis, literal {something}) never raise KeyError.
    for placeholder, value in (
        ("{message}", message),
        ("{account_context}", account_context),
        ("{history_summary}", history_summary),
        ("{language}", language),
    ):
        description = description.replace(placeholder, value)

    return (
        f"You are {role}.\n\n"
        f"Goal: {goal}\n\n"
        f"Backstory: {backstory}\n\n"
        f"{description.strip()}"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    posthog_client.flush()


app = FastAPI(title="PostPilot CrewAI Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "postpilot-crewai"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: Request, payload: ChatRequest) -> ChatResponse:
    distinct_id = request.headers.get("X-POSTHOG-DISTINCT-ID") or payload.userId
    session_id = request.headers.get("X-POSTHOG-SESSION-ID") or payload.sessionId
    with new_context():
        identify_context(distinct_id)
        set_context_session(session_id)
        try:
            crew = PostPilotCrew()
            reply = crew.kickoff(payload.model_dump())
            if not reply:
                raise RuntimeError("empty_reply")
            posthog_client.capture(
                "chat completed",
                distinct_id=distinct_id,
                properties={
                    "provider": "crewai",
                    "has_images": len(payload.postImages) > 0,
                    "history_length": len(payload.history),
                    "message_length": len(payload.message),
                },
            )
            return ChatResponse(reply=reply, action="ai_reply", provider="crewai")
        except Exception as err:
            posthog_client.capture(
                "chat failed",
                distinct_id=distinct_id,
                properties={
                    "provider": "crewai",
                    "error_type": type(err).__name__,
                },
            )
            raise HTTPException(status_code=500, detail=f"crewai_service_error: {err}") from err


def _is_anthropic_model(model: str) -> bool:
    return str(model or "").lower().startswith("claude")


def _openai_to_anthropic_user_content(content) -> list[dict]:
    """Reshape OpenAI-style multimodal user content into Anthropic blocks."""
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    out: list[dict] = []
    for block in content or []:
        btype = block.get("type")
        if btype == "text":
            out.append({"type": "text", "text": block.get("text", "")})
        elif btype == "image_url":
            url = (block.get("image_url") or {}).get("url", "")
            if url.startswith("data:") and ";base64," in url:
                header, data = url.split(",", 1)
                media_type = header[5:].split(";", 1)[0] or "image/jpeg"
                out.append(
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": data},
                    }
                )
            elif url:
                out.append({"type": "image", "source": {"type": "url", "url": url}})
    return out


@app.post("/chat/stream")
async def chat_stream(request: Request, payload: ChatRequest) -> StreamingResponse:
    """SSE endpoint.

    YAML (agents.yaml + tasks.yaml) is the single source of truth for the prompt.
    Context from the Node app is formatted into readable sections (profile, accounts,
    posts) and injected into the task description before being sent to the LLM.
    Routes to Anthropic when POSTPILOT_CREW_MODEL starts with "claude", otherwise
    uses OpenAI.
    """
    distinct_id = request.headers.get("X-POSTHOG-DISTINCT-ID") or payload.userId
    session_id = request.headers.get("X-POSTHOG-SESSION-ID") or payload.sessionId

    model = os.getenv("POSTPILOT_CREW_MODEL", "gpt-4o-mini")
    use_anthropic = _is_anthropic_model(model)

    if use_anthropic:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")
        try:
            from anthropic import AsyncAnthropic
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="anthropic package not installed in crewai-service; pip install anthropic",
            )
    else:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="openai package not installed in crewai-service; pip install openai",
            )

    context = payload.context or {}
    history = payload.history or []
    account_context = _format_account_context(context)
    history_summary_text = _history_summary(history)
    language_name = _resolve_language_name(context.get("language"))

    system_prompt = _build_system_prompt_from_yaml(
        message=payload.message[:4000],
        account_context=account_context,
        history_summary=history_summary_text,
        language=language_name,
    )

    history_msgs = []
    for m in history[-20:]:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            history_msgs.append({"role": role, "content": content[:1500]})

    post_images = payload.postImages or []
    if post_images:
        image_context = "I'm attaching your most recent post images for reference:\n"
        for i, img in enumerate(post_images):
            image_context += (
                f"\nImage {i + 1}: [{img.type}] {img.date} — "
                f"likes: {img.likes}, comments: {img.comments}\n"
                f'Caption: "{img.caption}"'
            )
        openai_user_content: list[dict] = [
            {"type": "text", "text": f"{image_context}\n\nUser message: {payload.message[:4000]}"},
        ]
        for img in post_images:
            if img.url:
                openai_user_content.append(
                    {"type": "image_url", "image_url": {"url": img.url, "detail": "low"}}
                )
    else:
        openai_user_content = payload.message[:4000]

    provider = "anthropic" if use_anthropic else "openai"

    posthog_client.capture(
        "chat stream started",
        distinct_id=distinct_id,
        properties={
            "provider": provider,
            "model": model,
            "has_images": len(payload.postImages) > 0,
            "history_length": len(payload.history),
            "message_length": len(payload.message),
        },
    )

    if use_anthropic:
        anthropic_user_content = _openai_to_anthropic_user_content(openai_user_content)
        anthropic_messages = [
            *history_msgs,
            {"role": "user", "content": anthropic_user_content},
        ]
        client = AsyncAnthropic(api_key=api_key)

        async def generate() -> AsyncGenerator[str, None]:
            try:
                async with client.messages.stream(
                    model=model,
                    max_tokens=2048,
                    temperature=0.4,
                    system=system_prompt,
                    messages=anthropic_messages,
                ) as stream:
                    async for text in stream.text_stream:
                        if text:
                            yield f"data: {json.dumps({'token': text})}\n\n"
                posthog_client.capture(
                    "chat stream completed",
                    distinct_id=distinct_id,
                    properties={"provider": "anthropic", "model": model},
                )
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as exc:
                posthog_client.capture(
                    "chat stream failed",
                    distinct_id=distinct_id,
                    properties={"provider": "anthropic", "error_type": type(exc).__name__},
                )
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"
    else:
        openai_messages = [
            {"role": "system", "content": system_prompt},
            *history_msgs,
            {"role": "user", "content": openai_user_content},
        ]
        client = AsyncOpenAI(api_key=api_key)

        async def generate() -> AsyncGenerator[str, None]:
            try:
                stream = await client.chat.completions.create(
                    model=model,
                    temperature=0.4,
                    messages=openai_messages,
                    stream=True,
                )
                async for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        yield f"data: {json.dumps({'token': delta.content})}\n\n"
                posthog_client.capture(
                    "chat stream completed",
                    distinct_id=distinct_id,
                    properties={"provider": "openai", "model": model},
                )
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as exc:
                posthog_client.capture(
                    "chat stream failed",
                    distinct_id=distinct_id,
                    properties={"provider": "openai", "error_type": type(exc).__name__},
                )
                yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
