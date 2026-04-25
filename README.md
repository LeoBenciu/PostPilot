# PostPilot Agent MVP

Chat-first AI agent for creators that mimics voice, analyzes content performance, and generates growth actions.

## What changed

- ChatGPT-style interface (single chat thread)
- "Connect account" flow for LinkedIn + Instagram
- Automatic post ingestion on connect/sync
- Agent endpoint that decides actions from natural language:
  - generate draft
  - analytics summary
  - weekly plan
  - repurpose latest post

## Run locally

1. Install Node.js 18+ and run:

```bash
npm install
```

2. Start PostgreSQL (Docker example):

```bash
docker run --name postpilot-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postpilot -p 5432:5432 -d postgres:16
```

3. Set required env vars in `.env`:
   - `DATABASE_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_COOKIE_NAME`
   - `SESSION_TTL_DAYS`
   - `AI_PROVIDER` (`crewai` or `openai`)
   - `CREWAI_API_URL` (when using CrewAI)
   - `CREWAI_API_KEY` (optional bearer token)
   - `OPENAI_API_KEY` + `OPENAI_MODEL` (when using OpenAI)
   - `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`
   - `INSTAGRAM_CLIENT_ID` + `INSTAGRAM_CLIENT_SECRET`
   - `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID` (optional, if you use Stripe Dashboard prices)
   - `STRIPE_MONTHLY_EUR_CENTS` (default `3000`)
   - Waitlist email notifications (for landing form):
     - `WAITLIST_NOTIFY_TO` (default `nextcorpromania@gmail.com`)
     - Either `WAITLIST_SMTP_URL` or:
       - `WAITLIST_SMTP_HOST`
       - `WAITLIST_SMTP_PORT`
       - `WAITLIST_SMTP_USER`
       - `WAITLIST_SMTP_PASS`
     - Optional `WAITLIST_FROM_EMAIL`

4. Run Prisma migration + client generation:

```bash
npx prisma migrate dev --name init
```

5. Start the app:

```bash
npm start
```

6. Open `http://localhost:3000`

If port 3000 is busy:

```bash
PORT=3011 node server.js
```

## CrewAI proper project structure (optional local service)

If you want a native CrewAI-style structure (YAML agents/tasks + Python service),
this repo now includes `crewai-service/`.

### Structure

- `crewai-service/src/postpilot_crewai/config/agents.yaml`
- `crewai-service/src/postpilot_crewai/config/tasks.yaml`
- `crewai-service/src/postpilot_crewai/crew.py`
- `crewai-service/src/postpilot_crewai/service.py`

### Run

```bash
cd crewai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn src.postpilot_crewai.service:app --host 0.0.0.0 --port 8000 --reload
```

Then use in root `.env`:

- `AI_PROVIDER=crewai`
- `CREWAI_API_URL=http://localhost:8000`

## Main API endpoints

- `GET /api/health`
- `POST /api/auth/signup` (`fullName`, `email`, `password`)
- `POST /api/auth/signin` (`email`, `password`)
- `POST /api/auth/signout`
- `GET /api/auth/session`
- `GET /api/integrations`
- `POST /api/integrations/connect` (`platform`, `username`)
- `POST /api/integrations/sync`
- `GET /api/integrations/sync-status`
- `GET /api/voice-profile`
- `GET /api/analytics/summary`
- `GET /api/posts/recent`
- `POST /api/agent/message` (`sessionId`, `message`)
- `GET /api/payment/status`
- `POST /api/payment/create-checkout-session`
- `POST /api/payment/create-portal-session`
- `POST /api/payment/cancel-subscription`
- `POST /api/payment/webhook`

## AI integration details

- The chat route now uses a real provider layer (`aiClient.js`) instead of static response logic.
- Prompt templates + guardrails are generated server-side from account context (niche, objective, platforms, voice profile).
- Conversation is persisted per user/session in PostgreSQL and passed into each AI turn.
- CrewAI mode (`AI_PROVIDER=crewai`) calls `POST {CREWAI_API_URL}/chat` with:
  - `userId`, `sessionId`, `message`, `history`, `context`, `systemPrompt`
- OpenAI mode (`AI_PROVIDER=openai`) uses Chat Completions with the same persisted context.

## Social integrations

- LinkedIn and Instagram are now OAuth-based, not mocked.
- Start OAuth by either:
  - opening `/auth/linkedin` or `/auth/instagram`, or
  - calling `POST /api/integrations/connect` with `{ "platform": "linkedin" }` (or `instagram`) and redirecting to `authUrl`.
- OAuth callbacks:
  - `/auth/linkedin/callback`
  - `/auth/instagram/callback`
- Sync runs via `POST /api/integrations/sync` and creates job records with retries:
  - `queued -> running -> success|failed`
  - up to 3 attempts per platform
- Fetch latest sync states/jobs from `GET /api/integrations/sync-status`.

## Stripe payments

- Payment unlock is set only via verified Stripe webhook events.
- Frontend starts checkout via `POST /api/payment/create-checkout-session`.
- Webhook endpoint: `POST /api/payment/webhook` (requires Stripe signature verification).
- Main handled events:
  - `checkout.session.completed` -> mark paid
  - `invoice.paid` -> keep paid status active on renewals
  - `customer.subscription.updated` -> mark paid/unpaid by status
  - `customer.subscription.deleted` -> mark unpaid
  - `invoice.payment_failed` -> mark unpaid
- Management endpoints:
  - `POST /api/payment/create-portal-session` -> redirect authenticated users to Stripe Billing Portal
  - `POST /api/payment/cancel-subscription` -> schedule cancellation at period end

## Production upgrades

- Real LinkedIn/Instagram API ingestion workers
- External LLM provider + tool-calling agent orchestration
- Billing, auth, rate limits, and audit logging

## Rotate Google OAuth secrets

Because the previous secret was exposed, rotate immediately:

1. Open Google Cloud Console -> APIs & Services -> Credentials.
2. Create a new OAuth 2.0 Client Secret for your Web client.
3. Restrict authorized redirect URIs to your exact domains (including `/auth/google/callback`).
4. Replace `GOOGLE_CLIENT_SECRET` in `.env`.
5. Delete or disable the old compromised secret.
