const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Stripe = require("stripe");
require("dotenv").config();
const {
  ensureAppState,
  createUserWithPassword,
  findUserByEmail,
  findUserById,
  createOrLinkGoogleUser,
  updateUserProfile,
  getStateForUser,
  saveStateForUser,
  createSession,
  getSessionUser,
  revokeSession,
  createOAuthState,
  consumeOAuthState,
  closeDb,
} = require("./dbState");
const { generateAgentReply, streamAgentReply } = require("./aiClient");
const {
  normalizePlatform,
  buildAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  fetchPlatformProfile,
  fetchPlatformPostsAndAnalytics,
} = require("./socialIntegrations");

const PORT = process.env.PORT || 3000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "postpilot_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 14);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const STRIPE_MONTHLY_EUR_CENTS = Number(process.env.STRIPE_MONTHLY_EUR_CENTS || 2900);
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

// iOS Universal Links hijack server-side 302s to instagram.com / linkedin.com
// and open them in the native app, where the OAuth path (/oauth/authorize) is
// parsed as a username → "profile not found". Rendering an HTML shim that
// triggers the navigation from JS (script-initiated, no user gesture) keeps
// the flow inside the browser.
function sendJsRedirect(res, location) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>Redirecting…</title>
<style>
  body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #fff7f9; color: #1f0d12; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; text-align: center; }
  .card { max-width: 420px; }
  .spinner { width: 32px; height: 32px; border: 3px solid #f3d5d8; border-top-color: #d50032; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  button { background: #d50032; color: #fff; border: 0; border-radius: 999px; padding: 12px 20px; font-size: 15px; font-weight: 600; margin-top: 16px; cursor: pointer; }
  .hint { margin-top: 18px; padding: 12px 14px; background: #fff; border: 1px solid #f3d5d8; border-radius: 12px; font-size: 13px; line-height: 1.45; color: #7e5b63; text-align: left; }
  .hint strong { color: #1f0d12; display: block; margin-bottom: 4px; }
  .hint.hidden { display: none; }
</style>
</head>
<body>
<div class="card">
  <div class="spinner"></div>
  <p>Redirecting to login…</p>
  <button type="button" id="manual">Tap here if you aren't redirected</button>
  <div class="hint hidden" id="iosHint">
    <strong>On iPhone: stay in Safari, ignore the Instagram app.</strong>
    If the Instagram app opens with an error, just close it and come back to this browser tab — the login page opens here.
  </div>
</div>
<script>
  // Both the automatic navigation and the manual fallback are JS-initiated, not
  // <a href>-based. Script navigations are less likely to trigger iOS Universal
  // Links, but newer iOS versions can still open the native app in parallel.
  // Since the Safari tab navigates correctly either way, we just tell the user
  // to ignore the app popup.
  var target = ${JSON.stringify(location)};
  function go() {
    try { window.location.replace(target); }
    catch (e) { window.location.href = target; }
  }
  document.getElementById("manual").addEventListener("click", go);
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent || "")) {
    document.getElementById("iosHint").classList.remove("hidden");
  }
  setTimeout(go, 50);
</script>
</body>
</html>`;
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function buildVoiceProfile(posts) {
  const clean = posts.map((p) => (p.text || "").trim()).filter(Boolean);
  if (!clean.length) {
    return {
      tone: "direct",
      avgSentenceLength: 14,
      favoredOpeners: ["Quick lesson:"],
      ctaStyle: "single clear action",
      signatureWords: ["creator", "growth", "system"],
    };
  }

  const words = clean
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const freq = {};
  for (const w of words) {
    if (w.length < 4) continue;
    freq[w] = (freq[w] || 0) + 1;
  }

  const signatureWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);

  const sentences = clean
    .flatMap((p) => p.split(/[.!?]/))
    .map((s) => s.trim())
    .filter(Boolean);

  const avgSentenceLength = Math.round(
    sentences.reduce((acc, s) => acc + s.split(/\s+/).length, 0) /
      Math.max(sentences.length, 1)
  );

  const favoredOpeners = clean
    .map((p) => p.split(/\s+/).slice(0, 3).join(" "))
    .slice(0, 3);

  const ctaStyle = clean.some((p) =>
    /comment|dm|save|follow|share|reply/i.test(p)
  )
    ? "engagement prompt"
    : "thought-provoking close";

  return {
    tone: avgSentenceLength > 18 ? "story-driven" : "concise and punchy",
    avgSentenceLength,
    favoredOpeners,
    ctaStyle,
    signatureWords,
  };
}

function generateDraft({ topic, platform, goal, voiceProfile }) {
  const opener = voiceProfile?.favoredOpeners?.[0] || "Most creators miss this:";
  const words = voiceProfile?.signatureWords?.slice(0, 3).join(", ") || "growth, clarity, consistency";
  const cta =
    goal === "leads"
      ? "If you want the framework, comment 'guide' and I will send it."
      : goal === "authority"
      ? "What would you add from your experience?"
      : "Save this for your next content sprint.";

  const formatHint =
    platform === "instagram"
      ? "Use short lines and spacing for mobile readability."
      : "Keep this scannable with clear line breaks.";

  return `${opener}

${topic} is easier when you stop chasing hacks and start building repeatable systems.

3 practical moves:
1) Pick one audience pain and repeat it across formats.
2) Turn expertise into a weekly publishing rhythm.
3) Track what drives real conversation, not vanity metrics.

Your voice markers: ${words}.

${formatHint}
${cta}`;
}

function summarizeAnalytics(posts) {
  const byPlatform = posts.reduce((acc, post) => {
    if (!acc[post.platform]) {
      acc[post.platform] = { posts: 0, likes: 0, comments: 0, impressions: 0 };
    }
    acc[post.platform].posts += 1;
    acc[post.platform].likes += post.likes || 0;
    acc[post.platform].comments += post.comments || 0;
    acc[post.platform].impressions += post.impressions || 0;
    return acc;
  }, {});

  const totals = posts.reduce(
    (acc, p) => {
      acc.likes += p.likes || 0;
      acc.comments += p.comments || 0;
      acc.impressions += p.impressions || 0;
      return acc;
    },
    { likes: 0, comments: 0, impressions: 0 }
  );

  const topPost = [...posts].sort(
    (a, b) => (b.likes + b.comments) - (a.likes + a.comments)
  )[0];

  return {
    totals,
    byPlatform,
    topPost,
    recommendations: [
      "Post educational breakdowns twice weekly on LinkedIn.",
      "Use one direct CTA per post to increase conversion intent.",
      "Publish Instagram posts between 3pm and 6pm for stronger reach.",
    ],
  };
}

function buildCreatorProfile(state) {
  const posts = Array.isArray(state?.posts) ? state.posts : [];
  const integrations = state?.integrations || {};
  const user = state?.user || {};

  const igConnected = Boolean(integrations.instagram?.connected);
  const liConnected = Boolean(integrations.linkedin?.connected);
  const connectedPlatforms = [igConnected && "instagram", liConnected && "linkedin"].filter(Boolean);

  const primaryPlatform = igConnected ? "instagram" : liConnected ? "linkedin" : "";
  const primaryIntegration = primaryPlatform ? integrations[primaryPlatform] : {};
  const handle = String(primaryIntegration?.username || "").replace(/^@+/, "");
  const avatarUrl = String(primaryIntegration?.avatarUrl || "");
  const followerCount = Number(primaryIntegration?.followerCount || primaryIntegration?.followers || 0);

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentPosts = posts
    .map((p) => ({
      ...p,
      _ts: p.postedAt ? Date.parse(p.postedAt) : 0,
    }))
    .filter((p) => p._ts > 0)
    .sort((a, b) => b._ts - a._ts);

  const postsLast8Weeks = recentPosts.filter((p) => now - p._ts <= 8 * weekMs);
  const postsPerWeek = postsLast8Weeks.length / 8;

  const weeklyCounts = new Array(8).fill(0);
  for (const p of postsLast8Weeks) {
    const bucket = Math.min(7, Math.floor((now - p._ts) / weekMs));
    weeklyCounts[bucket] += 1;
  }
  const mean = weeklyCounts.reduce((s, v) => s + v, 0) / 8 || 0;
  const variance =
    weeklyCounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 8 || 0;
  const stddev = Math.sqrt(variance);
  const steadiness = mean > 0 ? Math.max(0, 1 - stddev / (mean + 0.0001)) : 0;

  const targetPerWeek = 4;
  const cadenceScore = Math.min(1, postsPerWeek / targetPerWeek);
  const consistency = Math.round(Math.min(100, (cadenceScore * 0.6 + steadiness * 0.4) * 100));

  const engagementRates = [];
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalSaves = 0;
  let totalReach = 0;
  let totalViews = 0;
  for (const p of recentPosts.slice(0, 40)) {
    const likes = Number(p.likes || 0);
    const comments = Number(p.comments || 0);
    const shares = Number(p.shares || 0);
    const saved = Number(p.saved || 0);
    const reach = Number(p.reach || 0);
    const impressions = Number(p.impressions || 0) || Number(p.videoViews || 0);
    totalLikes += likes;
    totalComments += comments;
    totalShares += shares;
    totalSaves += saved;
    totalReach += reach;
    totalViews += impressions;
    const denom = reach || impressions;
    if (denom > 0) {
      engagementRates.push((likes + comments + shares + saved) / denom);
    }
  }
  const avgEngagementRate = engagementRates.length
    ? engagementRates.reduce((s, v) => s + v, 0) / engagementRates.length
    : 0;

  const engagementComponent = Math.min(1, avgEngagementRate / 0.06);
  const reachComponent = totalViews > 0 ? Math.min(1, Math.log10(totalViews + 1) / 5) : 0;
  const growth = Math.round(
    Math.min(100, (engagementComponent * 0.7 + reachComponent * 0.3) * 100)
  );

  const momentum = Math.round(consistency * 0.4 + growth * 0.6);

  const byType = { image: [], video: [], carousel: [] };
  for (const p of recentPosts) {
    const type = String(p.mediaType || "").toUpperCase();
    if (type === "CAROUSEL_ALBUM" || type === "CAROUSEL") byType.carousel.push(p);
    else if (type === "VIDEO" || type === "REEL" || type === "REELS") byType.video.push(p);
    else byType.image.push(p);
  }

  const avgViewsByType = {};
  for (const [key, arr] of Object.entries(byType)) {
    if (!arr.length) continue;
    const views = arr.reduce((s, p) => s + (Number(p.impressions || 0) || Number(p.videoViews || 0)), 0);
    avgViewsByType[key] = Math.round(views / arr.length);
  }

  const captionsWithLen = recentPosts
    .filter((p) => typeof p.text === "string" && p.text.trim().length > 0)
    .map((p) => p.text.trim().length);
  const avgCaptionLen = captionsWithLen.length
    ? Math.round(captionsWithLen.reduce((s, v) => s + v, 0) / captionsWithLen.length)
    : 0;

  const shareRate = totalReach > 0 ? totalShares / totalReach : 0;
  const saveRate = totalReach > 0 ? totalSaves / totalReach : 0;
  const commentRate = totalReach > 0 ? totalComments / totalReach : 0;

  const superpower = [];
  const unlock = [];

  if (byType.carousel.length >= 2 && avgViewsByType.carousel && avgViewsByType.carousel > (avgViewsByType.image || 0)) {
    superpower.push({
      icon: "carousel",
      title: "Carousel mastery",
      body: `Your multi-image posts average ${avgViewsByType.carousel.toLocaleString()} views — lean into this format.`,
    });
  }
  if (shareRate > 0.01) {
    superpower.push({
      icon: "share",
      title: "Strong share rate",
      body: "People actively share your content — that is organic growth gold.",
    });
  }
  if (avgEngagementRate > 0.04) {
    superpower.push({
      icon: "engagement",
      title: "High engagement rate",
      body: `You are averaging ${(avgEngagementRate * 100).toFixed(1)}% engagement — well above the ~2% creator median.`,
    });
  }
  if (followerCount > 0 && totalViews / Math.max(1, followerCount) > 5) {
    superpower.push({
      icon: "reach",
      title: "Massive reach for your size",
      body: `Your recent posts pulled ${totalViews.toLocaleString()} views — that's huge for ${followerCount.toLocaleString()} followers.`,
    });
  }
  if (byType.video.length >= 2 && avgViewsByType.video && avgViewsByType.video > (avgViewsByType.image || 0) * 1.3) {
    superpower.push({
      icon: "video",
      title: "Video-first storytelling",
      body: "Your videos travel further than static posts — that's a real edge.",
    });
  }
  if (!superpower.length && recentPosts.length > 0) {
    superpower.push({
      icon: "consistency",
      title: "You're showing up",
      body: `You've published ${recentPosts.length} posts — consistency is the foundation everything else builds on.`,
    });
  }

  if (commentRate < 0.002 && totalReach > 0) {
    unlock.push({
      icon: "comments",
      title: "Your comments are low",
      body: "Let's craft captions that spark conversation — more comments means better reach.",
    });
  }
  if (postsPerWeek < 2) {
    unlock.push({
      icon: "cadence",
      title: "Posting is inconsistent",
      body: `Only ~${postsPerWeek.toFixed(1)} posts/week — we're leaving growth on the table, let's build a rhythm.`,
    });
  }
  if (avgCaptionLen > 0 && avgCaptionLen < 60) {
    unlock.push({
      icon: "caption",
      title: "Captions are minimal",
      body: "Let's add storytelling that connects — longer, specific captions convert viewers into fans.",
    });
  }
  if (byType.video.length && avgViewsByType.video && avgViewsByType.image && avgViewsByType.video < avgViewsByType.image * 0.7) {
    unlock.push({
      icon: "hooks",
      title: "Reels are underperforming",
      body: "I'll help you nail hooks that stop the scroll — this is your biggest unlock.",
    });
  }
  if (saveRate < 0.005 && totalReach > 0) {
    unlock.push({
      icon: "saves",
      title: "Saves are low",
      body: "Content people save = content they want to revisit. Let's add practical value hooks.",
    });
  }
  if (!unlock.length) {
    unlock.push({
      icon: "scale",
      title: "Time to scale",
      body: "Your foundation is solid — let's double down on what's working and amplify reach.",
    });
  }

  return {
    user: {
      name: user.name || "",
      firstName: (user.name || "").split(" ")[0] || "",
      niche: user.niche || "",
      objective: user.objective || "",
    },
    primary: {
      platform: primaryPlatform,
      handle,
      avatarUrl,
      followerCount,
    },
    connectedPlatforms,
    hasAnyConnection: connectedPlatforms.length > 0,
    hasPosts: recentPosts.length > 0,
    postsCount: recentPosts.length,
    scores: {
      momentum,
      consistency,
      growth,
    },
    metrics: {
      postsPerWeek: Number(postsPerWeek.toFixed(1)),
      avgEngagementRate: Number((avgEngagementRate * 100).toFixed(2)),
      totalLikes,
      totalComments,
      totalViews,
      totalReach,
      shareRate: Number((shareRate * 100).toFixed(2)),
      saveRate: Number((saveRate * 100).toFixed(2)),
      avgCaptionLen,
      avgViewsByType,
    },
    superpower: superpower.slice(0, 4),
    unlock: unlock.slice(0, 4),
  };
}

function generateWeeklyPlan({ goal, postsPerWeek, focus }) {
  const count = Number(postsPerWeek) || 4;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const formats = ["Story post", "How-to post", "Contrarian take", "Case study", "Carousel"];
  const plan = [];

  for (let i = 0; i < count; i += 1) {
    plan.push({
      day: days[i % days.length],
      format: formats[i % formats.length],
      prompt: `Create a ${formats[i % formats.length].toLowerCase()} about ${focus || "creator growth"} tied to ${goal || "audience growth"}.`,
      reminder: `Draft by ${days[i % days.length]} 10:00 AM, publish by 1:00 PM.`,
    });
  }

  return plan;
}

function repurpose({ sourceText, target }) {
  const base = (sourceText || "").trim();
  if (!base) return "";
  if (target === "newsletter") {
    return `Subject: A quick content system that compounds\n\n${base}\n\nAction step: apply this to one post this week and measure replies.`;
  }
  if (target === "video") {
    return `Video script hook: "Most creators are one system away from consistent growth."\n\nMain points:\n- ${base}\n- Add one example from your recent post performance\n- End with a single CTA`;
  }
  return `${base}\n\nRepurposed version:\n- Stronger hook\n- Shorter body\n- One CTA for engagement`;
}

function serveStatic(req, res, pathname) {
  const publicDir = path.join(__dirname, "public");
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(publicDir, cleanPath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const map = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
    };
    res.writeHead(200, { "Content-Type": map[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function getConversation(state, sessionId) {
  if (!state.conversations[sessionId]) {
    state.conversations[sessionId] = [];
  }
  return state.conversations[sessionId];
}

function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const out = {};
  for (const piece of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = piece.trim().split("=");
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rawValue.join("=") || "");
  }
  return out;
}

function isSecureRequest(req) {
  if (req.headers["x-forwarded-proto"]) {
    return String(req.headers["x-forwarded-proto"]).split(",")[0].trim() === "https";
  }
  return req.socket?.encrypted === true;
}

function setSessionCookie(req, res, token, expiresAt) {
  const secure = isSecureRequest(req);
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (secure) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

function clearSessionCookie(req, res) {
  const secure = isSecureRequest(req);
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (secure) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

async function getAuthedUser(req) {
  const cookies = parseCookies(req);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) return null;
  const user = await getSessionUser(sessionToken);
  return user || null;
}

async function requireAuth(req, res) {
  const user = await getAuthedUser(req);
  if (!user) {
    sendJson(res, 401, { error: "Authentication required" });
    return null;
  }
  return user;
}

function authRedirectUrl(source, authError, authDetail) {
  const q = new URLSearchParams({
    source: source === "signin" ? "signin" : "signup",
    authError: authError || "unknown_oauth_error",
  });
  if (authDetail) q.set("authDetail", authDetail);
  return `/?${q.toString()}`;
}

function integrationRedirectUrl(platform, ok, error, detail) {
  const q = new URLSearchParams({ integration: platform || "unknown" });
  if (ok) q.set("integrationAuth", "success");
  if (error) q.set("integrationError", error);
  if (detail) q.set("integrationDetail", detail);
  return `/?${q.toString()}`;
}

function requestOrigin(req) {
  const configured =
    (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const proto = isSecureRequest(req) ? "https" : "http";
  return `${proto}://${req.headers.host}`;
}

async function resolveUserIdFromStripeEventObject(obj) {
  const fromMeta = Number(obj?.metadata?.userId || 0);
  if (fromMeta) return fromMeta;
  const subscriptionId =
    typeof obj?.subscription === "string" ? obj.subscription : obj?.id?.startsWith("sub_") ? obj.id : "";
  if (!subscriptionId || !stripe) return 0;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return Number(sub?.metadata?.userId || 0);
  } catch (_error) {
    return 0;
  }
}

function onboardingMissingFields(_state) {
  // Niche and objective are no longer required. Onboarding is considered
  // complete as soon as the user account exists; the UI gates on integration
  // connection and payment next.
  return [];
}

function isPaymentComplete(state) {
  return state.user?.billing?.status === "paid";
}

function markBillingPaid(state, payload = {}) {
  state.user.billing.status = "paid";
  state.user.billing.plan = "monthly";
  state.user.billing.amountEur = 30;
  state.user.billing.currency = "EUR";
  state.user.billing.interval = "month";
  state.user.billing.paidAt = nowIso();
  if (payload.customerId) state.user.billing.stripeCustomerId = payload.customerId;
  if (payload.subscriptionId) state.user.billing.stripeSubscriptionId = payload.subscriptionId;
  if (payload.checkoutSessionId) state.user.billing.stripeCheckoutSessionId = payload.checkoutSessionId;
}

function markBillingUnpaid(state, payload = {}) {
  state.user.billing.status = "unpaid";
  if (payload.reason) state.user.billing.lastFailureReason = payload.reason;
  if (payload.customerId) state.user.billing.stripeCustomerId = payload.customerId;
  if (payload.subscriptionId) state.user.billing.stripeSubscriptionId = payload.subscriptionId;
}

function updateOnboardingCompletion(state) {
  state.user.onboardingCompleted = onboardingMissingFields(state).length === 0;
}

function accountSummary(state) {
  return {
    user: state.user,
    integrations: state.integrations,
    onboarding: {
      completed: state.user.onboardingCompleted,
      missing: onboardingMissingFields(state),
    },
    payment: {
      required: true,
      completed: isPaymentComplete(state),
      details: state.user.billing,
    },
  };
}

function bindStateToUser(state, user) {
  state.user.createdAt = state.user.createdAt || user.createdAt.toISOString();
  state.user.name = user.fullName || state.user.name || "";
  state.user.email = user.email || state.user.email || "";
  if (!state.syncJobs || !Array.isArray(state.syncJobs)) state.syncJobs = [];
  if (!state.integrations?.linkedin) state.integrations.linkedin = { connected: false, username: null, token: null, lastSyncAt: null };
  if (!state.integrations?.instagram) state.integrations.instagram = { connected: false, username: null, token: null, lastSyncAt: null };
  if (typeof state.integrations.linkedin.avatarUrl === "undefined") state.integrations.linkedin.avatarUrl = null;
  if (typeof state.integrations.instagram.avatarUrl === "undefined") state.integrations.instagram.avatarUrl = null;
  return state;
}

function upsertPosts(state, newPosts) {
  const seen = new Set(state.posts.map((p) => `${p.platform}:${p.postedAt}:${p.text}`));
  for (const post of newPosts) {
    const key = `${post.platform}:${post.postedAt}:${post.text}`;
    if (!seen.has(key)) {
      state.posts.push(post);
      seen.add(key);
    }
  }
  state.posts.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
}

async function syncPlatform(state, platform) {
  const integration = state.integrations[platform];
  if (!integration || !integration.connected || !integration.token) {
    throw new Error(`${platform} is not connected`);
  }
  const profile = await fetchPlatformProfile({ platform, accessToken: integration.token });
  const fetched = await fetchPlatformPostsAndAnalytics({
    platform,
    accessToken: integration.token,
    profile,
  });
  upsertPosts(state, fetched);
  integration.username = profile.username || integration.username || null;
  integration.avatarUrl = profile.avatarUrl || integration.avatarUrl || null;
  if (profile.bio !== undefined) integration.bio = profile.bio || "";
  if (profile.name !== undefined) integration.displayName = profile.name || "";
  if (profile.followersCount !== undefined) integration.followersCount = profile.followersCount;
  if (profile.followsCount !== undefined) integration.followsCount = profile.followsCount;
  if (profile.mediaCount !== undefined) integration.mediaCount = profile.mediaCount;
  if (profile.website !== undefined) integration.website = profile.website || "";
  if (profile.accountType !== undefined) integration.accountType = profile.accountType || "";
  integration.lastSyncAt = nowIso();
  state.voiceProfile = buildVoiceProfile(state.posts);
  return fetched.length;
}

function createSyncJob(state, platform) {
  if (!Array.isArray(state.syncJobs)) state.syncJobs = [];
  const job = {
    id: crypto.randomBytes(8).toString("hex"),
    platform,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    recordsSynced: 0,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.syncJobs.unshift(job);
  state.syncJobs = state.syncJobs.slice(0, 100);
  return job;
}

async function runSyncJob(state, platform) {
  const job = createSyncJob(state, platform);
  const integration = state.integrations[platform];
  if (!integration.sync) integration.sync = {};
  integration.sync.status = "queued";
  integration.sync.lastJobId = job.id;
  integration.sync.lastError = null;
  integration.sync.lastAttemptAt = nowIso();

  while (job.attempts < job.maxAttempts) {
    try {
      job.status = "running";
      job.updatedAt = nowIso();
      job.attempts += 1;
      integration.sync.status = "running";
      integration.sync.lastAttemptAt = nowIso();
      const count = await syncPlatform(state, platform);
      job.status = "success";
      job.recordsSynced = count;
      job.updatedAt = nowIso();
      integration.sync.status = "success";
      integration.sync.lastError = null;
      integration.sync.retryCount = job.attempts - 1;
      return job;
    } catch (error) {
      job.error = error.message;
      job.updatedAt = nowIso();
      integration.sync.lastError = error.message;
      integration.sync.retryCount = job.attempts;
      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        integration.sync.status = "failed";
        return job;
      }
    }
  }
  return job;
}

function activePlatforms(state) {
  return Object.entries(state.integrations)
    .filter(([, value]) => value.connected)
    .map(([key]) => key);
}

function parseIntent(message) {
  const text = (message || "").toLowerCase();
  if (/plan|calendar|week|schedule/.test(text)) return "plan";
  if (/repurpose|newsletter|thread|carousel|video/.test(text)) return "repurpose";
  if (/analytics|performance|insight|metric|stats/.test(text)) return "analytics";
  if (/generate|draft|write|post|caption|hook/.test(text)) return "draft";
  if (/connect|integration|sync|refresh|import/.test(text)) return "sync";
  return "coach";
}

function extractPlatform(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("instagram")) return "instagram";
  if (text.includes("linkedin")) return "linkedin";
  return "linkedin";
}

function extractGoal(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("lead")) return "leads";
  if (text.includes("authority")) return "authority";
  return "engagement";
}

function extractTopic(message) {
  const text = (message || "").trim();
  if (!text) return "content strategy";
  const cleaned = text.replace(/write|generate|post|caption|about/gi, "").trim();
  return cleaned || "content strategy";
}

async function ensureValidToken(state, platform) {
  const integration = state.integrations[platform];
  if (!integration?.connected || !integration?.token) return false;

  const expiresAt = integration.tokenExpiresAt ? new Date(integration.tokenExpiresAt) : null;
  const isExpired = expiresAt && expiresAt.getTime() < Date.now();
  const expiresSoon = expiresAt && expiresAt.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;

  if (platform === "instagram" && (isExpired || expiresSoon || !expiresAt)) {
    try {
      const refreshed = await refreshLongLivedToken(integration.token);
      if (refreshed) {
        integration.token = refreshed.accessToken;
        integration.expiresIn = refreshed.expiresIn;
        integration.tokenExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
        return true;
      }
      if (isExpired) {
        console.error(`[PostPilot] ${platform} token expired and refresh failed — user must reconnect`);
        integration.connected = false;
        integration.token = null;
        return true;
      }
    } catch (err) {
      console.error(`[PostPilot] Token refresh error for ${platform}:`, err?.message);
      if (isExpired) {
        integration.connected = false;
        integration.token = null;
        return true;
      }
    }
  }
  return false;
}

// How long profile/posts are considered fresh before a background re-sync.
// Tune these if you need more aggressive freshness.
const PROFILE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const POSTS_TTL_MS = 20 * 60 * 1000; // 20 minutes

async function ensureProfileData(state) {
  let changed = false;
  const now = Date.now();
  for (const [platform, integration] of Object.entries(state.integrations || {})) {
    if (!integration?.connected || !integration?.token) continue;

    const tokenChanged = await ensureValidToken(state, platform);
    if (tokenChanged) changed = true;
    if (!integration.connected || !integration.token) continue;

    const lastSync = integration.lastSyncAt
      ? new Date(integration.lastSyncAt).getTime()
      : 0;
    const ageMs = lastSync ? now - lastSync : Infinity;
    const profileStale = ageMs > PROFILE_TTL_MS;
    const postsStale = ageMs > POSTS_TTL_MS;

    const hasBio = integration.bio !== undefined && integration.bio !== null;
    const needsProfile = !hasBio || profileStale;

    const platformPosts = (state.posts || []).filter((p) => p.platform === platform);
    const needsMediaUrls =
      platformPosts.length > 0 && !platformPosts.some((p) => p.imageUrl || p.mediaUrl);
    // If the (possibly just-refreshed) mediaCount says the user has more posts
    // than we've cached, we're out of date regardless of TTL.
    const knownTotal = Number(integration.mediaCount || 0);
    const needsMorePosts = knownTotal > platformPosts.length;
    const needsPosts = !platformPosts.length || postsStale;

    if (!needsProfile && !needsPosts && !needsMediaUrls && !needsMorePosts) continue;

    try {
      if (needsProfile) {
        const profile = await fetchPlatformProfile({ platform, accessToken: integration.token });
        integration.username = profile.username || integration.username || null;
        integration.avatarUrl = profile.avatarUrl || integration.avatarUrl || null;
        if (profile.bio !== undefined) integration.bio = profile.bio || "";
        if (profile.name !== undefined) integration.displayName = profile.name || "";
        if (profile.followersCount !== undefined) integration.followersCount = profile.followersCount;
        if (profile.followsCount !== undefined) integration.followsCount = profile.followsCount;
        if (profile.mediaCount !== undefined) integration.mediaCount = profile.mediaCount;
        if (profile.website !== undefined) integration.website = profile.website || "";
        if (profile.accountType !== undefined) integration.accountType = profile.accountType || "";
        changed = true;
        const reason = !hasBio ? "missing" : `stale ${Math.round(ageMs / 60000)}m`;
        console.log(
          `[PostPilot] Refreshed profile for ${platform}/@${integration.username} (${reason})`,
        );
      }

      // Re-read mediaCount after the profile refresh — Instagram may report a
      // new post count that invalidates our cached posts.
      const freshTotal = Number(integration.mediaCount || 0);
      const currentCount = (state.posts || []).filter((p) => p.platform === platform).length;
      const stillNeedsMore = freshTotal > currentCount;

      if (needsPosts || needsMediaUrls || stillNeedsMore) {
        if (needsMediaUrls || stillNeedsMore) {
          const reason = stillNeedsMore
            ? `incomplete (${currentCount}/${freshTotal})`
            : "missing media URLs";
          state.posts = state.posts.filter((p) => p.platform !== platform);
          console.log(`[PostPilot] Clearing old ${platform} posts — ${reason}`);
        }
        const profile = { username: integration.username, urn: integration.urn };
        const posts = await fetchPlatformPostsAndAnalytics({
          platform,
          accessToken: integration.token,
          profile,
        });
        upsertPosts(state, posts);
        state.voiceProfile = buildVoiceProfile(state.posts);
        integration.lastSyncAt = nowIso();
        changed = true;
        console.log(
          `[PostPilot] Synced ${posts.length} posts for ${platform}/@${integration.username} ` +
            `(media URLs: ${posts.filter((p) => p.imageUrl).length})`,
        );
      }
    } catch (err) {
      console.error(`[PostPilot] Data refresh failed for ${platform}:`, err?.message);
    }
  }
  return changed;
}

function latestPostText(state) {
  return state.posts[0] ? state.posts[0].text : "";
}

function agentGuardReply(state) {
  if (!state.user.createdAt) {
    return { content: "Create your account first to start using the content agent.", action: "account_required" };
  }
  if (!state.user.onboardingCompleted) {
    return { content: "Complete onboarding in Settings so I can personalize your strategy and voice.", action: "onboarding_required" };
  }
  if (!isPaymentComplete(state)) {
    return { content: "Payment is required before using the AI coach. Please complete your 29 Euro/month subscription.", action: "payment_required" };
  }
  const connected = activePlatforms(state);
  if (!connected.length) {
    return { content: "Connect LinkedIn or Instagram first. I need account data to learn your voice and analyze performance.", action: "connect_required" };
  }
  return null;
}

async function agentRespond(state, { message, userId, sessionId, language }) {
  const guard = agentGuardReply(state);
  if (guard) {
    return { role: "assistant", ...guard };
  }

  const backfilled = await ensureProfileData(state);
  if (backfilled) await saveStateForUser(userId, state);
  const voiceProfile = state.voiceProfile || buildVoiceProfile(state.posts);
  state.voiceProfile = voiceProfile;
  const history = getConversation(state, sessionId);

  try {
    const response = await generateAgentReply({
      message,
      history,
      state,
      userId,
      sessionId,
      language,
    });
    return {
      role: "assistant",
      content: response.content,
      action: response.action || "ai_reply",
      payload: { provider: response.provider || "unknown" },
    };
  } catch (error) {
    console.error("[PostPilot][AI] agentRespond provider failure", {
      reason: String(error?.message || error),
      name: error?.name,
    });
    return {
      role: "assistant",
      content:
        "I could not reach the AI provider right now. Please verify AI_PROVIDER and provider credentials in .env, then try again.",
      action: "provider_error",
      payload: { reason: error.message },
    };
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = parsed;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, app: "PostPilot Agent" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/auth/session") {
    try {
      const user = await getAuthedUser(req);
      if (!user) {
        sendJson(res, 200, { authenticated: false });
        return;
      }
      sendJson(res, 200, {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      sendJson(res, 500, { error: `session_check_failed: ${err.message}` });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/signup") {
    try {
      const body = await readBody(req);
      const fullName = String(body.fullName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!fullName || !email || !password) {
        sendJson(res, 400, { error: "Full name, email, and password are required" });
        return;
      }
      if (password.length < 8) {
        sendJson(res, 400, { error: "Password must be at least 8 characters" });
        return;
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        sendJson(res, 409, { error: "Account already exists. Please sign in." });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createUserWithPassword({ fullName, email, passwordHash });
      const session = await createSession(user.id, SESSION_TTL_DAYS);
      setSessionCookie(req, res, session.token, session.expiresAt);
      sendJson(res, 201, {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
        },
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/signin") {
    try {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) {
        sendJson(res, 400, { error: "Email and password are required" });
        return;
      }

      const user = await findUserByEmail(email);
      if (!user) {
        sendJson(res, 401, { error: "Invalid email or password" });
        return;
      }
      if (!user.passwordHash) {
        sendJson(res, 401, { error: "This account uses Google sign-in. Continue with Google." });
        return;
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        sendJson(res, 401, { error: "Invalid email or password" });
        return;
      }

      const session = await createSession(user.id, SESSION_TTL_DAYS);
      setSessionCookie(req, res, session.token, session.expiresAt);
      sendJson(res, 200, {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
        },
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/signout") {
    try {
      const sessionToken = parseCookies(req)[SESSION_COOKIE_NAME];
      await revokeSession(sessionToken);
      clearSessionCookie(req, res);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/auth/google") {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      sendRedirect(res, authRedirectUrl("signup", "google_oauth_not_configured", "missing_client_config"));
      return;
    }

    const source = parsed.searchParams.get("source") === "signin" ? "signin" : "signup";
    const redirectTo = "/";
    const stateParam = await createOAuthState({ source, redirectTo });
    const proto = isSecureRequest(req) ? "https" : "http";
    const redirectUri = `${proto}://${req.headers.host}/auth/google/callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", stateParam);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "select_account");
    sendRedirect(res, authUrl.toString());
    return;
  }

  if (req.method === "GET" && pathname === "/auth/google/callback") {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      sendRedirect(res, authRedirectUrl("signup", "google_oauth_not_configured", "missing_client_config"));
      return;
    }

    const code = parsed.searchParams.get("code");
    const oauthError = parsed.searchParams.get("error");
    const consumed = await consumeOAuthState(parsed.searchParams.get("state"));
    const source = consumed.ok && consumed.value.source === "signin" ? "signin" : "signup";
    if (!consumed.ok) {
      sendRedirect(res, authRedirectUrl(source, "invalid_oauth_state", consumed.reason));
      return;
    }

    if (oauthError) {
      sendRedirect(res, authRedirectUrl(source, "oauth_provider_error", oauthError));
      return;
    }

    if (!code) {
      sendRedirect(res, authRedirectUrl(source, "missing_code", "oauth_code_missing"));
      return;
    }

    try {
      const proto = isSecureRequest(req) ? "https" : "http";
      const redirectUri = `${proto}://${req.headers.host}/auth/google/callback`;
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        sendRedirect(res, authRedirectUrl(source, "token_exchange_failed", `status_${tokenResponse.status}`));
        return;
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) {
        sendRedirect(res, authRedirectUrl(source, "missing_access_token", "token_response_missing_access_token"));
        return;
      }

      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileResponse.ok) {
        sendRedirect(res, authRedirectUrl(source, "profile_fetch_failed", `status_${profileResponse.status}`));
        return;
      }

      const profile = await profileResponse.json();
      const googleSub = String(profile.sub || "").trim();
      const email = String(profile.email || "").trim().toLowerCase();
      const fullName = String(profile.name || "").trim() || email.split("@")[0] || "Creator";

      if (!googleSub || !email) {
        sendRedirect(res, authRedirectUrl(source, "google_profile_missing_fields", "missing_sub_or_email"));
        return;
      }

      const user = await createOrLinkGoogleUser({ googleSub, email, fullName });
      const state = bindStateToUser(await getStateForUser(user.id), user);
      updateOnboardingCompletion(state);
      await saveStateForUser(user.id, state);
      const session = await createSession(user.id, SESSION_TTL_DAYS);
      setSessionCookie(req, res, session.token, session.expiresAt);
      sendRedirect(res, `/?googleAuth=success&source=${source}`);
    } catch (err) {
      console.error("Google callback failed", err);
      sendRedirect(res, authRedirectUrl(source, "google_callback_failed", "unexpected_server_error"));
    }
    return;
  }

  if (req.method === "GET" && (pathname === "/auth/linkedin" || pathname === "/auth/instagram")) {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const platform = pathname.endsWith("linkedin") ? "linkedin" : "instagram";
      const stateToken = await createOAuthState({
        source: `social:${platform}:${user.id}`,
        redirectTo: "/",
      });
      const redirectUri = `${requestOrigin(req)}/auth/${platform}/callback`;
      const authUrl = buildAuthUrl({ platform, redirectUri, state: stateToken });
      // iOS Safari aggressively triggers Universal Links on server-side 302s
      // to instagram.com, which opens the native app with a spurious
      // "profile not found" error. The JS shim mitigates this by navigating
      // from a script context. On every other browser a plain 302 gives a
      // cleaner UX without the intermediate "Redirecting…" page.
      const ua = String(req.headers["user-agent"] || "");
      const isIos = /iPhone|iPad|iPod/i.test(ua);
      if (isIos) sendJsRedirect(res, authUrl);
      else sendRedirect(res, authUrl);
    } catch (err) {
      const platform = pathname.endsWith("linkedin") ? "linkedin" : "instagram";
      sendRedirect(res, integrationRedirectUrl(platform, false, "oauth_start_failed", err.message));
    }
    return;
  }

  if (req.method === "GET" && (pathname === "/auth/linkedin/callback" || pathname === "/auth/instagram/callback")) {
    const platform = pathname.includes("/linkedin/") ? "linkedin" : "instagram";
    const oauthError = parsed.searchParams.get("error");
    if (oauthError) {
      sendRedirect(res, integrationRedirectUrl(platform, false, "oauth_provider_error", oauthError));
      return;
    }
    const consumed = await consumeOAuthState(parsed.searchParams.get("state"));
    if (!consumed.ok) {
      sendRedirect(res, integrationRedirectUrl(platform, false, "oauth_state_invalid", consumed.reason));
      return;
    }
    const code = parsed.searchParams.get("code");
    if (!code) {
      sendRedirect(res, integrationRedirectUrl(platform, false, "oauth_code_missing", "missing_code"));
      return;
    }
    try {
      let user = await getAuthedUser(req);
      if (!user) {
        const sourceUserId = Number(String(consumed.value.source || "").split(":")[2] || 0);
        if (sourceUserId) user = await findUserById(sourceUserId);
      }
      if (!user) {
        sendRedirect(res, integrationRedirectUrl(platform, false, "oauth_user_missing", "session_or_state_missing_user"));
        return;
      }

      const redirectUri = `${requestOrigin(req)}/auth/${platform}/callback`;
      const token = await exchangeCodeForToken({ platform, code, redirectUri });

      let finalAccessToken = token.accessToken;
      let finalExpiresIn = token.expiresIn;
      if (platform === "instagram") {
        const longLived = await exchangeForLongLivedToken(token.accessToken);
        if (longLived) {
          finalAccessToken = longLived.accessToken;
          finalExpiresIn = longLived.expiresIn;
        }
      }

      const profile = await fetchPlatformProfile({
        platform,
        accessToken: finalAccessToken,
      });
      const state = bindStateToUser(await getStateForUser(user.id), user);

      const lockedId = state.integrations[platform]?.lockedAccountId || null;
      const lockedUsername = state.integrations[platform]?.lockedUsername || null;
      const incomingId = String(profile.id || "").trim();
      if (lockedId && incomingId && String(lockedId) !== incomingId) {
        sendRedirect(
          res,
          integrationRedirectUrl(
            platform,
            false,
            "account_mismatch",
            lockedUsername || String(lockedId),
          ),
        );
        return;
      }

      state.integrations[platform].connected = true;
      if (!state.integrations[platform].lockedAccountId && incomingId) {
        state.integrations[platform].lockedAccountId = incomingId;
        state.integrations[platform].lockedUsername = profile.username || null;
      }
      state.integrations[platform].token = finalAccessToken;
      state.integrations[platform].refreshToken = token.refreshToken || null;
      state.integrations[platform].expiresIn = finalExpiresIn || null;
      state.integrations[platform].tokenExpiresAt = finalExpiresIn
        ? new Date(Date.now() + finalExpiresIn * 1000).toISOString()
        : null;
      state.integrations[platform].connectedAt = nowIso();
      state.integrations[platform].username = profile.username || state.integrations[platform].username || null;
      state.integrations[platform].avatarUrl = profile.avatarUrl || state.integrations[platform].avatarUrl || null;
      if (profile.bio !== undefined) state.integrations[platform].bio = profile.bio || "";
      if (profile.name !== undefined) state.integrations[platform].displayName = profile.name || "";
      if (profile.followersCount !== undefined) state.integrations[platform].followersCount = profile.followersCount;
      if (profile.followsCount !== undefined) state.integrations[platform].followsCount = profile.followsCount;
      if (profile.mediaCount !== undefined) state.integrations[platform].mediaCount = profile.mediaCount;
      if (profile.website !== undefined) state.integrations[platform].website = profile.website || "";
      if (profile.accountType !== undefined) state.integrations[platform].accountType = profile.accountType || "";
      if (!state.integrations[platform].sync) state.integrations[platform].sync = {};
      state.integrations[platform].sync.status = "connected";
      state.integrations[platform].sync.lastError = null;

      try {
        const postCount = await syncPlatform(state, platform);
        console.log(`[PostPilot] Auto-synced ${postCount} posts from ${platform} on connect`);
      } catch (syncErr) {
        console.error(`[PostPilot] Auto-sync after connect failed for ${platform}:`, syncErr?.message);
      }

      updateOnboardingCompletion(state);
      await saveStateForUser(user.id, state);
      sendRedirect(res, integrationRedirectUrl(platform, true));
    } catch (err) {
      sendRedirect(res, integrationRedirectUrl(platform, false, "oauth_callback_failed", err.message));
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/account") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    await saveStateForUser(user.id, state);
    sendJson(res, 200, accountSummary(state));
    return;
  }

  if (req.method === "POST" && pathname === "/api/account/create") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      if (!body.name || !body.email) {
        sendJson(res, 400, { error: "Name and email are required" });
        return;
      }
      const updatedUser = await updateUserProfile(user.id, {
        fullName: String(body.name).trim(),
        email: String(body.email).trim().toLowerCase(),
      });
      state.user.createdAt = state.user.createdAt || nowIso();
      state.user.name = updatedUser.fullName;
      state.user.email = updatedUser.email;
      updateOnboardingCompletion(state);
      await saveStateForUser(user.id, state);
      sendJson(res, 200, accountSummary(state));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/account/onboarding/complete") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      if (!state.user.createdAt) {
        sendJson(res, 400, { error: "Create account first" });
        return;
      }

      state.user.niche = String(body.niche || "").trim();
      state.user.objective = String(body.objective || "").trim();

      updateOnboardingCompletion(state);
      if (!state.user.onboardingCompleted) {
        sendJson(res, 400, {
          error: `Missing onboarding fields: ${onboardingMissingFields(state).join(", ")}`,
        });
        return;
      }

      await saveStateForUser(user.id, state);
      sendJson(res, 200, accountSummary(state));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/settings/save") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      if (!state.user.createdAt) {
        sendJson(res, 400, { error: "Create account first" });
        return;
      }

      let updatedUser = user;
      const shouldUpdateIdentity = typeof body.name === "string" || typeof body.email === "string";
      if (shouldUpdateIdentity) {
        updatedUser = await updateUserProfile(user.id, {
          fullName: typeof body.name === "string" ? body.name : undefined,
          email: typeof body.email === "string" ? body.email : undefined,
        });
      }
      state.user.name = updatedUser.fullName;
      state.user.email = updatedUser.email;
      if (typeof body.niche === "string") state.user.niche = body.niche.trim();
      if (typeof body.objective === "string") state.user.objective = body.objective.trim();

      if (typeof body.linkedinUsername === "string") {
        const v = body.linkedinUsername.trim();
        state.integrations.linkedin.username = v || null;
        if (!v && !state.integrations.linkedin.connected) state.integrations.linkedin.token = null;
      }

      if (typeof body.instagramUsername === "string") {
        const v = body.instagramUsername.trim();
        state.integrations.instagram.username = v || null;
        if (!v && !state.integrations.instagram.connected) state.integrations.instagram.token = null;
      }

      updateOnboardingCompletion(state);
      await saveStateForUser(user.id, state);
      sendJson(res, 200, accountSummary(state));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/integrations") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    sendJson(res, 200, {
      integrations: state.integrations,
      connected: activePlatforms(state),
      syncJobs: (state.syncJobs || []).slice(0, 20),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/payment/status") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    sendJson(res, 200, {
      payment: {
        required: true,
        completed: isPaymentComplete(state),
        details: state.user.billing,
      },
    });
    return;
  }

  if (
    req.method === "POST" &&
    (pathname === "/api/payment/create-checkout-session" || pathname === "/api/payment/complete")
  ) {
    try {
      if (!stripe) {
        sendJson(res, 500, { error: "Stripe is not configured" });
        return;
      }
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      if (!state.user.onboardingCompleted) {
        sendJson(res, 400, { error: "Complete onboarding before payment." });
        return;
      }
      const origin = requestOrigin(req);
      const successUrl = `${origin}/?checkout=success`;
      const cancelUrl = `${origin}/?checkout=cancel`;
      const lineItem = STRIPE_PRICE_ID
        ? { price: STRIPE_PRICE_ID, quantity: 1 }
        : {
            price_data: {
              currency: "eur",
              unit_amount: STRIPE_MONTHLY_EUR_CENTS,
              recurring: { interval: "month" },
              product_data: {
                name: "PostPilot Pro",
                description: "AI creator coach subscription",
              },
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.email,
        line_items: [lineItem],
        metadata: {
          userId: String(user.id),
          plan: "monthly",
        },
        subscription_data: {
          metadata: {
            userId: String(user.id),
            plan: "monthly",
          },
        },
      });

      state.user.billing.lastCheckoutInitiatedAt = nowIso();
      await saveStateForUser(user.id, state);
      sendJson(res, 200, {
        ok: true,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/payment/create-portal-session") {
    try {
      if (!stripe) {
        sendJson(res, 500, { error: "Stripe is not configured" });
        return;
      }
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const customerId = state.user.billing?.stripeCustomerId;
      if (!customerId) {
        sendJson(res, 400, { error: "No Stripe customer is associated with this account yet." });
        return;
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: requestOrigin(req),
      });
      sendJson(res, 200, { ok: true, url: session.url });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/payment/cancel-subscription") {
    try {
      if (!stripe) {
        sendJson(res, 500, { error: "Stripe is not configured" });
        return;
      }
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const subscriptionId = state.user.billing?.stripeSubscriptionId;
      if (!subscriptionId) {
        sendJson(res, 400, { error: "No active Stripe subscription found." });
        return;
      }
      const updated = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      state.user.billing.cancelAtPeriodEnd = Boolean(updated.cancel_at_period_end);
      await saveStateForUser(user.id, state);
      sendJson(res, 200, {
        ok: true,
        subscriptionId: updated.id,
        cancelAtPeriodEnd: Boolean(updated.cancel_at_period_end),
        currentPeriodEnd: updated.current_period_end || null,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/payment/webhook") {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      sendJson(res, 500, { error: "Stripe webhook is not configured" });
      return;
    }
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      sendJson(res, 400, { error: "Missing Stripe signature" });
      return;
    }
    try {
      const rawBody = await readRawBody(req);
      const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
      const obj = event.data.object;
      const userId = await resolveUserIdFromStripeEventObject(obj);
      if (!userId) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true, ignored: true }));
        return;
      }
      const user = await findUserById(userId);
      if (!user) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true, ignored: true }));
        return;
      }
      const state = bindStateToUser(await getStateForUser(user.id), user);

      if (event.type === "checkout.session.completed") {
        markBillingPaid(state, {
          customerId: typeof obj.customer === "string" ? obj.customer : null,
          subscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
          checkoutSessionId: obj.id,
        });
      }

      if (event.type === "invoice.paid") {
        markBillingPaid(state, {
          customerId: typeof obj.customer === "string" ? obj.customer : null,
          subscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
        });
      }

      if (event.type === "customer.subscription.deleted") {
        markBillingUnpaid(state, {
          subscriptionId: obj.id,
          customerId: typeof obj.customer === "string" ? obj.customer : null,
          reason: "subscription_deleted",
        });
      }

      if (event.type === "invoice.payment_failed") {
        markBillingUnpaid(state, {
          subscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
          customerId: typeof obj.customer === "string" ? obj.customer : null,
          reason: "invoice_payment_failed",
        });
      }

      if (event.type === "customer.subscription.updated") {
        const status = String(obj.status || "").toLowerCase();
        if (status === "active" || status === "trialing") {
          markBillingPaid(state, {
            subscriptionId: obj.id,
            customerId: typeof obj.customer === "string" ? obj.customer : null,
          });
        } else if (status) {
          markBillingUnpaid(state, {
            subscriptionId: obj.id,
            customerId: typeof obj.customer === "string" ? obj.customer : null,
            reason: `subscription_status_${status}`,
          });
        }
      }

      await saveStateForUser(user.id, state);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    } catch (err) {
      sendJson(res, 400, { error: `webhook_verification_failed: ${err.message}` });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/integrations/connect") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      if (!state.user.createdAt) {
        sendJson(res, 400, { error: "Create account first" });
        return;
      }
      const platform = normalizePlatform(body.platform);
      if (!platform || !state.integrations[platform]) {
        sendJson(res, 400, { error: "Unknown platform" });
        return;
      }
      const stateToken = await createOAuthState({
        source: `social:${platform}:${user.id}`,
        redirectTo: "/",
      });
      const redirectUri = `${requestOrigin(req)}/auth/${platform}/callback`;
      const authUrl = buildAuthUrl({ platform, redirectUri, state: stateToken });
      sendJson(res, 200, {
        platform,
        connected: state.integrations[platform].connected,
        authUrl,
        lockedAccountId: state.integrations[platform].lockedAccountId || null,
        lockedUsername: state.integrations[platform].lockedUsername || null,
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/integrations/disconnect") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      const platform = normalizePlatform(body.platform);
      if (!platform || !state.integrations[platform]) {
        sendJson(res, 400, { error: "Unknown platform" });
        return;
      }
      const integration = state.integrations[platform];
      integration.connected = false;
      integration.token = null;
      integration.refreshToken = null;
      integration.expiresIn = null;
      integration.tokenExpiresAt = null;
      integration.lastSyncAt = null;
      if (integration.sync) {
        integration.sync.status = "disconnected";
        integration.sync.lastError = null;
      }
      state.posts = Array.isArray(state.posts)
        ? state.posts.filter((p) => p.platform !== platform)
        : [];
      state.voiceProfile = buildVoiceProfile(state.posts);
      await saveStateForUser(user.id, state);
      sendJson(res, 200, accountSummary(state));
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/integrations/sync") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      const platform = normalizePlatform(body.platform || "");
      const platforms = platform ? [platform] : activePlatforms(state);
      if (!platforms.length) {
        sendJson(res, 400, { error: "No connected platforms" });
        return;
      }
      const results = [];
      for (const p of platforms) {
        const job = await runSyncJob(state, p);
        results.push({
          platform: p,
          jobId: job.id,
          status: job.status,
          attempts: job.attempts,
          synced: job.recordsSynced,
          error: job.error,
        });
      }
      await saveStateForUser(user.id, state);
      sendJson(res, 200, {
        results,
        totalPosts: state.posts.length,
        voiceProfile: state.voiceProfile,
        jobs: (state.syncJobs || []).slice(0, 20),
      });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/integrations/sync-status") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    sendJson(res, 200, {
      integrations: state.integrations,
      jobs: (state.syncJobs || []).slice(0, 50),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/voice-profile") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    if (!state.voiceProfile) {
      state.voiceProfile = buildVoiceProfile(state.posts);
      await saveStateForUser(user.id, state);
    }
    sendJson(res, 200, { voiceProfile: state.voiceProfile });
    return;
  }

  if (req.method === "GET" && pathname === "/api/analytics/summary") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    const backfilled = await ensureProfileData(state);
    if (backfilled) await saveStateForUser(user.id, state);
    sendJson(res, 200, summarizeAnalytics(state.posts));
    return;
  }

  if (req.method === "GET" && pathname === "/api/creator/profile") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    sendJson(res, 200, buildCreatorProfile(state));
    return;
  }

  if (req.method === "GET" && pathname === "/api/posts/recent") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    const backfilled = await ensureProfileData(state);
    if (backfilled) await saveStateForUser(user.id, state);
    const limit = Number(parsed.searchParams.get("limit") || 20);
    if (!Number.isFinite(limit) || limit <= 0) {
      sendJson(res, 200, { posts: state.posts });
      return;
    }
    sendJson(res, 200, { posts: state.posts.slice(0, limit) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/agent/conversation") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const sessionId = parsed.searchParams.get("sessionId") || "default";
      const convo = getConversation(state, sessionId);
      sendJson(res, 200, { conversation: convo });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/agent/conversation/reset") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      const sessionId = body.sessionId || "default";
      state.conversations[sessionId] = [];
      await saveStateForUser(user.id, state);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/agent/message") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      const message = body.message || "";
      const sessionId = body.sessionId || "default";
      const language = typeof body.language === "string" ? body.language : "";
      if (!isPaymentComplete(state)) {
        sendJson(res, 402, {
          error: "Payment required. Complete your 29 Euro/month subscription to use the AI coach.",
          action: "payment_required",
        });
        return;
      }
      const convo = getConversation(state, sessionId);
      convo.push({ role: "user", content: message, at: nowIso() });
      const reply = await agentRespond(state, { message, userId: user.id, sessionId, language });
      convo.push({ role: "assistant", content: reply.content, at: nowIso(), action: reply.action });
      await saveStateForUser(user.id, state);
      sendJson(res, 200, { reply, conversation: convo.slice(-20) });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/agent/message/stream") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const state = bindStateToUser(await getStateForUser(user.id), user);
      const body = await readBody(req);
      const message = body.message || "";
      const sessionId = body.sessionId || "default";
      const language = typeof body.language === "string" ? body.language : "";
      if (!isPaymentComplete(state)) {
        sendJson(res, 402, { error: "Payment required.", action: "payment_required" });
        return;
      }

      const guardReply = agentGuardReply(state);
      if (guardReply) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ token: guardReply.content })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, action: guardReply.action })}\n\n`);
        res.end();
        return;
      }

      const backfilled = await ensureProfileData(state);
      if (backfilled) await saveStateForUser(user.id, state);
      const voiceProfile = state.voiceProfile || buildVoiceProfile(state.posts);
      state.voiceProfile = voiceProfile;
      const convo = getConversation(state, sessionId);
      convo.push({ role: "user", content: message, at: nowIso() });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      if (res.socket) res.socket.setNoDelay(true);

      let fullContent = "";
      try {
        for await (const token of streamAgentReply({
          message,
          history: convo,
          state,
          userId: user.id,
          sessionId,
          language,
        })) {
          fullContent += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true, action: "ai_reply" })}\n\n`);
      } catch (streamErr) {
        console.error("[PostPilot][AI] stream error", streamErr?.message);
        if (!fullContent) {
          res.write(`data: ${JSON.stringify({ token: "I could not reach the AI provider. Please try again." })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true, action: "provider_error" })}\n\n`);
      }
      res.end();

      if (fullContent) {
        convo.push({ role: "assistant", content: fullContent, at: nowIso(), action: "ai_reply" });
        await saveStateForUser(user.id, state);
      }
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 400, { error: err.message });
      }
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/planner/weekly") {
    try {
      const user = await requireAuth(req, res);
      if (!user) return;
      const body = await readBody(req);
      sendJson(res, 200, { plan: generateWeeklyPlan(body || {}) });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res, pathname);
    return;
  }

  sendJson(res, 404, { error: "Route not found" });
});

async function startServer() {
  await ensureAppState();
  server.listen(PORT, () => {
    console.log(`PostPilot Agent running on http://localhost:${PORT}`);
  });
}

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDb();
  process.exit(0);
});

startServer().catch((error) => {
  console.error("Failed to start PostPilot Agent:", error);
  process.exit(1);
});
