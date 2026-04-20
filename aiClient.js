const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const DEFAULT_MAX_INPUT_CHARS = 4000;
const DEFAULT_MAX_OUTPUT_CHARS = 6000;
const SKIP_RATE_PROXY_TARGET_SECONDS = Math.max(
  1,
  Number(process.env.POSTPILOT_SKIP_RATE_PROXY_TARGET_SECONDS || 3),
);

const YAML_CONFIG_DIR = path.join(
  __dirname,
  "crewai-service",
  "src",
  "postpilot_crewai",
  "config",
);

const LANGUAGE_NAMES = {
  en: "English",
  ro: "Romanian",
  it: "Italian",
  de: "German",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
};

function resolveLanguageName(code) {
  const key = String(code || "en").toLowerCase().slice(0, 2);
  return LANGUAGE_NAMES[key] || "English";
}

function collapseWhitespace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// YAML cache keyed on file mtimes so edits to agents.yaml / tasks.yaml
// are picked up without a server restart, but we don't re-parse on every
// request either.
let _yamlCache = null;

function loadPromptConfig() {
  const agentsPath = path.join(YAML_CONFIG_DIR, "agents.yaml");
  const tasksPath = path.join(YAML_CONFIG_DIR, "tasks.yaml");
  try {
    const agentsStat = fs.statSync(agentsPath);
    const tasksStat = fs.statSync(tasksPath);
    if (
      _yamlCache &&
      _yamlCache.mtimes.agents === agentsStat.mtimeMs &&
      _yamlCache.mtimes.tasks === tasksStat.mtimeMs
    ) {
      return _yamlCache;
    }
    const agents = YAML.parse(fs.readFileSync(agentsPath, "utf8")) || {};
    const tasks = YAML.parse(fs.readFileSync(tasksPath, "utf8")) || {};
    _yamlCache = {
      mtimes: { agents: agentsStat.mtimeMs, tasks: tasksStat.mtimeMs },
      agents,
      tasks,
    };
    return _yamlCache;
  } catch (err) {
    // Surface loudly — if the YAML files disappear we want to know in logs,
    // not silently fall back to a different prompt.
    console.error("[PostPilot][AI] ⚠️ Failed to load prompt YAML", String(err?.message || err));
    return null;
  }
}

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

function isAnthropicModel(model) {
  return String(model || "").toLowerCase().startsWith("claude");
}

// Stream event helpers. Stream generators yield these typed events so the
// server can route status updates to the client without mixing them into the
// token stream. Status keys are short identifiers ("thinking",
// "searching_market", "analyzing_posts", "writing", "checking_profile") — the
// client maps them to localized strings.
const tokenEvent = (value) => ({ type: "token", value: String(value || "") });
const statusEvent = (value) => ({ type: "status", value: String(value || "") });

function resolveDirectModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

// ---------------------------------------------------------------------------
// Tavily market-context helpers (direct/fallback path only — when we go
// through CrewAI, the Python service does its own Tavily lookup).
//
// Gated behind a cheap keyword heuristic: simple greetings, pure analytics
// questions, and off-topic messages skip the call so we don't burn Tavily
// credits or add latency when market data wouldn't help.
// ---------------------------------------------------------------------------

const MARKET_TRIGGERS = [
  // English
  "trend", "viral", "what works", "whats working", "what's working",
  "top creator", "best performing", "perform well", "popular", "benchmark",
  "industry", "competit", "market", "inspiration", "inspire", "hook",
  "idea", "ideas", "format", "caption", "hashtag", "reel", "script",
  "growth strategy", "go viral", "compared to", "how do i grow",
  // Romanian
  "tend", "tendin", "vira", "ce func", "ce merge", "idee", "idei", "idei de",
  "inspir", "scenariu", "scenari", "hook", "format", "popular", "compar",
  "strategi", "cresc", "crestere", "creștere",
  // Italian
  "tendenz", "virali", "idee", "ispira", "cresc", "popolare", "format",
  "copione", "didascali", "strategi",
  // German
  "trend", "viral", "idee", "ideen", "wachstum", "beliebt", "strateg",
  "format", "untertitel",
  // French
  "tendance", "vira", "idée", "idées", "inspir", "croissance", "populaire",
  "stratégi", "format", "légende",
  // Spanish
  "tendenc", "viral", "idea", "ideas", "inspir", "crecimiento", "popular",
  "estrategi", "formato", "subtítulo",
  // Portuguese
  "tendênc", "vira", "ideia", "inspira", "crescimento", "popular",
  "estratégi", "formato", "legenda",
];

const TAVILY_TIMEOUT_MS = 6000;

function shouldSearchMarket(message, niche) {
  if (!message || !niche) return false;
  const trimmed = String(niche).trim();
  if (!trimmed || trimmed === "(not set)") return false;
  const lower = String(message).toLowerCase();
  return MARKET_TRIGGERS.some((kw) => lower.includes(kw));
}

/** When onboarding niche is empty but the user names one in the question
 * (e.g. "trending for build-in-public creators"), use that for Tavily + context.
 */
function extractNicheHintFromMessage(message) {
  const raw = String(message || "").trim();
  if (!raw) return "";
  const patterns = [
    /instagram\s+for\s+([^,.\n]+?)\s+creators/i,
    /for\s+([^,.\n]+?)\s+creators/i,
    /pentru\s+creatori(?:i)?\s+(?:de\s+)?([^,.\n]+?)(?:\s+în|\s+in|,|\.|\?|$)/iu,
  ];
  for (const re of patterns) {
    const hit = raw.match(re);
    if (!hit || !hit[1]) continue;
    let s = hit[1].trim();
    s = s.replace(/\s+in\s+\d{4}$/i, "").trim();
    s = s
      .replace(
        /\s+(in|în)\s+(romanian|english|italian|german|french|spanish|portuguese)$/i,
        "",
      )
      .trim();
    if (s.length >= 3 && s.length < 120) return s;
  }
  return "";
}

function resolveEffectiveNiche(state, message) {
  const fromState = String(state?.user?.niche || "").trim();
  if (fromState && fromState !== "(not set)") return fromState;
  return extractNicheHintFromMessage(message);
}

function buildMarketQuery(niche, language, userMessage) {
  const year = new Date().getUTCFullYear();
  const words = String(userMessage || "")
    .match(/[\w\u00c0-\u017f']{4,}/g) || [];
  const extra = words.slice(0, 8).join(" ");
  const langHint =
    language && language.toLowerCase() !== "english" ? ` in ${language}` : "";
  let base =
    `What is currently trending on Instagram for ${String(niche).trim()} creators${langHint} in ${year}? ` +
    "Focus on viral hooks, popular content formats, trending hashtags, and specific " +
    "creators performing well right now.";
  if (extra) base += ` Context from the user: ${extra}`;
  return base;
}

function formatTavilyResults(query, payload) {
  if (!payload) return null;
  const lines = [`Query: ${query}`];
  const answer = String(payload.answer || "").trim();
  if (answer) lines.push(`Summary: ${answer}`);
  const results = Array.isArray(payload.results) ? payload.results : [];
  if (results.length) {
    lines.push("Sources:");
    for (const r of results.slice(0, 6)) {
      const title = String(r?.title || "").trim();
      let content = String(r?.content || "").trim().replace(/\s+/g, " ");
      if (content.length > 320) content = `${content.slice(0, 320)}...`;
      const url = String(r?.url || "").trim();
      if (title) lines.push(`- ${title}`);
      if (content) lines.push(`  ${content}`);
      if (url) lines.push(`  ${url}`);
    }
  }
  return lines.length > 1 ? lines.join("\n") : null;
}

async function fetchMarketContext({ niche, language, userMessage }) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  const query = buildMarketQuery(niche, language, userMessage);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: 5,
        topic: "general",
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
    if (!res.ok) {
      aiLog("warn", "Tavily HTTP error", { status: res.status });
      return null;
    }
    const data = await res.json();
    return formatTavilyResults(query, data);
  } catch (err) {
    aiLog("warn", "Tavily fetch failed", { message: String(err?.message || err) });
    return null;
  }
}

async function resolveMarketContext({ state, language, message }) {
  try {
    const niche = resolveEffectiveNiche(state, message);
    const trimmedNiche = String(niche).trim();
    const apiKey = process.env.TAVILY_API_KEY;
    const messagePreview = String(message || "").slice(0, 80);

    // Single-stop diagnostic log so every chat makes the Tavily decision
    // transparent in production logs. Useful to answer "why didn't Tavily
    // fire?" without attaching a debugger.
    if (!apiKey) {
      aiLog("log", "Tavily decision: skipped (TAVILY_API_KEY not set)");
      return null;
    }
    if (!trimmedNiche || trimmedNiche === "(not set)") {
      aiLog("log", "Tavily decision: skipped (niche not in profile or message)", {
        messagePreview,
      });
      return null;
    }
    if (!shouldSearchMarket(message, niche)) {
      aiLog("log", "Tavily decision: skipped (no market trigger in message)", {
        niche: trimmedNiche,
        messagePreview,
      });
      return null;
    }

    const languageName = resolveLanguageName(language);
    aiLog("log", "Tavily decision: firing", {
      niche: trimmedNiche,
      language: languageName,
      messagePreview,
    });

    const startedAt = Date.now();
    const result = await fetchMarketContext({
      niche,
      language: languageName,
      userMessage: message,
    });
    const elapsedMs = Date.now() - startedAt;

    if (result) {
      aiLog("log", "Tavily decision: context ready", {
        length: result.length,
        elapsedMs,
      });
    } else {
      aiLog("log", "Tavily decision: no usable results", { elapsedMs });
    }
    return result;
  } catch (err) {
    aiLog("warn", "resolveMarketContext failed", { message: String(err?.message || err) });
    return null;
  }
}

// Anthropic's Messages API expects images as {type:"image", source:{...}} rather
// than OpenAI's {type:"image_url", image_url:{url}}. Our vision pipeline produces
// base64 data URIs — split them into media_type + raw base64 for Anthropic.
function convertVisionContentToAnthropic(content) {
  if (!Array.isArray(content)) return content;
  return content.map((block) => {
    if (block?.type === "image_url") {
      const url = block.image_url?.url || "";
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        return {
          type: "image",
          source: { type: "base64", media_type: m[1], data: m[2] },
        };
      }
      return { type: "image", source: { type: "url", url } };
    }
    return block;
  });
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

// ---------------------------------------------------------------------------
// Context formatters — 1:1 port of crewai-service/.../crew.py so the Node
// fallback produces the same system prompt the CrewAI service would produce.
// ---------------------------------------------------------------------------

function formatProfileSection(ctx) {
  const platforms = ctx.connectedPlatforms || [];
  const lines = [];
  const firstName = ctx.firstName || "";
  if (firstName) lines.push(`First name (use when greeting): ${firstName}`);
  lines.push(`Connected platforms: ${platforms.length ? platforms.join(", ") : "none"}`);
  return lines.join("\n");
}

function formatIntegrationsSection(ctx) {
  const integrations = ctx.integrations || {};
  const lines = [];
  for (const [platform, info] of Object.entries(integrations)) {
    if (!info || !info.connected) continue;
    const username = info.username || "(unknown)";
    let line = `- ${platform}: @${username}`;
    if (info.displayName) line += ` (${info.displayName})`;
    if (info.followersCount != null) line += ` | ${info.followersCount} followers`;
    if (info.mediaCount != null) line += ` | ${info.mediaCount} posts`;
    if (info.bio) line += `\n  Bio: "${truncate(info.bio, 200)}"`;
    lines.push(line);
  }
  return lines.length ? lines.join("\n") : "No connected accounts.";
}

function formatStatsSection(ctx) {
  const stats = ctx.stats || {};
  if (!stats || !stats.totalPosts) return "No aggregated stats yet (no posts synced).";
  const lines = [
    `Total posts synced: ${stats.totalPosts}`,
    `Posts in last 30 days: ${stats.postsLast30Days} | last 90 days: ${stats.postsLast90Days}`,
  ];
  if (stats.daysSinceLastPost != null) {
    lines.push(`Days since last post: ${stats.daysSinceLastPost}`);
  }
  lines.push(
    `Posts with zero comments: ${stats.postsWithZeroComments}/${stats.totalPosts} (${stats.postsWithZeroCommentsPct}%)`,
  );
  lines.push(`Average per post: ${stats.avgLikes} likes, ${stats.avgComments} comments`);
  if (stats.avgEngagementRate != null) {
    lines.push(`Average engagement rate: ${stats.avgEngagementRate}%`);
  }
  if (stats.avgSkipRateProxy != null && Number(stats.reelsWithSkipRateProxy || 0) > 0) {
    lines.push(
      `Reels skip-rate proxy (target ${stats.skipRateProxyTargetSeconds || SKIP_RATE_PROXY_TARGET_SECONDS}s watch): ` +
        `${stats.avgSkipRateProxy}% across ${stats.reelsWithSkipRateProxy} reels`,
    );
  }
  if (Array.isArray(stats.skipRateProxyTrend) && stats.skipRateProxyTrend.length >= 2) {
    const trendText = stats.skipRateProxyTrend.map((v) => `${v}%`).join(" -> ");
    lines.push(`Skip-rate trend (oldest -> newest): ${trendText} (${stats.skipRateProxyTrendDirection})`);
  }
  const topER = stats.topPostByEngagementRate;
  if (topER) {
    lines.push(
      `Best post by engagement rate: ${topER.engagementRate}% (${topER.type}, ${topER.likes} likes, ${topER.comments} comments, ${topER.impressions} views)`,
    );
    if (topER.text) lines.push(`  Caption: "${topER.text}"`);
  }
  const topViews = stats.topPostByViews;
  if (topViews) {
    lines.push(
      `Most-viewed post: ${topViews.impressions} views (${topViews.type}, ${topViews.likes} likes, ${topViews.comments} comments)`,
    );
    if (topViews.text) lines.push(`  Caption: "${topViews.text}"`);
  }
  return lines.join("\n");
}

function formatPostsSection(ctx, limit = 12) {
  const posts = ctx.posts || [];
  if (!posts.length) return "No posts synced yet.";
  return posts
    .slice(0, limit)
    .map((p, i) => {
      const parts = [`${p.likes} likes`, `${p.comments} comments`];
      if (p.impressions) parts.push(`${p.impressions} views`);
      if (p.reach) parts.push(`${p.reach} reach`);
      if (p.saved) parts.push(`${p.saved} saved`);
      if (p.shares) parts.push(`${p.shares} shares`);
      if (p.videoViews) parts.push(`${p.videoViews} video views`);
      if (Number(p.avgWatchTime || 0) > 0) parts.push(`${p.avgWatchTime}s avg watch`);
      if (p.skipRateProxy != null) parts.push(`skip proxy ${p.skipRateProxy}%`);
      if (p.engagementRate != null) parts.push(`ER ${p.engagementRate}%`);
      const text = p.text || "(no caption)";
      return `[${i + 1}] ${p.type || "Post"} — ${p.postedAt || "unknown date"} — ${parts.join(", ")}\n"${text}"`;
    })
    .join("\n\n");
}

function formatAccountContext(ctx) {
  return [
    "=== Profile ===",
    formatProfileSection(ctx),
    "",
    "=== Connected accounts ===",
    formatIntegrationsSection(ctx),
    "",
    "=== Account stats (cite these numbers when relevant) ===",
    formatStatsSection(ctx),
    "",
    "=== Top / recent posts (the creator's real voice) ===",
    formatPostsSection(ctx),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// buildSystemPrompt — YAML-backed. Reads agents.yaml + tasks.yaml from
// crewai-service/.../config/ so the Node fallback (direct-to-OpenAI path)
// uses the same prompt the CrewAI service uses. No more silent drift.
// ---------------------------------------------------------------------------

function buildSystemPrompt({ state, connectedPlatforms, language, marketContext }) {
  const config = loadPromptConfig();
  const ctx = buildCrewContext({
    state,
    connectedPlatforms,
    language,
    message: state._lastUserMessageForPrompt || "",
  });
  let accountContext = formatAccountContext(ctx);
  if (marketContext) {
    accountContext +=
      "\n\n=== Live market context (what's trending in this niche right now) ===\n" +
      marketContext;
  }
  const languageName = resolveLanguageName(language);

  if (!config) {
    // Ultimate safety net: YAML unreadable. Ship a minimal but still
    // on-persona prompt rather than the old hardcoded one.
    return [
      "You are PostPilot, the creator's personal content coach.",
      "Warm, direct, grounded in the creator's real data.",
      `Respond in ${languageName} unless the user clearly switches language.`,
      "",
      accountContext,
    ].join("\n");
  }

  const strategist = config.agents?.strategist || {};
  const role = collapseWhitespace(strategist.role);
  const goal = collapseWhitespace(strategist.goal);
  const backstory = collapseWhitespace(strategist.backstory);

  const task = config.tasks?.compose_response || {};
  let description = String(task.description || "");

  // In the OpenAI chat format the current message and prior turns are sent as
  // native chat messages, so we strip the YAML trailer that injects them
  // textually ("User message: {message}" / "Prior conversation:
  // {history_summary}"). The rest of the task description (rules, closing,
  // first-message behavior, ...) stays in the system prompt.
  const trailerIdx = description.search(/\n\s*User message:\s*/);
  if (trailerIdx !== -1) description = description.slice(0, trailerIdx);

  description = description
    .replaceAll("{language}", languageName)
    .replaceAll("{account_context}", "")
    .replaceAll("{message}", "")
    .replaceAll("{history_summary}", "");

  return [
    `You are ${role}.`,
    "",
    `Goal: ${goal}`,
    "",
    `Backstory: ${backstory}`,
    "",
    description.trim(),
    "",
    "=== Account data to ground every response ===",
    accountContext,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n");
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

function computeEngagementRate(p) {
  const impressions = Number(p.impressions || 0);
  if (impressions <= 0) return null;
  const interactions = Number(p.likes || 0) + Number(p.comments || 0) + Number(p.saved || 0) + Number(p.shares || 0);
  return Math.round((interactions / impressions) * 10000) / 100;
}

function isVideoLikePost(p) {
  const type = String(p?.mediaType || "").toUpperCase();
  return type === "VIDEO" || type === "REEL" || type === "REELS";
}

function inferAvgWatchTimeSeconds(p) {
  const avgWatch = Number(p?.avgWatchTime || 0);
  if (Number.isFinite(avgWatch) && avgWatch > 0) return avgWatch;
  const totalWatch = Number(p?.totalWatchTime || 0);
  const views = Number(p?.videoViews || p?.impressions || 0);
  if (Number.isFinite(totalWatch) && totalWatch > 0 && Number.isFinite(views) && views > 0) {
    return totalWatch / views;
  }
  return 0;
}

function computeSkipRateProxy(p, targetSeconds = SKIP_RATE_PROXY_TARGET_SECONDS) {
  if (!isVideoLikePost(p)) return null;
  const avgWatch = inferAvgWatchTimeSeconds(p);
  if (!Number.isFinite(avgWatch) || avgWatch <= 0) return null;
  const target = Math.max(0.1, Number(targetSeconds) || 3);
  const retentionRatio = Math.max(0, Math.min(1, avgWatch / target));
  const skipRate = (1 - retentionRatio) * 100;
  return Math.round(skipRate * 10) / 10;
}

function summarizeSkipRateTrend(posts, targetSeconds = SKIP_RATE_PROXY_TARGET_SECONDS) {
  const series = (Array.isArray(posts) ? posts : [])
    .map((p) => ({
      ts: p?.postedAt ? new Date(p.postedAt).getTime() : 0,
      skipRate: computeSkipRateProxy(p, targetSeconds),
    }))
    .filter((x) => x.ts > 0 && x.skipRate != null && Number.isFinite(x.skipRate))
    .sort((a, b) => a.ts - b.ts);

  if (!series.length) {
    return {
      avgSkipRateProxy: null,
      skipRateProxyTrend: [],
      skipRateProxyTrendDirection: "insufficient_data",
      reelsWithSkipRateProxy: 0,
    };
  }

  const average =
    Math.round((series.reduce((sum, x) => sum + x.skipRate, 0) / series.length) * 10) / 10;

  const windowCount = Math.min(3, series.length);
  const trend = [];
  let cursor = 0;
  const baseSize = Math.floor(series.length / windowCount);
  let remainder = series.length % windowCount;
  for (let i = 0; i < windowCount; i += 1) {
    const size = baseSize + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    const chunk = series.slice(cursor, cursor + size);
    cursor += size;
    const chunkAvg = chunk.reduce((sum, x) => sum + x.skipRate, 0) / Math.max(chunk.length, 1);
    trend.push(Math.round(chunkAvg * 10) / 10);
  }

  let direction = "flat";
  if (trend.length >= 2) {
    const delta = trend[trend.length - 1] - trend[0];
    if (delta >= 1) direction = "worsening";
    else if (delta <= -1) direction = "improving";
  } else {
    direction = "insufficient_data";
  }

  return {
    avgSkipRateProxy: average,
    skipRateProxyTrend: trend,
    skipRateProxyTrendDirection: direction,
    reelsWithSkipRateProxy: series.length,
  };
}

function extractFirstName(state) {
  const candidates = [
    state?.user?.name,
    state?.integrations?.instagram?.displayName,
    state?.integrations?.linkedin?.displayName,
    state?.integrations?.instagram?.username,
  ];
  for (const raw of candidates) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const first = text.split(/[\s._-]+/)[0];
    if (first && first.length >= 2) {
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
  }
  return "";
}

function computeAccountStats(allPosts) {
  const posts = Array.isArray(allPosts) ? allPosts : [];
  if (!posts.length) {
    return {
      totalPosts: 0,
      postsLast30Days: 0,
      postsLast90Days: 0,
      daysSinceLastPost: null,
      postsWithZeroComments: 0,
      postsWithZeroCommentsPct: 0,
      avgEngagementRate: null,
      avgSkipRateProxy: null,
      skipRateProxyTrend: [],
      skipRateProxyTrendDirection: "insufficient_data",
      reelsWithSkipRateProxy: 0,
      skipRateProxyTargetSeconds: SKIP_RATE_PROXY_TARGET_SECONDS,
      avgLikes: 0,
      avgComments: 0,
      topPostByEngagementRate: null,
      topPostByViews: null,
    };
  }
  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  let last = 0;
  let zeroComments = 0;
  let last30 = 0;
  let last90 = 0;
  const ers = [];
  let likesSum = 0;
  let commentsSum = 0;
  let topER = null;
  let topViews = null;
  for (const p of posts) {
    const t = p.postedAt ? new Date(p.postedAt).getTime() : 0;
    if (t > last) last = t;
    if (now - t <= 30 * day) last30 += 1;
    if (now - t <= 90 * day) last90 += 1;
    if ((Number(p.comments || 0)) === 0) zeroComments += 1;
    likesSum += Number(p.likes || 0);
    commentsSum += Number(p.comments || 0);
    const er = computeEngagementRate(p);
    if (er != null) {
      ers.push(er);
      if (!topER || er > topER.engagementRate) {
        topER = { ...p, engagementRate: er };
      }
    }
    const views = Number(p.impressions || p.videoViews || 0);
    if (views > 0 && (!topViews || views > Number(topViews.impressions || topViews.videoViews || 0))) {
      topViews = p;
    }
  }
  const avgER = ers.length ? Math.round((ers.reduce((a, b) => a + b, 0) / ers.length) * 100) / 100 : null;
  const daysSinceLast = last ? Math.round((now - last) / day) : null;
  const skipSummary = summarizeSkipRateTrend(posts, SKIP_RATE_PROXY_TARGET_SECONDS);
  return {
    totalPosts: posts.length,
    postsLast30Days: last30,
    postsLast90Days: last90,
    daysSinceLastPost: daysSinceLast,
    postsWithZeroComments: zeroComments,
    postsWithZeroCommentsPct: Math.round((zeroComments / posts.length) * 100),
    avgEngagementRate: avgER,
    avgSkipRateProxy: skipSummary.avgSkipRateProxy,
    skipRateProxyTrend: skipSummary.skipRateProxyTrend,
    skipRateProxyTrendDirection: skipSummary.skipRateProxyTrendDirection,
    reelsWithSkipRateProxy: skipSummary.reelsWithSkipRateProxy,
    skipRateProxyTargetSeconds: SKIP_RATE_PROXY_TARGET_SECONDS,
    avgLikes: Math.round(likesSum / posts.length),
    avgComments: Math.round(commentsSum / posts.length),
    topPostByEngagementRate: topER
      ? {
          type: formatMediaType(topER.mediaType || ""),
          postedAt: topER.postedAt || "",
          likes: Number(topER.likes || 0),
          comments: Number(topER.comments || 0),
          impressions: Number(topER.impressions || 0),
          engagementRate: topER.engagementRate,
          text: truncate(topER.text || "", 200),
        }
      : null,
    topPostByViews: topViews
      ? {
          type: formatMediaType(topViews.mediaType || ""),
          postedAt: topViews.postedAt || "",
          likes: Number(topViews.likes || 0),
          comments: Number(topViews.comments || 0),
          impressions: Number(topViews.impressions || topViews.videoViews || 0),
          text: truncate(topViews.text || "", 200),
        }
      : null,
  };
}

/**
 * Builds the data-only context sent to the CrewAI service.
 * CrewAI's YAML (agents.yaml + tasks.yaml) is the prompt source of truth;
 * this context provides the data the prompt references.
 */
function buildCrewContext({ state, connectedPlatforms, language, message }) {
  const effectiveNiche = resolveEffectiveNiche(state, message);
  const selected = selectPostsForMessage({
    posts: state.posts,
    message: state._lastUserMessageForPrompt || message || "",
    max: 20,
  });
  const posts = selected.map((p) => {
    const avgWatch = inferAvgWatchTimeSeconds(p);
    return {
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
      avgWatchTime: avgWatch > 0 ? Math.round(avgWatch * 10) / 10 : 0,
      totalWatchTime: Number(p.totalWatchTime || 0),
      skipRateProxy: computeSkipRateProxy(p, SKIP_RATE_PROXY_TARGET_SECONDS),
      engagementRate: computeEngagementRate(p),
      text: truncate(p.text || "", 500),
      permalink: p.permalink || "",
    };
  });
  return {
    account: {
      ...(state.user || {}),
      niche: effectiveNiche || (state.user && state.user.niche) || "",
    },
    firstName: extractFirstName(state),
    integrations: state.integrations || {},
    connectedPlatforms,
    voiceProfile: state.voiceProfile || {},
    posts,
    stats: computeAccountStats(state.posts),
    language: String(language || "").toLowerCase().slice(0, 2) || "en",
  };
}

async function callOpenAI({ message, history, state, connectedPlatforms, language, marketContext }) {
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
        { role: "system", content: buildSystemPrompt({ state, connectedPlatforms, language, marketContext }) },
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

async function callAnthropic({ message, history, state, connectedPlatforms, language, marketContext }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const model = resolveDirectModel();
  if (!apiKey) {
    aiLog("error", "Anthropic skipped: ANTHROPIC_API_KEY not set");
    throw new Error("anthropic_not_configured");
  }

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Anthropic vision routing", { useVision, count: postImages.length });
  const openaiStyleUserContent = buildVisionUserMessage(inputText, postImages);
  const userContent = Array.isArray(openaiStyleUserContent)
    ? convertVisionContentToAnthropic(openaiStyleUserContent)
    : [{ type: "text", text: openaiStyleUserContent }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.4,
      system: buildSystemPrompt({ state, connectedPlatforms, language, marketContext }),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = truncate(await res.text(), 400);
    aiLog("error", "Anthropic HTTP error", { status: res.status, bodyPreview: errBody });
    throw new Error(`anthropic_request_failed_${res.status}`);
  }
  const data = await res.json();
  const content = (data?.content || [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text)
    .join("");
  if (!content) throw new Error("anthropic_empty_response");
  return {
    content: truncate(content, DEFAULT_MAX_OUTPUT_CHARS),
    action: "ai_reply",
    provider: "anthropic",
  };
}

async function* streamAnthropic({ message, history, state, connectedPlatforms, language, marketContext }) {
  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const model = resolveDirectModel();
  if (!apiKey) throw new Error("anthropic_not_configured");

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  if (useVision) yield statusEvent("analyzing_posts");
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Anthropic vision routing for stream", { useVision, count: postImages.length });
  const openaiStyleUserContent = buildVisionUserMessage(inputText, postImages);
  const userContent = Array.isArray(openaiStyleUserContent)
    ? convertVisionContentToAnthropic(openaiStyleUserContent)
    : [{ type: "text", text: openaiStyleUserContent }];
  yield statusEvent("writing");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.4,
      stream: true,
      system: buildSystemPrompt({ state, connectedPlatforms, language, marketContext }),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = truncate(await res.text(), 400);
    aiLog("error", "Anthropic stream HTTP error", { status: res.status, bodyPreview: errBody });
    throw new Error(`anthropic_request_failed_${res.status}`);
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
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          const token = parsed.delta.text;
          if (token) yield tokenEvent(token);
        } else if (parsed.type === "message_stop") {
          return;
        }
      } catch (_e) { /* skip malformed SSE line */ }
    }
  }
}

async function callDirectLLM(params) {
  const marketContext = await resolveMarketContext({
    state: params.state,
    language: params.language,
    message: params.message,
  });
  if (marketContext) {
    aiLog("log", "Market context injected (direct call)", {
      length: marketContext.length,
    });
  }
  const enriched = { ...params, marketContext };
  const model = resolveDirectModel();
  if (isAnthropicModel(model)) return callAnthropic(enriched);
  return callOpenAI(enriched);
}

async function* streamDirectLLM(params) {
  // Emit a status event BEFORE the Tavily call when a search will actually
  // happen, so the client shows "Searching the internet…" while we wait.
  const niche = resolveEffectiveNiche(params.state, params.message);
  const willSearch = Boolean(
    process.env.TAVILY_API_KEY && shouldSearchMarket(params.message, niche),
  );
  if (willSearch) yield statusEvent("searching_market");

  const marketContext = await resolveMarketContext({
    state: params.state,
    language: params.language,
    message: params.message,
  });
  if (marketContext) {
    aiLog("log", "Market context injected (direct stream)", {
      length: marketContext.length,
    });
  }
  const enriched = { ...params, marketContext };
  const model = resolveDirectModel();
  if (isAnthropicModel(model)) {
    yield* streamAnthropic(enriched);
    return;
  }
  yield* streamOpenAI(enriched);
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
    return callDirectLLM({
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
      const directModel = resolveDirectModel();
      const directProvider = isAnthropicModel(directModel) ? "anthropic" : "openai";
      const hasDirectKey = directProvider === "anthropic"
        ? Boolean(process.env.ANTHROPIC_API_KEY)
        : Boolean(process.env.OPENAI_API_KEY);
      const reason = String(err?.message || err);
      console.error(
        `[PostPilot][AI] ⚠️ FALLBACK: CrewAI unreachable (${reason}). ` +
          `The /chat request is being served by the direct ${directProvider} path ` +
          `(model: ${directModel}) using the YAML-backed system prompt. ` +
          (hasDirectKey
            ? "Start the Python service (uvicorn ... --port 8000) to restore CrewAI orchestration."
            : `${directProvider.toUpperCase()}_API_KEY missing — request will fail.`),
      );
      if (!hasDirectKey) throw err;
      return callDirectLLM({
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

async function* streamOpenAI({ message, history, state, connectedPlatforms, language, marketContext }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!apiKey) throw new Error("openai_not_configured");

  const inputText = truncate(message, DEFAULT_MAX_INPUT_CHARS);
  state._lastUserMessageForPrompt = inputText;
  const useVision = shouldUseVisionForMessage(inputText);
  if (useVision) yield statusEvent("analyzing_posts");
  const postImages = useVision ? await collectPostImages(state.posts) : [];
  aiLog("log", "Vision routing for stream", { useVision, count: postImages.length });
  const userContent = buildVisionUserMessage(inputText, postImages);
  yield statusEvent("writing");
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
        { role: "system", content: buildSystemPrompt({ state, connectedPlatforms, language, marketContext }) },
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
        if (token) yield tokenEvent(token);
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
  if (useVision) yield statusEvent("analyzing_posts");
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
  let tokenCount = 0;
  let sawDone = false;
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
        if (parsed.done) { sawDone = true; break; }
        if (parsed.status) yield statusEvent(parsed.status);
        if (parsed.token) {
          tokenCount += 1;
          yield tokenEvent(parsed.token);
        }
      } catch (e) {
        if (e.message && !e.message.startsWith("Unexpected")) throw e;
      }
    }
    if (sawDone) break;
  }
  // CrewAI finished but gave us nothing — treat as a silent provider failure
  // so the caller can fall back to the direct LLM path instead of handing
  // the user an empty reply.
  if (tokenCount === 0) {
    aiLog("warn", "CrewAI stream returned zero tokens — triggering direct fallback");
    throw new Error("crewai_empty_response");
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
    yield* streamDirectLLM({ message, history: normalizedHistory, state, connectedPlatforms, language });
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
      const directModel = resolveDirectModel();
      const directProvider = isAnthropicModel(directModel) ? "anthropic" : "openai";
      const hasDirectKey = directProvider === "anthropic"
        ? Boolean(process.env.ANTHROPIC_API_KEY)
        : Boolean(process.env.OPENAI_API_KEY);
      const reason = String(err?.message || err);
      console.error(
        `[PostPilot][AI] ⚠️ FALLBACK: CrewAI stream unreachable (${reason}). ` +
          `The /chat/stream request is being served by the direct ${directProvider} path ` +
          `(model: ${directModel}) using the YAML-backed system prompt. ` +
          (hasDirectKey
            ? "Start the Python service (uvicorn ... --port 8000) to restore CrewAI orchestration."
            : `${directProvider.toUpperCase()}_API_KEY missing — stream will fail.`),
      );
      if (!hasDirectKey) throw err;
      yield* streamDirectLLM({ message, history: normalizedHistory, state, connectedPlatforms, language });
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
