export interface RawPost {
  postId: string;
  text: string;
  url: string;
  postedAt: Date | null;
}

interface InstagramGraphQLMedia {
  node: {
    id: string;
    shortcode: string;
    edge_media_to_caption: {
      edges: Array<{ node: { text: string } }>;
    };
    taken_at_timestamp: number;
  };
}

interface InstagramProfileData {
  data: {
    user: {
      edge_owner_to_timeline_media: {
        edges: InstagramGraphQLMedia[];
      };
    };
  };
}

function getInstagramSessionId(): string | null {
  return process.env["INSTAGRAM_SESSION_ID"] ?? null;
}

export async function fetchInstagramPosts(handle: string, limit = 20): Promise<RawPost[]> {
  const sessionId = getInstagramSessionId();
  if (!sessionId) {
    console.warn(
      `[instagram] Skipping ${handle}: INSTAGRAM_SESSION_ID env var is required. ` +
      `Log in to Instagram in a browser, copy the sessionid cookie value, and set it in your environment.`
    );
    return [];
  }

  const username = handle.replace(/^@/, "");

  try {
    const lookupUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const profileRes = await fetch(lookupUrl, {
      headers: {
        "Cookie": `sessionid=${sessionId}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "Accept": "application/json",
        "Referer": `https://www.instagram.com/${username}/`,
      },
    });

    if (!profileRes.ok) {
      console.error(`[instagram] Profile lookup failed for ${username}: HTTP ${profileRes.status}`);
      return [];
    }

    const profileData = await profileRes.json() as InstagramProfileData;
    const userId = (profileData as unknown as { data: { user: { id: string } } }).data?.user?.id;

    if (!userId) {
      console.error(`[instagram] Could not find user ID for ${username}`);
      return [];
    }

    const feedUrl = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=${limit}`;
    const feedRes = await fetch(feedUrl, {
      headers: {
        "Cookie": `sessionid=${sessionId}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "Accept": "application/json",
        "Referer": `https://www.instagram.com/${username}/`,
      },
    });

    if (!feedRes.ok) {
      console.error(`[instagram] Feed fetch failed for ${username}: HTTP ${feedRes.status}`);
      return [];
    }

    const feedData = await feedRes.json() as { items?: Array<{ pk: string; caption?: { text: string }; taken_at: number; code: string }> };
    const items = feedData.items ?? [];
    const posts: RawPost[] = [];

    for (const item of items.slice(0, limit)) {
      const caption = item.caption?.text ?? "";
      if (!caption.trim()) continue;

      posts.push({
        postId: item.pk,
        text: caption,
        url: `https://www.instagram.com/p/${item.code}/`,
        postedAt: item.taken_at ? new Date(item.taken_at * 1000) : null,
      });
    }

    return posts;
  } catch (err) {
    console.error(`[instagram] Error fetching posts from ${username}:`, err);
    return [];
  }
}
