import type { Source } from "@workspace/db";
import { fetchTelegramPosts } from "./telegram.js";
import { fetchInstagramPosts } from "./instagram.js";
import { extractPromotion, PROMPT_VERSION } from "./llm.js";
import { isDuplicate, insertPromotion, logRun } from "./db.js";

export interface RunStats {
  source: string;
  platform: string;
  recordsFetched: number;
  recordsInserted: number;
  error: string | null;
}

async function fetchPosts(source: Source) {
  if (source.platform === "Telegram") {
    return fetchTelegramPosts(source.handle, 20);
  } else if (source.platform === "Instagram") {
    return fetchInstagramPosts(source.handle, 20);
  }
  console.warn(`[pipeline] Unknown platform "${source.platform}" for source ${source.name}`);
  return [];
}

export async function runForSource(source: Source): Promise<RunStats> {
  console.log(`[pipeline] Processing source: ${source.name} (${source.platform} / ${source.handle})`);

  let recordsFetched = 0;
  let recordsInserted = 0;
  let errorMsg: string | null = null;

  try {
    const posts = await fetchPosts(source);
    recordsFetched = posts.length;
    console.log(`[pipeline] Fetched ${recordsFetched} posts from ${source.handle}`);

    for (const post of posts) {
      try {
        const alreadyExists = await isDuplicate(post.url);
        if (alreadyExists) {
          console.log(`[pipeline] Duplicate skipped: ${post.url}`);
          continue;
        }

        const extraction = await extractPromotion(post.text);

        await insertPromotion({
          operator: source.name,
          platform: source.platform,
          postDate: post.postedAt ?? undefined,
          promoType: extraction.promo_type,
          offerDetails: extraction.offer_details,
          minDeposit: extraction.min_deposit,
          rewardValue: extraction.reward_value,
          wageringRequirement: extraction.wagering_requirement,
          expiryDate: extraction.expiry_date ?? undefined,
          targetAudience: extraction.target_audience,
          requiresDeposit: extraction.requires_deposit,
          sourceUrl: post.url,
          rawPostText: post.text,
          confidenceScore: extraction.confidence_score,
          promptVersion: PROMPT_VERSION,
        });

        recordsInserted++;
        console.log(`[pipeline] Inserted promotion from ${post.url} (confidence: ${extraction.confidence_score})`);
      } catch (postErr) {
        const msg = postErr instanceof Error ? postErr.message : String(postErr);
        const cause = postErr instanceof Error && postErr.cause
          ? (postErr.cause instanceof Error ? `${postErr.cause.message}` : String(postErr.cause))
          : null;
        const fullMsg = cause ? `${msg} | cause: ${cause}` : msg;
        console.error(`[pipeline] Error processing post ${post.url}: ${fullMsg}`);
        errorMsg = errorMsg ? `${errorMsg}; ${fullMsg}` : fullMsg;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] Fatal error for source ${source.name}:`, msg);
    errorMsg = msg;
  }

  await logRun({
    source: source.name,
    platform: source.platform,
    status: errorMsg && recordsInserted === 0 ? "error" : "success",
    recordsFetched,
    recordsInserted,
    errorMessage: errorMsg,
  });

  return {
    source: source.name,
    platform: source.platform,
    recordsFetched,
    recordsInserted,
    error: errorMsg,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runPipeline(): Promise<void> {
  console.log(`[pipeline] Starting pipeline run at ${new Date().toISOString()}`);

  const { getActiveSources } = await import("./db.js");
  const sources = await getActiveSources();

  if (sources.length === 0) {
    console.log("[pipeline] No active sources found. Add sources to the database to begin scraping.");
    return;
  }

  console.log(`[pipeline] Found ${sources.length} active source(s)`);

  const interSourceDelayMs = Number(process.env["PIPELINE_INTER_SOURCE_DELAY_MS"] ?? "3000");

  const results: RunStats[] = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]!;
    const stats = await runForSource(source);
    results.push(stats);
    if (i < sources.length - 1 && interSourceDelayMs > 0) {
      await sleep(interSourceDelayMs);
    }
  }

  const totalFetched = results.reduce((sum, r) => sum + r.recordsFetched, 0);
  const totalInserted = results.reduce((sum, r) => sum + r.recordsInserted, 0);
  const errors = results.filter((r) => r.error !== null);

  console.log(`\n[pipeline] Run complete:`);
  console.log(`  Sources processed: ${results.length}`);
  console.log(`  Total posts fetched: ${totalFetched}`);
  console.log(`  Total promotions inserted: ${totalInserted}`);
  if (errors.length > 0) {
    console.log(`  Sources with errors: ${errors.map((r) => r.source).join(", ")}`);
  }
  console.log(`[pipeline] Done at ${new Date().toISOString()}\n`);
}
