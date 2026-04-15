import json
import os
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse

from .crew import PostPilotCrew
from .schemas import ChatRequest, ChatResponse


app = FastAPI(title="PostPilot CrewAI Service", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "postpilot-crewai"}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    try:
        crew = PostPilotCrew()
        reply = crew.kickoff(payload.model_dump())
        if not reply:
            raise RuntimeError("empty_reply")
        return ChatResponse(reply=reply, action="ai_reply", provider="crewai")
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"crewai_service_error: {err}") from err


@app.post("/chat/stream")
async def chat_stream(payload: ChatRequest) -> StreamingResponse:
    """SSE endpoint that streams the OpenAI response token-by-token."""
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

    system_prompt = payload.systemPrompt or ""
    context_json = json.dumps(payload.context, default=str)
    history_msgs = []
    for m in (payload.history or [])[-20:]:
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
        {"role": "system", "content": f"{system_prompt}\n\nSession context:\n{context_json}"},
        *history_msgs,
        user_message,
    ]

    client = AsyncOpenAI(api_key=api_key)

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
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
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
