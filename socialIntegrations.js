function normalizePlatform(platform) {
  const raw = String(platform || "").trim().toLowerCase();
  if (raw === "linkedin" || raw === "instagram") return raw;
  return "";
}

function getPlatformConfig(platform) {
  if (platform === "linkedin") {
    return {
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      clientId: process.env.LINKEDIN_CLIENT_ID || "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
      scopes: (process.env.LINKEDIN_SCOPES || "r_liteprofile r_emailaddress w_member_social")
        .split(/[,\s]+/)
        .filter(Boolean),
    };
  }
  if (platform === "instagram") {
    return {
      authorizeUrl: "https://www.instagram.com/oauth/authorize",
      tokenUrl: "https://api.instagram.com/oauth/access_token",
      clientId: process.env.INSTAGRAM_CLIENT_ID || "",
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || "",
      scopes: (process.env.INSTAGRAM_SCOPES || "instagram_business_basic").split(/[,\s]+/).filter(Boolean),
    };
  }
  return null;
}

function ensurePlatformConfigured(platform) {
  const cfg = getPlatformConfig(platform);
  if (!cfg) throw new Error("unsupported_platform");
  if (!cfg.clientId || !cfg.clientSecret) throw new Error(`${platform}_oauth_not_configured`);
  return cfg;
}

function buildAuthUrl({ platform, redirectUri, state }) {
  const cfg = ensurePlatformConfigured(platform);
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  if (platform === "linkedin") {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", cfg.scopes.join(" "));
  } else {
    url.searchParams.set("scope", cfg.scopes.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("enable_fb_login", "0");
  }
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCodeForToken({ platform, code, redirectUri }) {
  const cfg = ensurePlatformConfigured(platform);
  let body;
  if (platform === "linkedin") {
    body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
  } else {
    body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
  }
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    throw new Error(`${platform}_token_exchange_failed_${tokenRes.status}`);
  }
  const data = await tokenRes.json();
  const accessToken = data.access_token;
  if (!accessToken) throw new Error(`${platform}_missing_access_token`);
  return {
    accessToken,
    expiresIn: Number(data.expires_in || 0),
    refreshToken: data.refresh_token || null,
  };
}

async function fetchLinkedInProfile(accessToken) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`linkedin_profile_failed_${res.status}`);
  const data = await res.json();
  const avatarUrl =
    (typeof data.picture === "string" && data.picture) ||
    (typeof data.profile_picture === "string" && data.profile_picture) ||
    "";
  return {
    id: data.sub || data.id || "",
    username: data.name || data.email || "linkedin-user",
    urn: data.sub ? `urn:li:person:${data.sub}` : "",
    avatarUrl,
  };
}

async function fetchLinkedInPostsAndAnalytics(accessToken, profile) {
  const author = encodeURIComponent(profile.urn || "");
  if (!author) throw new Error("linkedin_profile_missing_urn");
  const postsRes = await fetch(
    `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${author})&count=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!postsRes.ok) throw new Error(`linkedin_posts_failed_${postsRes.status}`);
  const postsData = await postsRes.json();
  const elements = Array.isArray(postsData.elements) ? postsData.elements : [];

  const posts = [];
  for (const element of elements) {
    const text = element?.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text || "";
    const postUrn = element.id || "";
    let likes = 0;
    let comments = 0;
    if (postUrn) {
      const socialRes = await fetch(
        `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (socialRes.ok) {
        const social = await socialRes.json();
        likes = Number(social?.likesSummary?.totalLikes || 0);
        comments = Number(social?.commentsSummary?.totalFirstLevelComments || 0);
      }
    }
    posts.push({
      platform: "linkedin",
      text,
      likes,
      comments,
      impressions: 0,
      postedAt: element.created?.time ? new Date(Number(element.created.time)).toISOString() : new Date().toISOString(),
    });
  }
  return posts;
}

async function fetchInstagramProfile(accessToken) {
  const extendedFields =
    "user_id,username,name,account_type,profile_picture_url,biography,followers_count,follows_count,media_count,website";
  const basicFields = "user_id,username,name,account_type,profile_picture_url";

  let data;
  const extRes = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=${extendedFields}&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (extRes.ok) {
    data = await extRes.json();
  } else {
    const errBody = await extRes.text().catch(() => "");
    console.error(`[PostPilot][IG] Extended profile fields failed (${extRes.status}), falling back to basic. Body: ${errBody.slice(0, 300)}`);
    const basicRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=${basicFields}&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!basicRes.ok) throw new Error(`instagram_profile_failed_${basicRes.status}`);
    data = await basicRes.json();
  }

  return {
    id: data.user_id || data.id || "",
    username: data.username || "instagram-user",
    avatarUrl: data.profile_picture_url || "",
    name: data.name || "",
    bio: data.biography ?? "",
    followersCount: data.followers_count ?? null,
    followsCount: data.follows_count ?? null,
    mediaCount: data.media_count ?? null,
    website: data.website || "",
    accountType: data.account_type || "",
  };
}

async function fetchInstagramPostsAndAnalytics(accessToken) {
  const mediaRes = await fetch(
    `https://graph.instagram.com/v21.0/me/media?fields=id,caption,timestamp,like_count,comments_count,media_type,permalink&limit=20&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!mediaRes.ok) {
    const errBody = await mediaRes.text().catch(() => "");
    console.error(`[PostPilot][IG] Media fetch failed (${mediaRes.status}): ${errBody.slice(0, 300)}`);
    throw new Error(`instagram_posts_failed_${mediaRes.status}`);
  }
  const mediaData = await mediaRes.json();
  const items = Array.isArray(mediaData.data) ? mediaData.data : [];
  return items.map((item) => ({
    platform: "instagram",
    text: item.caption || "",
    likes: Number(item.like_count || 0),
    comments: Number(item.comments_count || 0),
    impressions: 0,
    postedAt: item.timestamp || new Date().toISOString(),
    mediaType: item.media_type || "",
    permalink: item.permalink || "",
  }));
}

async function fetchPlatformProfile({ platform, accessToken }) {
  if (platform === "linkedin") return fetchLinkedInProfile(accessToken);
  if (platform === "instagram") return fetchInstagramProfile(accessToken);
  throw new Error("unsupported_platform");
}

async function fetchPlatformPostsAndAnalytics({ platform, accessToken, profile }) {
  if (platform === "linkedin") return fetchLinkedInPostsAndAnalytics(accessToken, profile);
  if (platform === "instagram") return fetchInstagramPostsAndAnalytics(accessToken);
  throw new Error("unsupported_platform");
}

async function exchangeForLongLivedToken(shortLivedToken) {
  const cfg = getPlatformConfig("instagram");
  if (!cfg?.clientSecret) throw new Error("instagram_oauth_not_configured");
  const url = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(cfg.clientSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[PostPilot][IG] Long-lived token exchange failed (${res.status}): ${body.slice(0, 300)}`);
    return null;
  }
  const data = await res.json();
  if (!data.access_token) return null;
  console.log(`[PostPilot][IG] Exchanged for long-lived token (expires_in: ${data.expires_in}s)`);
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in || 0),
  };
}

async function refreshLongLivedToken(currentToken) {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(currentToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[PostPilot][IG] Token refresh failed (${res.status}): ${body.slice(0, 300)}`);
    return null;
  }
  const data = await res.json();
  if (!data.access_token) return null;
  console.log(`[PostPilot][IG] Refreshed long-lived token (expires_in: ${data.expires_in}s)`);
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in || 0),
  };
}

module.exports = {
  normalizePlatform,
  buildAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  refreshLongLivedToken,
  fetchPlatformProfile,
  fetchPlatformPostsAndAnalytics,
};
