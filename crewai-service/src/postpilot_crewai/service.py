from fastapi import FastAPI, HTTPException

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
