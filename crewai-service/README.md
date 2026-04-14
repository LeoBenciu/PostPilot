# PostPilot CrewAI Service

This is a standalone CrewAI service with a conventional project structure:

- `src/postpilot_crewai/config/agents.yaml`
- `src/postpilot_crewai/config/tasks.yaml`
- `src/postpilot_crewai/crew.py`
- `src/postpilot_crewai/service.py`

It exposes `POST /chat` so the Node backend (`aiClient.js`) can call it when:

- `AI_PROVIDER=crewai`
- `CREWAI_API_URL=http://localhost:8000`

## 1) Create and activate a virtual environment

```bash
cd crewai-service
python3 -m venv .venv
source .venv/bin/activate
```

## 2) Install dependencies

```bash
pip install -r requirements.txt
```

## 3) Configure environment

```bash
cp .env.example .env
```

Set at minimum:

- `OPENAI_API_KEY=...`
- optionally `POSTPILOT_CREW_MODEL=...` (default: `gpt-4o-mini`)

## 4) Run service

```bash
uvicorn src.postpilot_crewai.service:app --host 0.0.0.0 --port 8000 --reload
```

## API contract

### Request

`POST /chat`

```json
{
  "userId": "user_123",
  "sessionId": "session-main",
  "message": "Help me improve my next LinkedIn post",
  "history": [],
  "context": {
    "account": {},
    "integrations": {},
    "connectedPlatforms": [],
    "voiceProfile": {}
  },
  "systemPrompt": "You are PostPilot..."
}
```

### Response

```json
{
  "reply": "Actionable AI response text",
  "action": "ai_reply",
  "provider": "crewai"
}
```
