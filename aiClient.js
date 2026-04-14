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

function buildSystemPrompt({ state, connectedPlatforms }) {
  const niche = state.user?.niche || "creator growth";
  const objective = state.user?.objective || "audience growth";
  const tone = state.voiceProfile?.tone || "clear and direct";
  const signatureWords = (state.voiceProfile?.signatureWords || []).slice(0, 8).join(", ");
  const recommendations = [
    "Never claim to have executed external actions unless explicitly confirmed.",
    "If asked for unsafe, illegal, or deceptive content, refuse briefly and offer a safe alternative.",
    "Use concise practical steps and avoid filler.",
    "When uncertain, ask one focused clarifying question.",
  ];

  return [
    "You are PostPilot, an AI coach for creators.",
    `User niche: ${niche}.`,
    `Primary objective: ${objective}.`,
    `Connected platforms: ${connectedPlatforms.join(", ") || "none"}.`,
    `Voice tone target: ${tone}.`,
    `Signature words: ${signatureWords || "creator, growth, system"}.`,
    "",
    "Guardrails:",
    ...recommendations.map((x) => `- ${x}`),
  ].join("\n");
}

async function callOpenAI({ message, history, state, connectedPlatforms }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
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
    throw new Error("crewai_not_configured");
  }
  const apiKey = process.env.CREWAI_API_KEY || "";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      userId,
      sessionId,
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
    throw new Error(`crewai_request_failed_${res.status}`);
  }
  const data = safeJsonParse(await res.text(), {});
  const content = String(data.reply || data.content || "").trim();
  if (!content) throw new Error("crewai_empty_response");
  return {
    content: truncate(content, DEFAULT_MAX_OUTPUT_CHARS),
    action: data.action || "ai_reply",
    provider: "crewai",
  };
}

async function generateAgentReply({ message, history, state, userId, sessionId }) {
  const provider = (process.env.AI_PROVIDER || "crewai").toLowerCase();
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

  throw new Error(`unsupported_ai_provider_${provider}`);
}

module.exports = {
  generateAgentReply,
};
