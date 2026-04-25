const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();
const APP_STATE_ID = 1;
const DEFAULT_SESSION_TTL_DAYS = 14;
const OAUTH_STATE_TTL_MINUTES = 10;
const DEFAULT_WAITLIST_COUNT = 57;

const defaultState = Object.freeze({
  user: {
    createdAt: null,
    name: "",
    email: "",
    onboardingCompleted: false,
    billing: {
      status: "unpaid",
      plan: "monthly",
      amountEur: 30,
      currency: "EUR",
      interval: "month",
      paidAt: null,
    },
  },
  integrations: {
    linkedin: { connected: false, username: null, token: null, lastSyncAt: null },
    instagram: { connected: false, username: null, token: null, lastSyncAt: null },
  },
  posts: [],
  voiceProfile: null,
  conversations: {},
});

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function normalizeState(value) {
  const base = cloneDefaultState();
  const incoming = value && typeof value === "object" ? value : {};
  return {
    ...base,
    ...incoming,
    user: {
      ...base.user,
      ...(incoming.user || {}),
      billing: { ...base.user.billing, ...(incoming.user?.billing || {}) },
    },
    integrations: {
      linkedin: { ...base.integrations.linkedin, ...(incoming.integrations?.linkedin || {}) },
      instagram: { ...base.integrations.instagram, ...(incoming.integrations?.instagram || {}) },
    },
    posts: Array.isArray(incoming.posts) ? incoming.posts : [],
    conversations:
      incoming.conversations && typeof incoming.conversations === "object"
        ? incoming.conversations
        : {},
  };
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function ensureAppState() {
  await prisma.appState.upsert({
    where: { id: APP_STATE_ID },
    update: {},
    create: { id: APP_STATE_ID, data: cloneDefaultState() },
  });
}

async function getWaitlistCount() {
  const row = await prisma.appState.findUnique({
    where: { id: APP_STATE_ID },
    select: { data: true },
  });
  if (!row || !row.data || typeof row.data !== "object") return DEFAULT_WAITLIST_COUNT;
  const raw = Number(row.data.waitlistCount);
  if (!Number.isFinite(raw)) return DEFAULT_WAITLIST_COUNT;
  return Math.max(DEFAULT_WAITLIST_COUNT, Math.floor(raw));
}

async function incrementWaitlistCount() {
  const result = await prisma.$queryRaw`
    UPDATE "AppState"
    SET
      data = jsonb_set(
        COALESCE(data::jsonb, '{}'::jsonb),
        '{waitlistCount}',
        to_jsonb(COALESCE((data->>'waitlistCount')::int, ${DEFAULT_WAITLIST_COUNT}) + 1),
        true
      ),
      "updatedAt" = NOW()
    WHERE id = ${APP_STATE_ID}
    RETURNING COALESCE((data->>'waitlistCount')::int, ${DEFAULT_WAITLIST_COUNT}) AS "waitlistCount"
  `;
  const next = Number(result?.[0]?.waitlistCount);
  if (!Number.isFinite(next)) return DEFAULT_WAITLIST_COUNT + 1;
  return Math.max(DEFAULT_WAITLIST_COUNT + 1, Math.floor(next));
}

async function createUserWithPassword({ fullName, email, passwordHash }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(fullName).trim();
  return prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName: normalizedName,
      passwordHash,
      authProvider: "email",
      state: {
        create: {
          data: normalizeState({
            user: {
              createdAt: new Date().toISOString(),
              name: normalizedName,
              email: normalizedEmail,
            },
          }),
        },
      },
    },
  });
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  return prisma.user.findUnique({ where: { email: normalizedEmail } });
}

async function findUserById(userId) {
  return prisma.user.findUnique({ where: { id: Number(userId) } });
}

async function findUserByGoogleSub(googleSub) {
  return prisma.user.findUnique({ where: { googleSub: String(googleSub) } });
}

async function createOrLinkGoogleUser({ googleSub, email, fullName }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(fullName).trim() || normalizedEmail.split("@")[0] || "Creator";
  const existingBySub = await findUserByGoogleSub(googleSub);
  if (existingBySub) return existingBySub;

  const existingByEmail = await findUserByEmail(normalizedEmail);
  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        googleSub: String(googleSub),
        authProvider: existingByEmail.authProvider === "email" ? "hybrid" : "google",
        fullName: existingByEmail.fullName || normalizedName,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName: normalizedName,
      googleSub: String(googleSub),
      authProvider: "google",
      passwordHash: null,
      state: {
        create: {
          data: normalizeState({
            user: {
              createdAt: new Date().toISOString(),
              name: normalizedName,
              email: normalizedEmail,
            },
          }),
        },
      },
    },
  });
}

async function updateUserProfile(userId, { fullName, email }) {
  const data = {};
  if (typeof fullName === "string") data.fullName = fullName.trim();
  if (typeof email === "string") data.email = email.trim().toLowerCase();
  return prisma.user.update({ where: { id: userId }, data });
}

async function getStateForUser(userId) {
  const row = await prisma.userState.findUnique({
    where: { userId },
    select: { data: true },
  });
  if (!row) {
    const created = await prisma.userState.create({
      data: { userId, data: cloneDefaultState() },
      select: { data: true },
    });
    return normalizeState(created.data);
  }
  return normalizeState(row.data);
}

async function saveStateForUser(userId, nextState) {
  const normalized = normalizeState(nextState);
  await prisma.userState.upsert({
    where: { userId },
    update: { data: normalized },
    create: { userId, data: normalized },
  });
}

async function createSession(userId, ttlDays = DEFAULT_SESSION_TTL_DAYS) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
  return { token: rawToken, expiresAt };
}

async function getSessionUser(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return session.user;
}

async function revokeSession(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function createOAuthState({ source, redirectTo }) {
  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  await prisma.oAuthState.create({
    data: {
      tokenHash,
      source,
      redirectTo,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000),
    },
  });
  return rawToken;
}

async function consumeOAuthState(rawToken) {
  if (!rawToken) return { ok: false, reason: "missing_state" };
  const tokenHash = hashToken(rawToken);
  const row = await prisma.oAuthState.findUnique({ where: { tokenHash } });
  if (!row) return { ok: false, reason: "invalid_state" };
  if (row.usedAt) return { ok: false, reason: "state_already_used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "state_expired" };
  const updated = await prisma.oAuthState.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return { ok: true, value: updated };
}

async function closeDb() {
  await prisma.$disconnect();
}

module.exports = {
  ensureAppState,
  cloneDefaultState,
  normalizeState,
  createUserWithPassword,
  findUserByEmail,
  findUserById,
  findUserByGoogleSub,
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
  closeDb,
};
