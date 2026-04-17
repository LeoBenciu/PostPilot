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
    description_template = str(task.get("description", ""))
    try:
        description = description_template.format(
            message=message,
            account_context=account_context,
            history_summary=history_summary,
            language=language,
        )
    except (KeyError, IndexError):
        description = description_template

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


@app.post("/chat/stream")
async def chat_stream(request: Request, payload: ChatRequest) -> StreamingResponse:
    """SSE endpoint.

    YAML (agents.yaml + tasks.yaml) is the single source of truth for the prompt.
    Context from the Node app is formatted into readable sections (profile, accounts,
    posts) and injected into the task description before being sent to OpenAI.
    """
    distinct_id = request.headers.get("X-POSTHOG-DISTINCT-ID") or payload.userId
    session_id = request.headers.get("X-POSTHOG-SESSION-ID") or payload.sessionId

    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="openai package not installed in crewai-service; pip install openai",
        )

    api_key = os.getenv("OPENAI_API_KEY", "")
    model = os.getenv("POSTPILOT_CREW_MODEL", "gpt-4o-mini")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")

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
        user_content: list[dict] = [
            {"type": "text", "text": f"{image_context}\n\nUser message: {payload.message[:4000]}"},
        ]
        for img in post_images:
            if img.url:
                user_content.append(
                    {"type": "image_url", "image_url": {"url": img.url, "detail": "low"}}
                )
        user_message = {"role": "user", "content": user_content}
    else:
        user_message = {"role": "user", "content": payload.message[:4000]}

    messages = [
        {"role": "system", "content": system_prompt},
        *history_msgs,
        user_message,
    ]

    client = AsyncOpenAI(api_key=api_key)

    posthog_client.capture(
        "chat stream started",
        distinct_id=distinct_id,
        properties={
            "provider": "openai",
            "model": model,
            "has_images": len(payload.postImages) > 0,
            "history_length": len(payload.history),
            "message_length": len(payload.message),
        },
    )

    async def generate() -> AsyncGenerator[str, None]:
        try:
            stream = await client.chat.completions.create(
                model=model,
                temperature=0.4,
                messages=messages,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield f"data: {json.dumps({'token': delta.content})}\n\n"
            posthog_client.capture(
                "chat stream completed",
                distinct_id=distinct_id,
                properties={
                    "provider": "openai",
                    "model": model,
                },
            )
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            posthog_client.capture(
                "chat stream failed",
                distinct_id=distinct_id,
                properties={
                    "provider": "openai",
                    "error_type": type(exc).__name__,
                },
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
