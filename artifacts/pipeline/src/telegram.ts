export interface RawPost {
  postId: string;
  text: string;
  url: string;
  postedAt: Date | null;
}

function getTelegramCredentials(): { apiId: number; apiHash: string; session: string } | null {
  const apiIdStr = process.env["TELEGRAM_API_ID"];
  const apiHash = process.env["TELEGRAM_API_HASH"];
  const session = process.env["TELEGRAM_SESSION"] ?? "";

  if (!apiIdStr || !apiHash) {
    return null;
  }

  const apiId = parseInt(apiIdStr, 10);
  if (isNaN(apiId)) {
    return null;
  }

  return { apiId, apiHash, session };
}

export async function fetchTelegramPosts(handle: string, limit = 20): Promise<RawPost[]> {
  const creds = getTelegramCredentials();
  if (!creds) {
    console.warn(
      `[telegram] Skipping ${handle}: TELEGRAM_API_ID and TELEGRAM_API_HASH env vars are required. ` +
      `Obtain them from https://my.telegram.org and set them in your environment.`
    );
    return [];
  }

  try {
    const { TelegramClient } = await import("telegram");
    const { StringSession } = await import("telegram/sessions/index.js");

    const { apiId, apiHash, session } = creds;
    const stringSession = new StringSession(session);

    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 3,
    });

    await client.connect();

    const channel = handle.startsWith("@") ? handle : `@${handle}`;
    const messages = await client.getMessages(channel, { limit });

    const posts: RawPost[] = [];
    for (const msg of messages) {
      if (!msg.message || msg.message.trim().length === 0) continue;

      const msgId = String(msg.id);
      const channelUsername = handle.replace(/^@/, "");
      const url = `https://t.me/${channelUsername}/${msgId}`;

      posts.push({
        postId: msgId,
        text: msg.message,
        url,
        postedAt: msg.date ? new Date(msg.date * 1000) : null,
      });
    }

    await client.disconnect();
    return posts;
  } catch (err) {
    console.error(`[telegram] Error fetching posts from ${handle}:`, err);
    return [];
  }
}
