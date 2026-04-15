const DEFAULT_MAX_INPUT_CHARS = 4000;
const DEFAULT_MAX_OUTPUT_CHARS = 6000;

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return fallback;
  }
}

function truncate(text, limit) {
  const raw = String(text || "");
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}...`;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && typeof m === "object" && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: truncate(m.content || "", 1500),
      at: m.at || null,
      action: m.action || null,
    }))
    .slice(-20);
}

function summarizePosts(posts, limit = 10) {
  if (!Array.isArray(posts) || !posts.length) return "No posts synced yet.";
  const items = posts.slice(0, limit).map((p, i) => {
    const platform = p.platform || "unknown";
    const date = p.postedAt ? new Date(p.postedAt).toLocaleDateString() : "unknown date";
    const likes = p.likes ?? "?";
    const comments = p.comments ?? "?";
    const impressions = p.impressions ?? "?";
    const caption = truncate(p.text || "(no caption)", 280);
    return `${i + 1}. [${platform}] ${date} | likes: ${likes}, comments: ${comments}, impressions: ${impressions}\n   "${caption}"`;
  });
  return items.join("\n");
}

function summarizeIntegrations(integrations) {
  const lines = [];
  for (const [platform, info] of Object.entries(integrations || {})) {
    if (!info?.connected) continue;
    const username = info.username || "(unknown handle)";
    const syncedAt = info.lastSyncAt ? new Date(info.lastSyncAt).toLocaleString() : "never";
    lines.push(`- ${platform}: @${username} (last sync: ${syncedAt})`);
  }
  return lines.length ? lines.join("\n") : "No platforms connected.";
}

function buildSystemPrompt({ state, connectedPlatforms }) {
  const niche = state.user?.niche || "creator growth";
  const objective = state.user?.objective || "audience growth";
  const voice = state.voiceProfile || {};
  const tone = voice.tone || "clear and direct";
  const signatureWords = (voice.signatureWords || []).slice(0, 8).join(", ");
  const avgSentenceLen = voice.avgSentenceLength || "";
  const ctaStyle = voice.ctaStyle || "";
  const favoredOpeners = (voice.favoredOpeners || []).join("; ");

  const sections = [
    "You are PostPilot, an AI content coach for creators.",
    "",
    "## Creator profile",
    `- Niche: ${niche}`,
    `- Primary objective: ${objective}`,
    `- Connected platforms: ${connectedPlatforms.join(", ") || "none"}`,
    "",
    "## Connected accounts",
    summarizeIntegrations(state.integrations),
    "",
    "## Voice profile (derived from their posts)",
    `- Tone: ${tone}`,
    signatureWords ? `- Signature words: ${signatureWords}` : "",
    avgSentenceLen ? `- Avg sentence length: ${avgSentenceLen} words` : "",
    ctaStyle ? `- CTA style: ${ctaStyle}` : "",
    favoredOpeners ? `- Favored openers: ${favoredOpeners}` : "",
    "",
    "## Recent posts (with performance)",
    summarizePosts(state.posts),
    "",
    "## Guardrails",
    "- Never claim to have executed external actions unless explicitly confirmed.",
    "- If asked for unsafe, illegal, or deceptive content, refuse briefly and offer a safe alternative.",
    "- Use concise practical steps and avoid filler.",
    "- When uncertain, ask one focused clarifying question.",
    "- Reference the user's actual post data and performance metrics when giving advice.",
    "- Match the user's voice tone and style when drafting content.",
  ];

  return sections.filter(Boolean).join("\n");
}

function aiLog(level, message, data = undefined) {
  const payload = data !== undefined ? ` ${JSON.stringify(data)}` : "";
  const line = `[PostPilot][AI] ${message}${payload}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

async function callOpenAI({ message, history, state, connectedPlatforms }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    aiLog("error", "OpenAI skipped: OPENAI_API_KEY not set");
    throw new Error("openai_not_configured");
  }

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: buildSystemPrompt({ state, connectedPlatforms }) },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: inputText },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = truncate(await res.text(), 400);
    aiLog("error", "OpenAI HTTP error", { status: res.status, bodyPreview: errBody });
    throw new Error(`openai_request_failed_${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("openai_empty_response");
  return {
    content: truncate(content, DEFAULT_MAX_OUTPUT_CHARS),
    action: "ai_reply",
    provider: "openai",
  };
}

async function callCrewAI({ message, history, state, connectedPlatforms, userId, sessionId }) {
  const baseUrl = process.env.CREWAI_API_URL || "";
  if (!baseUrl) {
    aiLog("error", "CrewAI skipped: CREWAI_API_URL not set");
    throw new Error("crewai_not_configured");
  }
  const apiKey = process.env.CREWAI_API_KEY || "";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat`;
  let crewaiHost = "";
  try {
    crewaiHost = new URL(baseUrl).host;
  } catch (_e) {
    crewaiHost = "(invalid CREWAI_API_URL)";
  }
  aiLog("log", "CrewAI request", {
    host: crewaiHost,
    path: "/chat",
    sendsAuthHeader: Boolean(apiKey),
    userId,
    sessionId: String(sessionId || "").slice(0, 36),
  });

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        userId: String(userId ?? ""),
        sessionId: String(sessionId ?? ""),
        message: truncate(message, DEFAULT_MAX_INPUT_CHARS),
        history,
        context: {
          account: state.user,
          integrations: state.integrations,
          connectedPlatforms,
          voiceProfile: state.voiceProfile,
        },
        systemPrompt: buildSystemPrompt({ state, connectedPlatforms }),
      }),
    });
  } catch (err) {
    aiLog("error", "CrewAI fetch failed (network / DNS / TLS)", {
      host: crewaiHost,
      name: err?.name,
      message: String(err?.message || err),
    });
    throw err;
  }

  if (!res.ok) {
    const errBody = truncate(await res.text(), 500);
    aiLog("error", "CrewAI HTTP error", { status: res.status, host: crewaiHost, bodyPreview: errBody });
    throw new Error(`crewai_request_failed_${res.status}`);
  }
  const rawText = await res.text();
  const data = safeJsonParse(rawText, {});
  const content = String(data.reply || data.content || "").trim();
  if (!content) {
    aiLog("error", "CrewAI empty reply", {
      host: crewaiHost,
      rawLen: rawText.length,
      jsonKeys: Object.keys(data || {}),
    });
    throw new Error("crewai_empty_response");
  }
  return {
    content: truncate(content, DEFAULT_MAX_OUTPUT_CHARS),
    action: data.action || "ai_reply",
    provider: "crewai",
  };
}

async function generateAgentReply({ message, history, state, userId, sessionId }) {
  const provider = (process.env.AI_PROVIDER || "crewai").toLowerCase();
  aiLog("log", "generateAgentReply", {
    provider,
    crewaiUrlSet: Boolean(process.env.CREWAI_API_URL),
    openaiKeySet: Boolean(process.env.OPENAI_API_KEY),
  });
  const connectedPlatforms = Object.entries(state.integrations || {})
    .filter(([, value]) => value?.connected)
    .map(([key]) => key);
  const normalizedHistory = normalizeHistory(history);

  if (provider === "openai") {
    return callOpenAI({
      message,
      history: normalizedHistory,
      state,
      connectedPlatforms,
    });
  }

  if (provider === "crewai") {
    return callCrewAI({
      message,
      history: normalizedHistory,
      state,
      connectedPlatforms,
      userId,
      sessionId,
    });
  }

  aiLog("error", "Unsupported AI_PROVIDER", { provider });
  throw new Error(`unsupported_ai_provider_${provider}`);
}

async function* streamOpenAI({ message, history, state, connectedPlatforms }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("openai_not_configured");

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt({ state, connectedPlatforms }) },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: inputText },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = truncate(await res.text(), 400);
    aiLog("error", "OpenAI stream HTTP error", { status: res.status, bodyPreview: errBody });
    throw new Error(`openai_request_failed_${res.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch (_e) { /* skip malformed SSE line */ }
    }
  }
}

async function* streamCrewAI({ message, history, state, connectedPlatforms, userId, sessionId }) {
  const baseUrl = process.env.CREWAI_API_URL || "";
  if (!baseUrl) throw new Error("crewai_not_configured");
  const apiKey = process.env.CREWAI_API_KEY || "";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/stream`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      userId: String(userId ?? ""),
      sessionId: String(sessionId ?? ""),
      message: truncate(message, DEFAULT_MAX_INPUT_CHARS),
      history,
      context: {
        account: state.user,
        integrations: state.integrations,
        connectedPlatforms,
        voiceProfile: state.voiceProfile,
      },
      systemPrompt: buildSystemPrompt({ state, connectedPlatforms }),
    }),
  });

  if (!res.ok) {
    const errBody = truncate(await res.text(), 500);
    aiLog("error", "CrewAI stream HTTP error", { status: res.status, bodyPreview: errBody });
    throw new Error(`crewai_stream_failed_${res.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.done) return;
        if (parsed.token) yield parsed.token;
      } catch (e) {
        if (e.message && !e.message.startsWith("Unexpected")) throw e;
      }
    }
  }
}

async function* streamAgentReply({ message, history, state, userId, sessionId }) {
  const provider = (process.env.AI_PROVIDER || "crewai").toLowerCase();
  aiLog("log", "streamAgentReply", { provider });
  const connectedPlatforms = Object.entries(state.integrations || {})
    .filter(([, value]) => value?.connected)
    .map(([key]) => key);
  const normalizedHistory = normalizeHistory(history);

  if (provider === "openai") {
    yield* streamOpenAI({ message, history: normalizedHistory, state, connectedPlatforms });
    return;
  }

  if (provider === "crewai") {
    yield* streamCrewAI({
      message,
      history: normalizedHistory,
      state,
      connectedPlatforms,
      userId,
      sessionId,
    });
    return;
  }

  throw new Error(`unsupported_ai_provider_${provider}`);
}

module.exports = {
  generateAgentReply,
  streamAgentReply,
  buildSystemPrompt,
  normalizeHistory,
};
