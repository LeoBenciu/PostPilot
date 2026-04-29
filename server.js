const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
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
  getWaitlistCount,
  incrementWaitlistCount,
  ensureUserReferralCode,
  findUserByReferralCode,
  attachReferralToUser,
  markReferralQualifiedForInvitee,
  getReferralSummaryForUser,
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
const STRIPE_MONTHLY_EUR_CENTS = Number(process.env.STRIPE_MONTHLY_EUR_CENTS || 900);
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const WAITLIST_NOTIFY_TO = (process.env.WAITLIST_NOTIFY_TO || "nextcorpromania@gmail.com").trim();
const WAITLIST_FROM_EMAIL = (process.env.WAITLIST_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
const WAITLIST_SMTP_URL = (process.env.WAITLIST_SMTP_URL || process.env.SMTP_URL || "").trim();
const WAITLIST_SMTP_HOST = (process.env.WAITLIST_SMTP_HOST || process.env.SMTP_HOST || "").trim();
const WAITLIST_SMTP_PORT = Number(process.env.WAITLIST_SMTP_PORT || process.env.SMTP_PORT || 587);
const WAITLIST_SMTP_SECURE = String(
  process.env.WAITLIST_SMTP_SECURE || process.env.SMTP_SECURE || (WAITLIST_SMTP_PORT === 465 ? "true" : "false")
).toLowerCase() === "true";
const WAITLIST_SMTP_USER = (process.env.WAITLIST_SMTP_USER || process.env.SMTP_USER || "").trim();
const WAITLIST_SMTP_PASS = (process.env.WAITLIST_SMTP_PASS || process.env.SMTP_PASS || "").trim();
let waitlistMailer = null;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getWaitlistMailer() {
  if (waitlistMailer) return waitlistMailer;
  if (WAITLIST_SMTP_URL) {
    waitlistMailer = nodemailer.createTransport(WAITLIST_SMTP_URL);
    return waitlistMailer;
  }
  if (!WAITLIST_SMTP_HOST || !WAITLIST_SMTP_PORT || !WAITLIST_SMTP_USER || !WAITLIST_SMTP_PASS) {
    return null;
  }
  waitlistMailer = nodemailer.createTransport({
    host: WAITLIST_SMTP_HOST,
    port: WAITLIST_SMTP_PORT,
    secure: WAITLIST_SMTP_SECURE,
    auth: {
      user: WAITLIST_SMTP_USER,
      pass: WAITLIST_SMTP_PASS,
    },
  });
  return waitlistMailer;
}

async function sendWaitlistEmail({ email, req }) {
  const transporter = getWaitlistMailer();
  if (!transporter) {
    throw new Error("Waitlist email is not configured. Set WAITLIST_SMTP_URL or SMTP host/user/pass env vars.");
  }
  const fromEmail = WAITLIST_FROM_EMAIL || WAITLIST_SMTP_USER;
  if (!fromEmail) {
    throw new Error("Missing sender email. Set WAITLIST_FROM_EMAIL or SMTP_USER.");
  }
  const now = new Date().toISOString();
  const ip =
    String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() || req.socket?.remoteAddress || "unknown";
  const userAgent = String(req.headers["user-agent"] || "unknown");
  await transporter.sendMail({
    from: fromEmail,
    to: WAITLIST_NOTIFY_TO,
    subject: "New PostPilot waitlist signup",
    text: [
      "A new waitlist signup was received.",
      "",
      `Email: ${email}`,
      `Timestamp: ${now}`,
      `IP: ${ip}`,
      `User-Agent: ${userAgent}`,
    ].join("\n"),
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

// Kept as a fallback in case the /consent/ URL trick stops working and we
// need to route through a JS shim again to dodge Universal / App Links.
// Currently unused — buildAuthUrl() points directly at www.instagram.com/
// consent/ which isn't in the Instagram app's deep-link allowlist.
// eslint-disable-next-line no-unused-vars
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
  <div class="hint hidden" id="mobileHint">
    <strong>Stay in your browser, ignore the Instagram app.</strong>
    If the Instagram app opens with an error, close it and come back to this tab — the login page is opening here.
  </div>
</div>
<script>
  // Both the automatic navigation and the manual fallback are JS-initiated, not
  // <a href>-based. iOS Universal Links and Android App Links only trigger on
  // navigations happening inside the original user-gesture window (~500ms).
  // We wait past that before calling replace() so the URL stays inside the
  // browser instead of being handed to the native Instagram app.
  var target = ${JSON.stringify(location)};
  function go() {
    try { window.location.replace(target); }
    catch (e) { window.location.href = target; }
  }
  document.getElementById("manual").addEventListener("click", go);
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent || "")) {
    document.getElementById("mobileHint").classList.remove("hidden");
  }
  setTimeout(go, 600);
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

const CREATOR_PROFILE_LOCALE = {
  en: "en-US",
  ro: "ro-RO",
  it: "it-IT",
  de: "de-DE",
  fr: "fr-FR",
};

function normalizeCreatorLanguage(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw.startsWith("ro")) return "ro";
  if (raw.startsWith("it")) return "it";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("fr")) return "fr";
  return "en";
}

function getCreatorAdviceCopy(language) {
  if (language === "ro") {
    return {
      superCarouselTitle: "Caruseluri puternice",
      superCarouselBody: (viewsText) => `Postarile tale multi-imagine au in medie ${viewsText} vizualizari - continua pe formatul asta.`,
      superShareTitle: "Rata buna de distribuire",
      superShareBody: "Oamenii iti distribuie activ continutul - asta e aur pentru crestere organica.",
      superEngagementTitle: "Rata mare de engagement",
      superEngagementBody: (engText) => `Ai in medie ${engText} engagement - mult peste mediana de ~2% a creatorilor.`,
      superReachTitle: "Reach mare pentru dimensiunea ta",
      superReachBody: (viewsText, followersText) => `Postarile recente au adunat ${viewsText} vizualizari - foarte bine pentru ${followersText} followeri.`,
      superVideoTitle: "Storytelling video puternic",
      superVideoBody: "Videourile tale performeaza mai bine decat postarile statice - acesta e un avantaj real.",
      superDefaultTitle: "Esti consecvent",
      superDefaultBody: (postsText) => `Ai publicat ${postsText} postari - consecventa este baza pe care se construieste cresterea.`,
      unlockCommentsTitle: "Comentariile sunt putine",
      unlockCommentsBody: "Hai sa construim descrieri care provoaca discutii - mai multe comentarii inseamna reach mai bun.",
      unlockCadenceTitle: "Postezi inconstant",
      unlockCadenceBody: (ppwText) => `Ai doar ~${ppwText} postari/saptamana - pierdem crestere, hai sa facem un ritm clar.`,
      unlockCaptionTitle: "Descrierile sunt prea scurte",
      unlockCaptionBody: "Hai sa adaugam storytelling care conecteaza - descrierile mai specifice transforma vizualizarile in fani.",
      unlockHooksTitle: "Reels-urile sunt sub potential",
      unlockHooksBody: "Te ajut sa creezi hook-uri care opresc scroll-ul - aici ai cel mai mare potential.",
      unlockSavesTitle: "Salvarile sunt putine",
      unlockSavesBody: "Continutul salvat este continut valoros. Hai sa adaugam unghiuri practice care merita salvate.",
      unlockDefaultTitle: "E momentul sa scalezi",
      unlockDefaultBody: "Fundatia este solida - acum dublam ce functioneaza si amplificam reach-ul.",
    };
  }
  if (language === "it") {
    return {
      superCarouselTitle: "Ottimi caroselli",
      superCarouselBody: (viewsText) => `I tuoi post multi-immagine fanno in media ${viewsText} visualizzazioni: punta su questo formato.`,
      superShareTitle: "Condivisioni forti",
      superShareBody: "Le persone condividono attivamente i tuoi contenuti: questo e oro per la crescita organica.",
      superEngagementTitle: "Engagement elevato",
      superEngagementBody: (engText) => `Stai facendo in media ${engText} di engagement: ben sopra la mediana creator di ~2%.`,
      superReachTitle: "Reach alto per la tua dimensione",
      superReachBody: (viewsText, followersText) => `I post recenti hanno totalizzato ${viewsText} visualizzazioni: ottimo per ${followersText} follower.`,
      superVideoTitle: "Storytelling video forte",
      superVideoBody: "I tuoi video performano meglio dei post statici: e un vantaggio concreto.",
      superDefaultTitle: "Sei costante",
      superDefaultBody: (postsText) => `Hai pubblicato ${postsText} post: la costanza e la base su cui cresce tutto.`,
      unlockCommentsTitle: "Commenti bassi",
      unlockCommentsBody: "Costruiamo caption che aprono conversazioni: piu commenti = piu reach.",
      unlockCadenceTitle: "Pubblicazione irregolare",
      unlockCadenceBody: (ppwText) => `Solo ~${ppwText} post a settimana: stiamo lasciando crescita sul tavolo, creiamo un ritmo.`,
      unlockCaptionTitle: "Caption troppo brevi",
      unlockCaptionBody: "Aggiungiamo storytelling che connette: caption piu specifiche trasformano le view in fan.",
      unlockHooksTitle: "I Reels rendono meno",
      unlockHooksBody: "Ti aiuto a creare hook che fermano lo scroll: qui c'e il tuo maggiore margine.",
      unlockSavesTitle: "Salvataggi bassi",
      unlockSavesBody: "Contenuto salvato = contenuto utile. Aggiungiamo angoli pratici che vale la pena salvare.",
      unlockDefaultTitle: "E ora di scalare",
      unlockDefaultBody: "Le basi sono solide: ora raddoppiamo cio che funziona e aumentiamo il reach.",
    };
  }
  if (language === "de") {
    return {
      superCarouselTitle: "Starke Carousels",
      superCarouselBody: (viewsText) => `Deine Multi-Image-Posts erzielen im Schnitt ${viewsText} Views - setze staerker auf dieses Format.`,
      superShareTitle: "Starke Share-Rate",
      superShareBody: "Deine Inhalte werden aktiv geteilt - das ist pures Gold fuer organisches Wachstum.",
      superEngagementTitle: "Hohe Engagement-Rate",
      superEngagementBody: (engText) => `Du erreichst im Schnitt ${engText} Engagement - deutlich ueber dem Creator-Median von ~2%.`,
      superReachTitle: "Grosse Reichweite fuer deine Groesse",
      superReachBody: (viewsText, followersText) => `Deine letzten Posts haben ${viewsText} Views geholt - stark bei ${followersText} Followern.`,
      superVideoTitle: "Starkes Video-Storytelling",
      superVideoBody: "Deine Videos performen besser als statische Posts - das ist ein klarer Vorteil.",
      superDefaultTitle: "Du bleibst dran",
      superDefaultBody: (postsText) => `Du hast ${postsText} Beitraege veroefentlicht - Konstanz ist das Fundament fuer Wachstum.`,
      unlockCommentsTitle: "Wenige Kommentare",
      unlockCommentsBody: "Lass uns Captions bauen, die Gesprache ausloesen - mehr Kommentare bedeuten mehr Reichweite.",
      unlockCadenceTitle: "Unregelmaessiges Posten",
      unlockCadenceBody: (ppwText) => `Nur ~${ppwText} Posts/Woche - wir lassen Wachstum liegen, lass uns einen Rhythmus aufbauen.`,
      unlockCaptionTitle: "Captions sind zu kurz",
      unlockCaptionBody: "Mehr Storytelling verbindet besser - laengere, konkrete Captions machen aus Views echte Fans.",
      unlockHooksTitle: "Reels unterperformen",
      unlockHooksBody: "Ich helfe dir bei Hooks, die den Scroll stoppen - hier liegt dein groesster Hebel.",
      unlockSavesTitle: "Wenig Saves",
      unlockSavesBody: "Was gespeichert wird, hat echten Wert. Lass uns mehr praktische Save-Hooks einbauen.",
      unlockDefaultTitle: "Zeit zu skalieren",
      unlockDefaultBody: "Dein Fundament ist stark - jetzt verstaerken wir, was funktioniert, und vergroessern die Reichweite.",
    };
  }
  if (language === "fr") {
    return {
      superCarouselTitle: "Carrousels performants",
      superCarouselBody: (viewsText) => `Tes publications multi-images font en moyenne ${viewsText} vues - mise davantage sur ce format.`,
      superShareTitle: "Bon taux de partage",
      superShareBody: "Les gens partagent activement ton contenu - c'est de l'or pour la croissance organique.",
      superEngagementTitle: "Fort taux d'engagement",
      superEngagementBody: (engText) => `Tu affiches en moyenne ${engText} d'engagement - bien au-dessus de la mediane creator d'environ 2%.`,
      superReachTitle: "Grande portee pour ta taille",
      superReachBody: (viewsText, followersText) => `Tes posts recents ont genere ${viewsText} vues - excellent pour ${followersText} abonnes.`,
      superVideoTitle: "Storytelling video solide",
      superVideoBody: "Tes videos performent mieux que les posts statiques - c'est un vrai avantage.",
      superDefaultTitle: "Tu es regulier",
      superDefaultBody: (postsText) => `Tu as publie ${postsText} posts - la regularite est la base de toute croissance.`,
      unlockCommentsTitle: "Peu de commentaires",
      unlockCommentsBody: "Creons des captions qui lancent la conversation - plus de commentaires = meilleure portee.",
      unlockCadenceTitle: "Publication irreguliere",
      unlockCadenceBody: (ppwText) => `Seulement ~${ppwText} posts/semaine - on laisse de la croissance sur la table, construisons un rythme.`,
      unlockCaptionTitle: "Captions trop courtes",
      unlockCaptionBody: "Ajoutons du storytelling qui connecte - des captions plus precises convertissent les vues en fans.",
      unlockHooksTitle: "Les Reels sous-performent",
      unlockHooksBody: "Je vais t'aider a trouver des hooks qui stoppent le scroll - c'est ton plus gros levier.",
      unlockSavesTitle: "Peu de sauvegardes",
      unlockSavesBody: "Un contenu sauvegarde est un contenu utile. Ajoutons des angles pratiques a forte valeur.",
      unlockDefaultTitle: "Il est temps de scaler",
      unlockDefaultBody: "Ta base est solide - maintenant on renforce ce qui marche et on amplifie la portee.",
    };
  }
  return {
    superCarouselTitle: "Carousel mastery",
    superCarouselBody: (viewsText) => `Your multi-image posts average ${viewsText} views - lean into this format.`,
    superShareTitle: "Strong share rate",
    superShareBody: "People actively share your content - that is organic growth gold.",
    superEngagementTitle: "High engagement rate",
    superEngagementBody: (engText) => `You are averaging ${engText} engagement - well above the ~2% creator median.`,
    superReachTitle: "Massive reach for your size",
    superReachBody: (viewsText, followersText) => `Your recent posts pulled ${viewsText} views - that's huge for ${followersText} followers.`,
    superVideoTitle: "Video-first storytelling",
    superVideoBody: "Your videos travel further than static posts - that's a real edge.",
    superDefaultTitle: "You're showing up",
    superDefaultBody: (postsText) => `You've published ${postsText} posts - consistency is the foundation everything else builds on.`,
    unlockCommentsTitle: "Your comments are low",
    unlockCommentsBody: "Let's craft captions that spark conversation - more comments means better reach.",
    unlockCadenceTitle: "Posting is inconsistent",
    unlockCadenceBody: (ppwText) => `Only ~${ppwText} posts/week - we're leaving growth on the table, let's build a rhythm.`,
    unlockCaptionTitle: "Captions are minimal",
    unlockCaptionBody: "Let's add storytelling that connects - longer, specific captions convert viewers into fans.",
    unlockHooksTitle: "Reels are underperforming",
    unlockHooksBody: "I'll help you nail hooks that stop the scroll - this is your biggest unlock.",
    unlockSavesTitle: "Saves are low",
    unlockSavesBody: "Content people save = content they want to revisit. Let's add practical value hooks.",
    unlockDefaultTitle: "Time to scale",
    unlockDefaultBody: "Your foundation is solid - let's double down on what's working and amplify reach.",
  };
}

function buildCreatorProfile(state, language = "en") {
  const normalizedLanguage = normalizeCreatorLanguage(language);
  const locale = CREATOR_PROFILE_LOCALE[normalizedLanguage] || CREATOR_PROFILE_LOCALE.en;
  const copy = getCreatorAdviceCopy(normalizedLanguage);
  const formatInt = (value) => Number(value || 0).toLocaleString(locale);
  const formatOneDecimal = (value) =>
    Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
  const followerCount = Number(
    primaryIntegration?.followersCount || primaryIntegration?.followerCount || primaryIntegration?.followers || 0,
  );

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
      title: copy.superCarouselTitle,
      body: copy.superCarouselBody(formatInt(avgViewsByType.carousel)),
    });
  }
  if (shareRate > 0.01) {
    superpower.push({
      icon: "share",
      title: copy.superShareTitle,
      body: copy.superShareBody,
    });
  }
  if (avgEngagementRate > 0.04) {
    superpower.push({
      icon: "engagement",
      title: copy.superEngagementTitle,
      body: copy.superEngagementBody(`${formatOneDecimal(avgEngagementRate * 100)}%`),
    });
  }
  if (followerCount > 0 && totalViews / Math.max(1, followerCount) > 5) {
    superpower.push({
      icon: "reach",
      title: copy.superReachTitle,
      body: copy.superReachBody(formatInt(totalViews), formatInt(followerCount)),
    });
  }
  if (byType.video.length >= 2 && avgViewsByType.video && avgViewsByType.video > (avgViewsByType.image || 0) * 1.3) {
    superpower.push({
      icon: "video",
      title: copy.superVideoTitle,
      body: copy.superVideoBody,
    });
  }
  if (!superpower.length && recentPosts.length > 0) {
    superpower.push({
      icon: "consistency",
      title: copy.superDefaultTitle,
      body: copy.superDefaultBody(formatInt(recentPosts.length)),
    });
  }

  if (commentRate < 0.002 && totalReach > 0) {
    unlock.push({
      icon: "comments",
      title: copy.unlockCommentsTitle,
      body: copy.unlockCommentsBody,
    });
  }
  if (postsPerWeek < 2) {
    unlock.push({
      icon: "cadence",
      title: copy.unlockCadenceTitle,
      body: copy.unlockCadenceBody(formatOneDecimal(postsPerWeek)),
    });
  }
  if (avgCaptionLen > 0 && avgCaptionLen < 60) {
    unlock.push({
      icon: "caption",
      title: copy.unlockCaptionTitle,
      body: copy.unlockCaptionBody,
    });
  }
  if (byType.video.length && avgViewsByType.video && avgViewsByType.image && avgViewsByType.video < avgViewsByType.image * 0.7) {
    unlock.push({
      icon: "hooks",
      title: copy.unlockHooksTitle,
      body: copy.unlockHooksBody,
    });
  }
  if (saveRate < 0.005 && totalReach > 0) {
    unlock.push({
      icon: "saves",
      title: copy.unlockSavesTitle,
      body: copy.unlockSavesBody,
    });
  }
  if (!unlock.length) {
    unlock.push({
      icon: "scale",
      title: copy.unlockDefaultTitle,
      body: copy.unlockDefaultBody,
    });
  }

  return {
    user: {
      name: user.name || "",
      firstName: (user.name || "").split(" ")[0] || "",
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

function parseGoogleAuthStateSource(rawSource) {
  const value = String(rawSource || "");
  if (value === "signin") return { source: "signin", referralCode: "" };
  if (value.startsWith("signup:ref:")) {
    return {
      source: "signup",
      referralCode: value.slice("signup:ref:".length).trim().toUpperCase(),
    };
  }
  return { source: "signup", referralCode: "" };
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
  state.user.billing.amountEur = 9;
  state.user.billing.currency = "EUR";
  state.user.billing.interval = "month";
  state.user.billing.paidAt = nowIso();
  if (payload.customerId) state.user.billing.stripeCustomerId = payload.customerId;
  if (payload.subscriptionId) state.user.billing.stripeSubscriptionId = payload.subscriptionId;
  if (payload.checkoutSessionId) state.user.billing.stripeCheckoutSessionId = payload.checkoutSessionId;
}

function ensureReferralBillingFields(state) {
  if (!state.user.billing || typeof state.user.billing !== "object") state.user.billing = {};
  if (!Number.isFinite(Number(state.user.billing.referralCreditsPendingMonths))) {
    state.user.billing.referralCreditsPendingMonths = 0;
  }
  if (!Number.isFinite(Number(state.user.billing.referralCreditsAppliedMonths))) {
    state.user.billing.referralCreditsAppliedMonths = 0;
  }
}

async function applyPendingReferralCredits(user, state, reason = "referral reward month") {
  ensureReferralBillingFields(state);
  const pendingMonths = Number(state.user.billing.referralCreditsPendingMonths || 0);
  if (!pendingMonths) return 0;
  const customerId = String(state.user.billing.stripeCustomerId || "").trim();
  if (!stripe || !customerId) return 0;
  let applied = 0;
  for (let i = 0; i < pendingMonths; i += 1) {
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: -Math.abs(STRIPE_MONTHLY_EUR_CENTS),
      currency: "eur",
      description: reason,
      metadata: {
        userId: String(user.id),
      },
    });
    applied += 1;
  }
  if (applied > 0) {
    state.user.billing.referralCreditsPendingMonths = Math.max(
      0,
      Number(state.user.billing.referralCreditsPendingMonths || 0) - applied
    );
    state.user.billing.referralCreditsAppliedMonths =
      Number(state.user.billing.referralCreditsAppliedMonths || 0) + applied;
    state.user.billing.referralCreditsLastAppliedAt = nowIso();
  }
  return applied;
}

async function queueReferralRewardMonth(userId, reason) {
  const user = await findUserById(userId);
  if (!user) return { queued: false, applied: false };
  const state = bindStateToUser(await getStateForUser(user.id), user);
  return queueReferralRewardMonthOnState(user, state, reason);
}

async function processReferralRewardForInvitee(user, state) {
  const qualification = await markReferralQualifiedForInvitee(user.id);
  if (!qualification) return false;
  await queueReferralRewardMonthOnState(
    user,
    state,
    "Referral reward: your second month is free"
  );
  await queueReferralRewardMonth(
    qualification.inviterUserId,
    "Referral reward: someone joined using your code"
  );
  return true;
}

async function queueReferralRewardMonthOnState(user, state, reason) {
  ensureReferralBillingFields(state);
  state.user.billing.referralCreditsPendingMonths =
    Number(state.user.billing.referralCreditsPendingMonths || 0) + 1;
  state.user.billing.referralCreditsEarnedMonths =
    Number(state.user.billing.referralCreditsEarnedMonths || 0) + 1;
  let applied = 0;
  try {
    applied = await applyPendingReferralCredits(user, state, reason);
  } catch (err) {
    state.user.billing.referralCreditsLastError = String(err?.message || err);
  }
  await saveStateForUser(user.id, state);
  return { queued: true, applied: applied > 0 };
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

async function accountSummaryWithReferral(userId, state) {
  const referral = await getReferralSummaryForUser(userId);
  const billing = state.user?.billing || {};
  return {
    ...accountSummary(state),
    referral: {
      ...referral,
      freeMonthsEarned: Number(billing.referralCreditsEarnedMonths || 0),
      freeMonthsApplied: Number(billing.referralCreditsAppliedMonths || 0),
      freeMonthsPending: Number(billing.referralCreditsPendingMonths || 0),
    },
  };
}

function bindStateToUser(state, user) {
  state.user.createdAt = state.user.createdAt || user.createdAt.toISOString();
  state.user.name = user.fullName || state.user.name || "";
  state.user.email = user.email || state.user.email || "";
  state.user.referralCode = user.referralCode || state.user.referralCode || "";
  if (!state.syncJobs || !Array.isArray(state.syncJobs)) state.syncJobs = [];
  if (!state.integrations?.linkedin) state.integrations.linkedin = { connected: false, username: null, token: null, lastSyncAt: null };
  if (!state.integrations?.instagram) state.integrations.instagram = { connected: false, username: null, token: null, lastSyncAt: null };
  if (typeof state.integrations.linkedin.avatarUrl === "undefined") state.integrations.linkedin.avatarUrl = null;
  if (typeof state.integrations.instagram.avatarUrl === "undefined") state.integrations.instagram.avatarUrl = null;
  return state;
}

function upsertPosts(state, newPosts) {
  const identityKey = (p) => {
    const platform = String(p?.platform || "");
    const sourceId = String(p?.sourceId || "").trim();
    if (platform && sourceId) return `${platform}:id:${sourceId}`;
    return `${platform}:legacy:${String(p?.postedAt || "")}:${String(p?.text || "")}`;
  };
  const seen = new Set(state.posts.map((p) => identityKey(p)));
  for (const post of newPosts) {
    const key = identityKey(post);
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
  state.posts = state.posts.filter((p) => p.platform !== platform);
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

// When the analytics page opens it used to fire two parallel requests that
// each kicked off their own ensureProfileData (two IG API round-trips for
// the same data). We dedupe by user so only ONE refresh runs at a time per
// user — later callers piggyback on the in-flight promise and then reload
// the freshly persisted state.
const profileRefreshInFlight = new Map();

async function ensureProfileDataDeduped(userId, state, opts = {}) {
  if (profileRefreshInFlight.has(userId)) {
    await profileRefreshInFlight.get(userId);
    // The in-flight refresh may have mutated & persisted state for OTHER
    // state objects in memory. Reload from DB so we return fresh values.
    const fresh = await getStateForUser(userId);
    Object.assign(state, fresh);
    return false;
  }
  const promise = (async () => {
    const changed = await ensureProfileData(state, opts);
    if (changed) await saveStateForUser(userId, state);
    return changed;
  })();
  profileRefreshInFlight.set(userId, promise);
  try {
    return await promise;
  } finally {
    profileRefreshInFlight.delete(userId);
  }
}

// Cheap version of ensureProfileData's staleness check — no network, no token
// refresh, just "will ensureProfileData need to hit the IG/LinkedIn APIs?".
// Used to emit the "checking your profile…" SSE status only when we're
// actually about to do real work.
async function shouldRefreshProfileData(state) {
  const now = Date.now();
  for (const [platform, integration] of Object.entries(state.integrations || {})) {
    if (!integration?.connected || !integration?.token) continue;
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
    const knownTotal = Number(integration.mediaCount || 0);
    const needsMorePosts = knownTotal > platformPosts.length;
    const needsPosts = !platformPosts.length || postsStale;
    if (needsProfile || needsPosts || needsMediaUrls || needsMorePosts) return true;
  }
  return false;
}

async function ensureProfileData(state, opts = {}) {
  const forcePostsRefresh = Boolean(opts.forcePostsRefresh);
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
    const postsStale = forcePostsRefresh || ageMs > POSTS_TTL_MS;

    const hasBio = integration.bio !== undefined && integration.bio !== null;
    const needsProfile = !hasBio || profileStale;

    const platformPosts = (state.posts || []).filter((p) => p.platform === platform);
    const needsMediaUrls =
      platformPosts.length > 0 && !platformPosts.some((p) => p.imageUrl || p.mediaUrl);
    // Compare the profile's reported media count against the count we saw at
    // the LAST successful sync, not the number of posts currently cached.
    // Instagram's `media_count` can include stories, archived, or otherwise
    // unreachable items — if /media consistently returns 6 while the profile
    // says 7, comparing against cached length would trigger a pointless
    // clear+resync on every request. Comparing against the remembered count
    // at sync time breaks that loop; we only re-fetch when the profile's
    // number actually *grows* beyond what we've already reconciled.
    const knownTotal = Number(integration.mediaCount || 0);
    const syncedTotal = Number(integration.syncedMediaCount || 0);
    const needsMorePosts = knownTotal > syncedTotal;
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
      const previouslySynced = Number(integration.syncedMediaCount || 0);
      // Only consider posts "actually new" when the profile's total exceeds
      // what we already reconciled on a previous sync. This prevents the
      // pathological loop where IG says 7, /media keeps returning 6, and we
      // clear + resync on every single request.
      const stillNeedsMore = freshTotal > previouslySynced;

      if (needsPosts || needsMediaUrls || stillNeedsMore) {
        // Always drop this platform's cached posts before re-fetching. `upsertPosts`
        // only appends unseen (platform+date+text) keys — without a clear, a TTL
        // refresh would refetch from IG but never replace rows, so impressions
        // and other metrics stayed frozen indefinitely.
        const reason = stillNeedsMore
          ? `new posts (${previouslySynced}→${freshTotal})`
          : needsMediaUrls
            ? "missing media URLs"
            : postsStale
              ? "posts cache stale (refresh metrics)"
              : "re-sync posts";
        state.posts = state.posts.filter((p) => p.platform !== platform);
        console.log(`[PostPilot] Clearing old ${platform} posts — ${reason}`);
        const profile = { username: integration.username, urn: integration.urn };
        const posts = await fetchPlatformPostsAndAnalytics({
          platform,
          accessToken: integration.token,
          profile,
        });
        upsertPosts(state, posts);
        state.voiceProfile = buildVoiceProfile(state.posts);
        integration.lastSyncAt = nowIso();
        // Remember the profile's reported count AT SYNC TIME (not the number
        // we actually fetched) — if IG reports 7 but /media only returns 6,
        // the mismatch is structural (stories / archive / deleted items).
        // Storing 7 here means subsequent calls with mediaCount=7 won't
        // re-trigger a resync until IG's reported count increases past it.
        integration.syncedMediaCount = freshTotal;
        changed = true;
        console.log(
          `[PostPilot] Synced ${posts.length} posts for ${platform}/@${integration.username} ` +
            `(media URLs: ${posts.filter((p) => p.imageUrl).length}, profile reports ${freshTotal})`,
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
    return { content: "Payment is required before using the AI coach. Please complete your 9 Euro/month subscription.", action: "payment_required" };
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
      const referralCode = await ensureUserReferralCode(user.id);
      sendJson(res, 200, {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
          referralCode: referralCode || null,
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
      const referralCode = String(body.referralCode || "").trim();
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
      if (referralCode) {
        const inviter = await findUserByReferralCode(referralCode);
        if (!inviter) {
          sendJson(res, 400, { error: "Referral code invalid." });
          return;
        }
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await createUserWithPassword({ fullName, email, passwordHash });
      const userReferralCode = await ensureUserReferralCode(user.id);
      let referralApplied = false;
      if (referralCode) {
        const referral = await attachReferralToUser(user.id, referralCode);
        if (!referral.ok && referral.reason !== "empty_code") {
          sendJson(res, 400, { error: `Referral code invalid: ${referral.reason}` });
          return;
        }
        referralApplied = Boolean(referral.applied);
      }
      const session = await createSession(user.id, SESSION_TTL_DAYS);
      setSessionCookie(req, res, session.token, session.expiresAt);
      sendJson(res, 201, {
        ok: true,
        referralApplied,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          authProvider: user.authProvider,
          referralCode: userReferralCode,
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

  if (req.method === "POST" && pathname === "/api/waitlist") {
    try {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      if (!isValidEmail(email)) {
        sendJson(res, 400, { error: "Please enter a valid email address." });
        return;
      }
      await sendWaitlistEmail({ email, req });
      const waitlistCount = await incrementWaitlistCount();
      sendJson(res, 200, { ok: true, waitlistCount });
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Failed to submit waitlist request." });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/waitlist/count") {
    try {
      const waitlistCount = await getWaitlistCount();
      sendJson(res, 200, { waitlistCount });
    } catch (err) {
      sendJson(res, 500, { error: err.message || "Failed to load waitlist count." });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/auth/google") {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      sendRedirect(res, authRedirectUrl("signup", "google_oauth_not_configured", "missing_client_config"));
      return;
    }

    const source = parsed.searchParams.get("source") === "signin" ? "signin" : "signup";
    const referralCode =
      source === "signup" ? String(parsed.searchParams.get("referralCode") || "").trim().toUpperCase() : "";
    const oauthSource = source === "signin" ? "signin" : referralCode ? `signup:ref:${referralCode}` : "signup";
    const redirectTo = "/";
    const stateParam = await createOAuthState({ source: oauthSource, redirectTo });
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
    const parsedSource = parseGoogleAuthStateSource(consumed.ok ? consumed.value.source : "");
    const source = parsedSource.source;
    const referralCodeFromState = parsedSource.referralCode;
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
      if (source === "signup" && referralCodeFromState) {
        const referral = await attachReferralToUser(user.id, referralCodeFromState);
        if (!referral.ok && referral.reason !== "already_referred") {
          sendRedirect(res, authRedirectUrl(source, "invalid_referral_code", referral.reason));
          return;
        }
      }
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
      sendRedirect(res, authUrl);
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
    await ensureUserReferralCode(user.id);
    const freshUser = (await findUserById(user.id)) || user;
    const state = bindStateToUser(await getStateForUser(user.id), freshUser);
    updateOnboardingCompletion(state);
    await saveStateForUser(user.id, state);
    sendJson(res, 200, await accountSummaryWithReferral(user.id, state));
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
      sendJson(res, 200, await accountSummaryWithReferral(user.id, state));
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
      if (!state.user.createdAt) {
        sendJson(res, 400, { error: "Create account first" });
        return;
      }

      updateOnboardingCompletion(state);
      await saveStateForUser(user.id, state);
      sendJson(res, 200, await accountSummaryWithReferral(user.id, state));
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
      sendJson(res, 200, await accountSummaryWithReferral(user.id, state));
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
        allow_promotion_codes: true,
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
        if (String(obj.payment_status || "").toLowerCase() === "paid") {
          await processReferralRewardForInvitee(user, state);
        }
      }

      if (event.type === "invoice.paid") {
        markBillingPaid(state, {
          customerId: typeof obj.customer === "string" ? obj.customer : null,
          subscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
        });
        try {
          await applyPendingReferralCredits(user, state, "Applied referral free month credit");
        } catch (creditErr) {
          state.user.billing.referralCreditsLastError = String(creditErr?.message || creditErr);
        }

        // Reward referrals only after the invitee's first successful paid invoice.
        await processReferralRewardForInvitee(user, state);
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
      sendJson(res, 200, await accountSummaryWithReferral(user.id, state));
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
    await ensureProfileDataDeduped(user.id, state);
    sendJson(res, 200, summarizeAnalytics(state.posts));
    return;
  }

  // Single round-trip for the analytics page. Returns summary + posts + a
  // couple of TTL hints the client can use to decide whether to trigger a
  // background refresh. Skipping ?refresh=1 lets the client render from
  // cache instantly and then request a fresh version in the background.
  if (req.method === "GET" && pathname === "/api/analytics/bundle") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    const refreshParam = parsed.searchParams.get("refresh");
    const wantsRefresh = refreshParam === "1" || refreshParam === "true";
    const needsRefresh = await shouldRefreshProfileData(state);
    // Always refresh when the cache is empty — nothing to render otherwise.
    const hasCachedPosts = Array.isArray(state.posts) && state.posts.length > 0;
    if (wantsRefresh || !hasCachedPosts) {
      // `?refresh=1` must bypass the posts TTL; otherwise a sync from <20m ago
      // would skip the IG refetch and analytics would keep frozen metrics.
      await ensureProfileDataDeduped(user.id, state, {
        forcePostsRefresh: Boolean(wantsRefresh),
      });
    }
    const limit = Number(parsed.searchParams.get("limit") || 0);
    const posts =
      Number.isFinite(limit) && limit > 0 ? state.posts.slice(0, limit) : state.posts;
    sendJson(res, 200, {
      summary: summarizeAnalytics(state.posts),
      posts,
      fresh: wantsRefresh || !hasCachedPosts,
      staleHint: needsRefresh && !(wantsRefresh || !hasCachedPosts),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/creator/profile") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    const language = parsed.searchParams.get("language") || "en";
    sendJson(res, 200, buildCreatorProfile(state, language));
    return;
  }

  if (req.method === "GET" && pathname === "/api/posts/recent") {
    const user = await requireAuth(req, res);
    if (!user) return;
    const state = bindStateToUser(await getStateForUser(user.id), user);
    await ensureProfileDataDeduped(user.id, state);
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
          error: "Payment required. Complete your 9 Euro/month subscription to use the AI coach.",
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
    // Heartbeat + safe-end helpers. These make sure the client ALWAYS gets a
    // `done` event and the socket is always closed, even when something
    // between res.writeHead() and res.end() throws (previously that left the
    // SSE stream half-open and the UI stuck on the "Thinking…" pill forever).
    let heartbeat = null;
    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };
    const startHeartbeat = () => {
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        try {
          if (!res.writableEnded) res.write(": ping\n\n");
        } catch (_e) { /* socket closed */ }
      }, 15000);
    };
    const safeEnd = (action, fallbackToken) => {
      stopHeartbeat();
      if (res.writableEnded) return;
      try {
        if (fallbackToken) {
          res.write(`data: ${JSON.stringify({ token: fallbackToken })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true, action: action || "ai_reply" })}\n\n`);
      } catch (_e) { /* socket closed */ }
      try { res.end(); } catch (_e) { /* socket closed */ }
    };

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

      // Open the SSE stream before doing any heavy lifting so the client
      // gets immediate feedback ("Thinking…") instead of a blank pause while
      // we backfill profile data or spin up the LLM.
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      if (res.socket) res.socket.setNoDelay(true);
      res.write(`data: ${JSON.stringify({ status: "thinking" })}\n\n`);
      startHeartbeat();

      // If the profile/posts cache is stale we refresh it here. Show a
      // dedicated status so the user knows we're fetching fresh data from IG.
      // We wrap the whole prep phase in a try so a single bad token / DB blip
      // doesn't orphan the stream — the user still gets a clean error bubble.
      let voiceProfile;
      let convo;
      try {
        if (await shouldRefreshProfileData(state)) {
          res.write(`data: ${JSON.stringify({ status: "checking_profile" })}\n\n`);
        }
        const backfilled = await ensureProfileData(state);
        if (backfilled) await saveStateForUser(user.id, state);
        voiceProfile = state.voiceProfile || buildVoiceProfile(state.posts);
        state.voiceProfile = voiceProfile;
        convo = getConversation(state, sessionId);
        convo.push({ role: "user", content: message, at: nowIso() });
      } catch (prepErr) {
        console.error("[PostPilot][AI] prep error:", prepErr?.message);
        safeEnd("provider_error", "I hit a snag preparing your profile data. Try again in a moment.");
        return;
      }

      let fullContent = "";
      try {
        for await (const event of streamAgentReply({
          message,
          history: convo,
          state,
          userId: user.id,
          sessionId,
          language,
        })) {
          // streamAgentReply yields typed events so we can surface live
          // agent status ("searching the internet", "analyzing posts", …)
          // to the client without mixing it into the token stream.
          if (event && event.type === "status" && event.value) {
            res.write(`data: ${JSON.stringify({ status: event.value })}\n\n`);
            continue;
          }
          const token = event && event.type === "token" ? event.value : "";
          if (!token) continue;
          fullContent += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        if (!fullContent) {
          // LLM finished without producing any text — never leave the user
          // staring at an empty bubble.
          console.warn("[PostPilot][AI] provider returned empty response");
          safeEnd(
            "provider_error",
            "The AI provider returned no response. Please try again.",
          );
        } else {
          safeEnd("ai_reply");
        }
      } catch (streamErr) {
        console.error("[PostPilot][AI] stream error", streamErr?.message);
        safeEnd(
          "provider_error",
          fullContent ? null : "I could not reach the AI provider. Please try again.",
        );
      }

      // Persist the user's message regardless of whether the assistant
      // replied successfully. Otherwise, a failed AI call would make the
      // user's own message disappear on refresh (reload pulls from DB,
      // which never saw the push). The assistant message is only persisted
      // when we actually got content from the provider.
      if (fullContent) {
        convo.push({ role: "assistant", content: fullContent, at: nowIso(), action: "ai_reply" });
      }
      try {
        await saveStateForUser(user.id, state);
      } catch (saveErr) {
        console.error("[PostPilot][AI] save state after reply failed:", saveErr?.message);
      }
    } catch (err) {
      console.error("[PostPilot][AI] stream handler error:", err?.message);
      if (res.headersSent) {
        // Stream was already open — the client is waiting for `done`. Send
        // a friendly error bubble so the UI isn't stuck spinning forever.
        safeEnd("provider_error", "Something went wrong. Please try again.");
      } else {
        stopHeartbeat();
        sendJson(res, 400, { error: err.message });
      }
    } finally {
      stopHeartbeat();
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
    // Boot-time config summary — helps answer "is feature X actually
    // configured?" without digging through the dashboard.
    const flag = (v) => (v ? "set" : "MISSING");
    console.log(
      `[PostPilot][boot] AI_PROVIDER=${process.env.AI_PROVIDER || "crewai"} ` +
        `CREWAI_API_URL=${flag(process.env.CREWAI_API_URL)} ` +
        `OPENAI_API_KEY=${flag(process.env.OPENAI_API_KEY)} ` +
        `ANTHROPIC_API_KEY=${flag(process.env.ANTHROPIC_API_KEY)} ` +
        `TAVILY_API_KEY=${flag(process.env.TAVILY_API_KEY)}`,
    );
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
