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

function formatMediaType(raw) {
  const t = String(raw || "").toUpperCase();
  if (t === "VIDEO") return "Video";
  if (t === "IMAGE") return "Photo";
  if (t === "CAROUSEL_ALBUM") return "Carousel";
  if (t === "REEL" || t === "REELS") return "Reel";
  return raw || "Unknown";
}

function summarizePosts(posts, limit = 10) {
  if (!Array.isArray(posts) || !posts.length) return "No posts synced yet.";
  const items = posts.slice(0, limit).map((p, i) => {
    const platform = p.platform || "unknown";
    const date = p.postedAt ? new Date(p.postedAt).toLocaleDateString() : "unknown date";
    const type = p.mediaType ? formatMediaType(p.mediaType) : "";
    const likes = p.likes ?? "?";
    const comments = p.comments ?? "?";
    const impressions = p.impressions ?? "?";
    const caption = truncate(p.text || "(no caption)", 280);
    const link = p.permalink ? ` ${p.permalink}` : "";
    const typeLabel = type ? ` [${type}]` : "";
    return `${i + 1}. [${platform}]${typeLabel} ${date} | likes: ${likes}, comments: ${comments}, impressions: ${impressions}${link}\n   "${caption}"`;
  });
  return items.join("\n");
}

function wantsDeepHistory(message) {
  const text = String(message || "").toLowerCase();
  return /(all posts|all my posts|everything|entire history|full history|last year|past year|12 months|6 months|last 6 months|all time)/i.test(
    text,
  );
}

function selectPostsForMessage({ posts, message, max = 50 }) {
  if (!Array.isArray(posts) || !posts.length) return [];
  const sortedRecent = [...posts].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  if (wantsDeepHistory(message)) return sortedRecent.slice(0, Math.min(max, sortedRecent.length));

  const topByEngagement = [...posts]
    .map((p) => ({ p, eng: Number(p.likes || 0) + Number(p.comments || 0) }))
    .sort((a, b) => b.eng - a.eng)
    .slice(0, 8)
    .map((x) => x.p);

  const topByEngagementRate = [...posts]
    .filter((p) => Number(p.impressions || 0) > 0)
    .map((p) => ({
      p,
      score: (Number(p.likes || 0) + Number(p.comments || 0)) / Math.max(Number(p.impressions || 0), 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.p);

  const recent = sortedRecent.slice(0, 10);
  const merged = [];
  const seen = new Set();
  for (const p of [...topByEngagementRate, ...topByEngagement, ...recent]) {
    const key = `${p.platform}:${p.postedAt}:${p.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
    if (merged.length >= 18) break;
  }
  return merged;
}

function summarizeIntegrations(integrations) {
  const lines = [];
  for (const [platform, info] of Object.entries(integrations || {})) {
    if (!info?.connected) continue;
    const username = info.username || "(unknown handle)";
    const displayName = info.displayName || "";
    const syncedAt = info.lastSyncAt ? new Date(info.lastSyncAt).toLocaleString() : "never";
    let line = `- ${platform}: @${username}`;
    if (displayName) line += ` (${displayName})`;
    line += ` | last sync: ${syncedAt}`;
    if (info.bio) line += `\n  Bio: "${info.bio}"`;
    if (info.followersCount != null) line += `\n  Followers: ${info.followersCount}`;
    if (info.followsCount != null) line += ` | Following: ${info.followsCount}`;
    if (info.mediaCount != null) line += ` | Posts: ${info.mediaCount}`;
    if (info.website) line += `\n  Website: ${info.website}`;
    if (info.accountType) line += `\n  Account type: ${info.accountType}`;
    lines.push(line);
  }
  return lines.length ? lines.join("\n") : "No platforms connected.";
}

function buildSystemPrompt({ state, connectedPlatforms, language }) {
  const niche = state.user?.niche || "creator growth";
  const objective = state.user?.objective || "audience growth";
  const voice = state.voiceProfile || {};
  const tone = voice.tone || "clear and direct";
  const signatureWords = (voice.signatureWords || []).slice(0, 8).join(", ");
  const avgSentenceLen = voice.avgSentenceLength || "";
  const ctaStyle = voice.ctaStyle || "";
  const favoredOpeners = (voice.favoredOpeners || []).join("; ");

  const langCode = String(language || "").toLowerCase().slice(0, 2) || "en";
  const sections = [
    "You are PostPilot, an AI content coach for creators.",
    `Respond in the user's UI language (ISO code: ${langCode}) unless the user clearly switches language.`,
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
    summarizePosts(selectPostsForMessage({ posts: state.posts, message: state._lastUserMessageForPrompt || "" })),
    "",
    "## What you can see",
    "- Profile: bio, followers, following count, post count, website",
    "- Each post: media type (Photo/Video/Carousel/Reel), caption, date, likes, comments, impressions (and when available: reach, saves, video views), permalink",
    "- When images are attached in the current request, you can see those post images.",
    "- For videos and reels, you see the thumbnail/cover frame, not the full video",
    "- Use what you see in the images to give specific visual feedback when the user asks about posts, visuals, or performance.",
    "- If the user asks a generic message (e.g. hello), respond to that directly and do not force image analysis.",
    "",
    "## Guardrails",
    "- Never claim to have executed external actions unless explicitly confirmed.",
    "- If asked for unsafe, illegal, or deceptive content, refuse briefly and offer a safe alternative.",
    "- Use concise practical steps and avoid filler.",
    "- When uncertain, ask one focused clarifying question.",
    "- Reference the user's actual post data, performance metrics, and visual content when giving advice.",
    "- When discussing posts, always mention the media type (photo, video, reel, carousel).",
    "- Describe specific visual elements you observe: lighting, composition, text overlays, facial expressions, branding elements, color palette.",
    "- For videos/reels, note that you only see the cover frame/thumbnail, not the full video. Ask the user to describe the video content if needed.",
    "- Match the user's voice tone and style when drafting content.",
  ];

  return sections.filter(Boolean).join("\n");
}

/**
 * Downloads an image from a URL and returns a base64 data URI.
 * Instagram CDN URLs are signed/temporary and block OpenAI's servers,
 * so we must download server-side and pass as base64.
 */
async function fetchImageAsBase64(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PostPilot/1.0)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mime = contentType.split(";")[0].trim();
  return `data:${mime};base64,${base64}`;
}

function shouldUseVisionForMessage(message) {
  const text = String(message || "").toLowerCase().trim();
  if (!text) return false;
  return /(post|posts|photo|photos|image|images|video|videos|reel|reels|carousel|thumbnail|feed|instagram|ig|visual|design|look|aesthetic|perform|performance|engagement|viral|success)/i.test(
    text,
  );
}

/**
 * Collects image data from the user's most recent posts for GPT vision input.
 * Downloads each image and converts to base64 data URI.
 * For videos/reels, uses the thumbnail. Caps at `limit` images to control cost.
 */
async function collectPostImages(posts, limit = 5) {
  if (!Array.isArray(posts)) return [];
  const candidates = [];
  for (const p of posts) {
    if (candidates.length >= limit) break;
    const url = p.imageUrl || p.thumbnailUrl || p.mediaUrl || "";
    if (!url) continue;
    const type = formatMediaType(p.mediaType || "");
    const caption = truncate(p.text || "(no caption)", 120);
    const date = p.postedAt ? new Date(p.postedAt).toLocaleDateString() : "unknown";
    candidates.push({ url, type, caption, date, likes: p.likes ?? 0, comments: p.comments ?? 0 });
  }
  if (!candidates.length) return [];

  const results = await Promise.allSettled(
    candidates.map(async (img) => {
      const dataUri = await fetchImageAsBase64(img.url);
      if (!dataUri) return null;
      return { ...img, url: dataUri };
    }),
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);
}

/**
 * Builds a multimodal user message with text + image_url content blocks.
 * Uses detail:"low" (85 tokens/image) to keep cost minimal.
 */
function buildVisionUserMessage(text, postImages) {
  if (!postImages.length) return text;
  const content = [];
  let imageContext = "I'm attaching your most recent post images for reference:\n";
  postImages.forEach((img, i) => {
    imageContext += `\nImage ${i + 1}: [${img.type}] ${img.date} — likes: ${img.likes}, comments: ${img.comments}\nCaption: "${img.caption}"`;
  });
  content.push({ type: "text", text: `${imageContext}\n\nUser message: ${text}` });
  for (const img of postImages) {
    content.push({
      type: "image_url",
      image_url: { url: img.url, detail: "low" },
    });
  }
  return content;
}

function aiLog(level, message, data = undefined) {
  const payload = data !== undefined ? ` ${JSON.stringify(data)}` : "";
  const line = `[PostPilot][AI] ${message}${payload}`;
  if (level === "error") console.error(line);
  else console.log(line);
}

/**
 * Builds the data-only context sent to the CrewAI service.
 * CrewAI's YAML (agents.yaml + tasks.yaml) is the prompt source of truth;
 * this context provides the data the prompt references.
 */
function buildCrewContext({ state, connectedPlatforms, language, message }) {
  const selected = selectPostsForMessage({
    posts: state.posts,
    message: state._lastUserMessageForPrompt || message || "",
    max: 20,
  });
  const posts = selected.map((p) => ({
    platform: p.platform || "",
    type: formatMediaType(p.mediaType || ""),
    postedAt: p.postedAt || "",
    likes: Number(p.likes || 0),
    comments: Number(p.comments || 0),
    impressions: Number(p.impressions || 0),
    reach: Number(p.reach || 0),
    saved: Number(p.saved || 0),
    shares: Number(p.shares || 0),
    videoViews: Number(p.videoViews || 0),
    text: truncate(p.text || "", 500),
    permalink: p.permalink || "",
  }));
  return {
    account: state.user || {},
    integrations: state.integrations || {},
    connectedPlatforms,
    voiceProfile: state.voiceProfile || {},
    posts,
    language: String(language || "").toLowerCase().slice(0, 2) || "en",
  };
}

async function callOpenAI({ message, history, state, connectedPlatforms, language }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    aiLog("error", "OpenAI skipped: OPENAI_API_KEY not set");
    throw new Error("openai_not_configured");
  }

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Vision routing", { useVision, count: postImages.length });
  const userContent = buildVisionUserMessage(inputText, postImages);
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
        { role: "system", content: buildSystemPrompt({ state, connectedPlatforms, language }) },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
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

async function callCrewAI({ message, history, state, connectedPlatforms, userId, sessionId, language }) {
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

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Vision routing for CrewAI", { useVision, count: postImages.length });
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
        message: inputText,
        history,
        context: buildCrewContext({ state, connectedPlatforms, language, message: inputText }),
        systemPrompt: "",
        postImages,
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

async function generateAgentReply({ message, history, state, userId, sessionId, language }) {
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
      language,
    });
  }

  if (provider === "crewai") {
    try {
      return await callCrewAI({
        message,
        history: normalizedHistory,
        state,
        connectedPlatforms,
        userId,
        sessionId,
        language,
      });
    } catch (err) {
      const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
      aiLog("error", "CrewAI request failed; evaluating OpenAI fallback", {
        reason: String(err?.message || err),
        hasOpenAiKey,
      });
      if (!hasOpenAiKey) throw err;
      aiLog("log", "Falling back to OpenAI request");
      return callOpenAI({
        message,
        history: normalizedHistory,
        state,
        connectedPlatforms,
        language,
      });
    }
  }

  aiLog("error", "Unsupported AI_PROVIDER", { provider });
  throw new Error(`unsupported_ai_provider_${provider}`);
}

async function* streamOpenAI({ message, history, state, connectedPlatforms, language }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("openai_not_configured");

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Vision routing for stream", { useVision, count: postImages.length });
  const userContent = buildVisionUserMessage(inputText, postImages);
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
        { role: "system", content: buildSystemPrompt({ state, connectedPlatforms, language }) },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
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

async function* streamCrewAI({ message, history, state, connectedPlatforms, userId, sessionId, language }) {
  const baseUrl = process.env.CREWAI_API_URL || "";
  if (!baseUrl) throw new Error("crewai_not_configured");
  const apiKey = process.env.CREWAI_API_KEY || "";
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/stream`;

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Vision routing for CrewAI stream", { useVision, count: postImages.length });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      userId: String(userId ?? ""),
      sessionId: String(sessionId ?? ""),
      message: inputText,
      history,
      context: buildCrewContext({ state, connectedPlatforms, language, message: inputText }),
      systemPrompt: "",
      postImages,
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

async function* streamAgentReply({ message, history, state, userId, sessionId, language }) {
  const provider = (process.env.AI_PROVIDER || "crewai").toLowerCase();
  aiLog("log", "streamAgentReply", { provider, language });
  const connectedPlatforms = Object.entries(state.integrations || {})
    .filter(([, value]) => value?.connected)
    .map(([key]) => key);
  const normalizedHistory = normalizeHistory(history);

  if (provider === "openai") {
    yield* streamOpenAI({ message, history: normalizedHistory, state, connectedPlatforms, language });
    return;
  }

  if (provider === "crewai") {
    try {
      yield* streamCrewAI({
        message,
        history: normalizedHistory,
        state,
        connectedPlatforms,
        userId,
        sessionId,
        language,
      });
      return;
    } catch (err) {
      const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
      aiLog("error", "CrewAI stream failed; evaluating OpenAI fallback", {
        reason: String(err?.message || err),
        hasOpenAiKey,
      });
      if (!hasOpenAiKey) throw err;
      aiLog("log", "Falling back to OpenAI stream");
      yield* streamOpenAI({ message, history: normalizedHistory, state, connectedPlatforms, language });
      return;
    }
  }

  throw new Error(`unsupported_ai_provider_${provider}`);
}

module.exports = {
  generateAgentReply,
  streamAgentReply,
  buildSystemPrompt,
  normalizeHistory,
  collectPostImages,
  buildVisionUserMessage,
};
