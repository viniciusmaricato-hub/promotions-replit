export interface RawPost {
  postId: string;
  text: string;
  url: string;
  postedAt: Date | null;
}

interface InstagramFeedItem {
  pk: string | number;
  code?: string;
  caption?: { text?: string } | null;
  taken_at?: number;
  media_type?: number;
  carousel_media?: Array<{ caption?: { text?: string } | null }>;
}

interface InstagramFeedResponse {
  items?: InstagramFeedItem[];
  status?: string;
  message?: string;
}

interface InstagramProfileResponse {
  data?: {
    user?: {
      id?: string;
      username?: string;
    };
  };
  status?: string;
  message?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const IG_APP_ID = "936619743392459";

interface SessionContext {
  sessionId: string;
  dsUserId: string | null;
  csrfToken: string;
}

function generateCsrfToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function extractDsUserId(sessionId: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(sessionId);
  } catch {
    decoded = sessionId;
  }
  const colonIdx = decoded.indexOf(":");
  if (colonIdx <= 0) return null;
  const candidate = decoded.slice(0, colonIdx);
  return /^\d+$/.test(candidate) ? candidate : null;
}

function sanitizeCookieValue(name: string, value: string): string | null {
  if (/[\r\n;]/.test(value)) {
    console.error(`[instagram] ${name} contains invalid characters (CR/LF/;); ignoring.`);
    return null;
  }
  return value;
}

function getSessionContext(): SessionContext | null {
  const raw = process.env["INSTAGRAM_SESSION_ID"];
  if (!raw || raw.trim().length === 0) return null;
  const sessionId = sanitizeCookieValue("INSTAGRAM_SESSION_ID", raw.trim());
  if (!sessionId) return null;

  const csrfRaw = process.env["INSTAGRAM_CSRF_TOKEN"]?.trim();
  const csrfToken = csrfRaw
    ? sanitizeCookieValue("INSTAGRAM_CSRF_TOKEN", csrfRaw) ?? generateCsrfToken()
    : generateCsrfToken();

  const dsRaw = process.env["INSTAGRAM_DS_USER_ID"]?.trim();
  const dsUserId = dsRaw
    ? sanitizeCookieValue("INSTAGRAM_DS_USER_ID", dsRaw)
    : extractDsUserId(sessionId);

  return { sessionId, csrfToken, dsUserId };
}

function buildCookieHeader(ctx: SessionContext): string {
  const parts = [`sessionid=${ctx.sessionId}`, `csrftoken=${ctx.csrfToken}`];
  if (ctx.dsUserId) parts.push(`ds_user_id=${ctx.dsUserId}`);
  parts.push("ig_did=00000000-0000-0000-0000-000000000000");
  return parts.join("; ");
}

function buildHeaders(username: string, ctx: SessionContext): Record<string, string> {
  return {
    "Cookie": buildCookieHeader(ctx),
    "User-Agent": USER_AGENT,
    "X-IG-App-ID": IG_APP_ID,
    "X-ASBD-ID": "129477",
    "X-IG-WWW-Claim": "0",
    "X-CSRFToken": ctx.csrfToken,
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": `https://www.instagram.com/${username}/`,
    "Origin": "https://www.instagram.com",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };
}

async function readBodySafe(res: Response, max = 400): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, max);
  } catch {
    return "<unreadable>";
  }
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

function logAuthChallenge(username: string, location: string | null): void {
  console.error(
    `[instagram] Auth challenge for ${username}: Instagram redirected to ` +
    `${location ?? "<no Location header>"}. This typically means Instagram does not trust the ` +
    `session from this server's IP address. Common causes:\n` +
    `  - The session cookie was created on a different IP and Instagram requires a re-login challenge\n` +
    `  - This server's IP is blocked or flagged as a datacenter IP\n` +
    `  - The session has been invalidated (log out events, password change, security alerts)\n` +
    `Workarounds:\n` +
    `  - Log in to Instagram from this server's region/IP if possible, then capture a fresh sessionid\n` +
    `  - Set INSTAGRAM_DS_USER_ID and INSTAGRAM_CSRF_TOKEN env vars to the values from your browser cookies\n` +
    `  - Route requests through a residential proxy or use a third-party scraping service`
  );
}

async function igFetch(url: string, headers: Record<string, string>): Promise<Response> {
  return fetch(url, { headers, redirect: "manual" });
}

async function lookupUserId(username: string, ctx: SessionContext): Promise<string | null> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const res = await igFetch(url, buildHeaders(username, ctx));

  if (res.status >= 300 && res.status < 400) {
    logAuthChallenge(username, res.headers.get("location"));
    return null;
  }

  if (!res.ok) {
    const body = await readBodySafe(res);
    if (isAuthFailure(res.status)) {
      console.error(
        `[instagram] Auth failed (HTTP ${res.status}) looking up ${username}. ` +
        `Your INSTAGRAM_SESSION_ID cookie is invalid, expired, or not trusted from this IP. ` +
        `Body: ${body}`
      );
    } else if (res.status === 429) {
      console.error(`[instagram] Rate limited (HTTP 429) looking up ${username}. Body: ${body}`);
    } else {
      console.error(`[instagram] Profile lookup failed for ${username}: HTTP ${res.status}. Body: ${body}`);
    }
    return null;
  }

  let data: InstagramProfileResponse;
  try {
    data = (await res.json()) as InstagramProfileResponse;
  } catch (err) {
    console.error(`[instagram] Profile JSON parse failed for ${username}:`, err);
    return null;
  }

  const userId = data.data?.user?.id;
  if (!userId) {
    console.error(
      `[instagram] No user ID returned for ${username}. ` +
      `status=${data.status ?? "n/a"} message=${data.message ?? "n/a"}`
    );
    return null;
  }
  return userId;
}

function extractCaption(item: InstagramFeedItem): string {
  const direct = item.caption?.text?.trim();
  if (direct) return direct;
  const carouselCaption = item.carousel_media?.find((m) => m.caption?.text?.trim())?.caption?.text;
  return carouselCaption?.trim() ?? "";
}

async function fetchUserFeed(
  username: string,
  userId: string,
  ctx: SessionContext,
  limit: number,
): Promise<InstagramFeedItem[]> {
  const url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=${limit}`;
  const res = await igFetch(url, buildHeaders(username, ctx));

  if (res.status >= 300 && res.status < 400) {
    logAuthChallenge(username, res.headers.get("location"));
    return [];
  }

  if (!res.ok) {
    const body = await readBodySafe(res);
    if (isAuthFailure(res.status)) {
      console.error(
        `[instagram] Auth failed (HTTP ${res.status}) fetching feed for ${username}. ` +
        `Body: ${body}`
      );
    } else if (res.status === 429) {
      console.error(`[instagram] Rate limited (HTTP 429) fetching feed for ${username}. Body: ${body}`);
    } else {
      console.error(`[instagram] Feed fetch failed for ${username}: HTTP ${res.status}. Body: ${body}`);
    }
    return [];
  }

  let data: InstagramFeedResponse;
  try {
    data = (await res.json()) as InstagramFeedResponse;
  } catch (err) {
    console.error(`[instagram] Feed JSON parse failed for ${username}:`, err);
    return [];
  }

  if (data.status && data.status !== "ok") {
    console.error(
      `[instagram] Feed API returned non-ok status for ${username}: ` +
      `${data.status} ${data.message ?? ""}`
    );
    return [];
  }

  return data.items ?? [];
}

export async function fetchInstagramPosts(handle: string, limit = 20): Promise<RawPost[]> {
  const ctx = getSessionContext();
  if (!ctx) {
    console.warn(
      `[instagram] Skipping ${handle}: INSTAGRAM_SESSION_ID env var is required. ` +
      `Log in to Instagram in a browser, copy the 'sessionid' cookie value, and set it in your environment.`
    );
    return [];
  }

  const username = handle.replace(/^@/, "").trim();
  if (!username) {
    console.error(`[instagram] Empty handle provided.`);
    return [];
  }

  try {
    const userId = await lookupUserId(username, ctx);
    if (!userId) return [];

    const items = await fetchUserFeed(username, userId, ctx, limit);

    const posts: RawPost[] = [];
    for (const item of items.slice(0, limit)) {
      const caption = extractCaption(item);
      if (!caption) continue;

      const code = item.code ?? String(item.pk);
      posts.push({
        postId: String(item.pk),
        text: caption,
        url: `https://www.instagram.com/p/${code}/`,
        postedAt: typeof item.taken_at === "number" ? new Date(item.taken_at * 1000) : null,
      });
    }

    console.log(`[instagram] ${username}: ${posts.length} posts with captions out of ${items.length} fetched`);
    return posts;
  } catch (err) {
    console.error(`[instagram] Unexpected error fetching posts for ${username}:`, err);
    return [];
  }
}
