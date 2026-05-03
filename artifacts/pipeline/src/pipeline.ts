import type { Operator } from "@workspace/db";
import { fetchTelegramPosts } from "./telegram.js";
import { fetchInstagramPosts } from "./instagram.js";
import { extractPromotion, PROMPT_VERSION } from "./llm.js";
import { isDuplicate, insertPromotion, logRun, getActiveOperators } from "./db.js";

export interface RunStats {
  source: string;
  platform: string;
  recordsFetched: number;
  recordsInserted: number;
  error: string | null;
}

async function fetchPosts(platform: "Instagram" | "Telegram", handle: string) {
  if (platform === "Telegram") {
    return fetchTelegramPosts(handle, 20);
  }
  return fetchInstagramPosts(handle, 20);
}

export async function runForOperatorPlatform(
  operator: Operator,
  platform: "Instagram" | "Telegram",
  handle: string,
): Promise<RunStats> {
  console.log(`[pipeline] Processing ${operator.name} on ${platform} (${handle})`);

  let recordsFetched = 0;
  let recordsInserted = 0;
  let errorMsg: string | null = null;

  try {
    const posts = await fetchPosts(platform, handle);
    recordsFetched = posts.length;
    console.log(`[pipeline] Fetched ${recordsFetched} posts from ${handle}`);

    for (const post of posts) {
      try {
        const alreadyExists = await isDuplicate(post.url);
        if (alreadyExists) {
          console.log(`[pipeline] Duplicate skipped: ${post.url}`);
          continue;
        }

        const extraction = await extractPromotion(post.text);

        await insertPromotion({
          operator: operator.name,
          platform,
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
        console.log(
          `[pipeline] Inserted promotion from ${post.url} (confidence: ${extraction.confidence_score})`,
        );
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
    console.error(`[pipeline] Fatal error for ${operator.name} on ${platform}:`, msg);
    errorMsg = msg;
  }

  await logRun({
    source: operator.name,
    platform,
    status: errorMsg && recordsInserted === 0 ? "error" : "success",
    recordsFetched,
    recordsInserted,
    errorMessage: errorMsg,
  });

  return {
    source: operator.name,
    platform,
    recordsFetched,
    recordsInserted,
    error: errorMsg,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PipelineProgressEvent =
  | { type: "started"; total: number }
  | { type: "job-started"; index: number; total: number; source: string; platform: "Instagram" | "Telegram" }
  | { type: "job-finished"; index: number; total: number; source: string; platform: "Instagram" | "Telegram" }
  | { type: "finished"; total: number };

export interface RunPipelineOptions {
  onProgress?: (event: PipelineProgressEvent) => void;
  trigger?: "scheduled" | "manual";
}

export async function runPipeline(options: RunPipelineOptions = {}): Promise<void> {
  const { onProgress, trigger = "manual" } = options;
  const startedAt = new Date();
  const emit = (event: PipelineProgressEvent) => {
    if (!onProgress) return;
    try {
      onProgress(event);
    } catch (err) {
      console.error("[pipeline] onProgress callback threw:", err);
    }
  };

  console.log(`[pipeline] Starting pipeline run at ${startedAt.toISOString()}`);

  const results: RunStats[] = [];
  try {
    const operators = await getActiveOperators();

    if (operators.length === 0) {
      console.log(
        "[pipeline] No active operators found. Add operators in the dashboard to begin scraping.",
      );
      emit({ type: "started", total: 0 });
      emit({ type: "finished", total: 0 });
      return;
    }

    type Job = { operator: Operator; platform: "Instagram" | "Telegram"; handle: string };
    const jobs: Job[] = [];
    for (const op of operators) {
      if (op.instagramHandle && op.instagramHandle.trim().length > 0) {
        jobs.push({ operator: op, platform: "Instagram", handle: op.instagramHandle.trim() });
      }
      if (op.telegramHandle && op.telegramHandle.trim().length > 0) {
        jobs.push({ operator: op, platform: "Telegram", handle: op.telegramHandle.trim() });
      }
    }

    if (jobs.length === 0) {
      console.log(
        "[pipeline] No active operators have Instagram or Telegram handles configured.",
      );
      emit({ type: "started", total: 0 });
      emit({ type: "finished", total: 0 });
      return;
    }

    console.log(
      `[pipeline] Found ${operators.length} active operator(s) with ${jobs.length} platform job(s)`,
    );

    emit({ type: "started", total: jobs.length });

    const interSourceDelayMs = Number(process.env["PIPELINE_INTER_SOURCE_DELAY_MS"] ?? "3000");

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      emit({
        type: "job-started",
        index: i,
        total: jobs.length,
        source: job.operator.name,
        platform: job.platform,
      });
      const stats = await runForOperatorPlatform(job.operator, job.platform, job.handle);
      results.push(stats);
      emit({
        type: "job-finished",
        index: i,
        total: jobs.length,
        source: job.operator.name,
        platform: job.platform,
      });
      if (i < jobs.length - 1 && interSourceDelayMs > 0) {
        await sleep(interSourceDelayMs);
      }
    }

    emit({ type: "finished", total: jobs.length });

    const totalFetched = results.reduce((sum, r) => sum + r.recordsFetched, 0);
    const totalInserted = results.reduce((sum, r) => sum + r.recordsInserted, 0);
    const errors = results.filter((r) => r.error !== null);

    console.log(`\n[pipeline] Run complete:`);
    console.log(`  Jobs processed: ${results.length}`);
    console.log(`  Total posts fetched: ${totalFetched}`);
    console.log(`  Total promotions inserted: ${totalInserted}`);
    if (errors.length > 0) {
      console.log(
        `  Jobs with errors: ${errors.map((r) => `${r.source}/${r.platform}`).join(", ")}`,
      );
    }
  } finally {
    const finishedAt = new Date();
    console.log(`[pipeline] Done at ${finishedAt.toISOString()}\n`);

    if (trigger === "scheduled") {
      try {
        const { sendRunSummaryEmail } = await import("./email.js");
        await sendRunSummaryEmail({ startedAt, finishedAt, results });
      } catch (emailErr) {
        console.error("[pipeline] Failed to send run summary email:", emailErr);
      }
    }
  }
}
