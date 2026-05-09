export interface RawPost {
  postId: string;
  text: string;
  url: string;
  postedAt: Date | null;
}

interface ApifyPostItem {
  pk?: string;
  shortcode?: string;
  caption?: string;
  date?: string;
  post_url?: string;
  error?: string;
  errorDescription?: string;
}

interface ApifyRunResponse {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
  };
}

const APIFY_BASE_URL = "https://api.apify.com/v2";
const ACTOR_ID = "instagram-scraper~fast-instagram-post-scraper";
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 5 * 60 * 1000;

function getApiToken(): string | null {
  const token = process.env["APIFY_API_TOKEN"]?.trim();
  if (!token) {
    console.warn(
      "[instagram/apify] APIFY_API_TOKEN is not set. " +
        "Get a token at https://console.apify.com/settings/integrations and add it as a secret."
    );
    return null;
  }
  return token;
}

async function startActorRun(
  token: string,
  username: string,
  limit: number
): Promise<string | null> {
  const url = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${token}`;
  const body = { username: [username], resultsLimit: limit };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`[instagram/apify] Network error starting actor run for ${username}:`, err);
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<unreadable>");
    console.error(
      `[instagram/apify] Failed to start actor run for ${username}: HTTP ${res.status}. Body: ${text.slice(0, 400)}`
    );
    return null;
  }

  let data: ApifyRunResponse;
  try {
    data = (await res.json()) as ApifyRunResponse;
  } catch (err) {
    console.error(`[instagram/apify] Failed to parse start response for ${username}:`, err);
    return null;
  }

  const runId = data.data?.id;
  if (!runId) {
    console.error(`[instagram/apify] No run ID returned for ${username}`);
    return null;
  }

  console.log(`[instagram/apify] Started actor run ${runId} for ${username}`);
  return runId;
}

async function waitForRun(
  token: string,
  runId: string,
  username: string
): Promise<string | null> {
  const deadline = Date.now() + MAX_WAIT_MS;
  const pollUrl = `${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let res: Response;
    try {
      res = await fetch(pollUrl);
    } catch (err) {
      console.error(`[instagram/apify] Network error polling run ${runId}:`, err);
      continue;
    }

    if (!res.ok) {
      console.error(`[instagram/apify] Poll failed for run ${runId}: HTTP ${res.status}`);
      continue;
    }

    let data: ApifyRunResponse;
    try {
      data = (await res.json()) as ApifyRunResponse;
    } catch {
      continue;
    }

    const status = data.data?.status;
    const datasetId = data.data?.defaultDatasetId;

    if (status === "SUCCEEDED") {
      console.log(`[instagram/apify] Run ${runId} succeeded for ${username}`);
      return datasetId ?? null;
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      console.error(
        `[instagram/apify] Run ${runId} ended with status ${status} for ${username}`
      );
      return null;
    }

    console.log(`[instagram/apify] Run ${runId} status: ${status} — waiting...`);
  }

  console.error(
    `[instagram/apify] Timed out waiting for run ${runId} for ${username} after ${MAX_WAIT_MS / 1000}s`
  );
  return null;
}

async function fetchDatasetItems(
  token: string,
  datasetId: string,
  username: string,
  limit: number
): Promise<ApifyPostItem[]> {
  const url = `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${token}&limit=${limit}&clean=true`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`[instagram/apify] Network error fetching dataset ${datasetId}:`, err);
    return [];
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<unreadable>");
    console.error(
      `[instagram/apify] Failed to fetch dataset ${datasetId}: HTTP ${res.status}. Body: ${text.slice(0, 400)}`
    );
    return [];
  }

  let items: ApifyPostItem[];
  try {
    items = (await res.json()) as ApifyPostItem[];
  } catch (err) {
    console.error(`[instagram/apify] Failed to parse dataset response for ${username}:`, err);
    return [];
  }

  return Array.isArray(items) ? items : [];
}

export async function fetchInstagramPosts(handle: string, limit = 20): Promise<RawPost[]> {
  const token = getApiToken();
  if (!token) return [];

  const username = handle.replace(/^@/, "").trim();
  if (!username) {
    console.error("[instagram/apify] Empty handle provided.");
    return [];
  }

  const runId = await startActorRun(token, username, limit);
  if (!runId) return [];

  const datasetId = await waitForRun(token, runId, username);
  if (!datasetId) return [];

  const items = await fetchDatasetItems(token, datasetId, username, limit);

  const posts: RawPost[] = [];
  for (const item of items) {
    if (item.error || item.errorDescription) {
      console.warn(
        `[instagram/apify] ${username}: skipping error item — ${item.error ?? item.errorDescription}`
      );
      continue;
    }

    const text = item.caption?.trim();
    if (!text) continue;

    const url =
      item.post_url ??
      (item.shortcode ? `https://www.instagram.com/p/${item.shortcode}/` : null);
    if (!url) continue;

    const postId = item.pk ?? item.shortcode ?? url;
    const postedAt = item.date ? new Date(item.date) : null;

    posts.push({ postId, text, url, postedAt });
  }

  console.log(
    `[instagram/apify] ${username}: ${posts.length} posts with captions out of ${items.length} items`
  );
  return posts;
}
