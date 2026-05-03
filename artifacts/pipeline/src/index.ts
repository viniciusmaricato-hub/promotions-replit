import cron from "node-cron";
import {
  tryAcquireRunLock,
  updateRunProgress,
  markRunFinished,
  clearRunStateIfFinished,
  heartbeatRunLock,
  FINISHED_LINGER_MS,
} from "@workspace/db";

const HEARTBEAT_INTERVAL_MS = 30_000;
import { runPipeline, type PipelineProgressEvent } from "./pipeline.js";

const RUN_NOW_FLAG = process.argv.includes("--run-now");

const CRON_SCHEDULE = process.env["PIPELINE_CRON_SCHEDULE"] ?? "0 6 * * *";

async function handleProgressEvent(event: PipelineProgressEvent): Promise<void> {
  switch (event.type) {
    case "started":
      await updateRunProgress({
        status: "running",
        total: event.total,
        completed: 0,
        currentSource: null,
        currentPlatform: null,
      });
      break;
    case "job-started":
      await updateRunProgress({
        status: "running",
        total: event.total,
        currentSource: event.source,
        currentPlatform: event.platform,
      });
      break;
    case "job-finished":
      await updateRunProgress({
        status: "running",
        total: event.total,
        completed: event.index + 1,
      });
      break;
    case "finished":
      await markRunFinished({ total: event.total, completed: event.total });
      break;
  }
}

async function runWithLock(): Promise<void> {
  const lock = await tryAcquireRunLock();
  if (!lock.acquired) {
    console.log(
      "[pipeline] Skipping scheduled run: another pipeline run is already in progress.",
    );
    return;
  }

  const heartbeat = setInterval(() => {
    heartbeatRunLock().catch((err) => {
      console.error("[pipeline] Heartbeat failed:", err);
    });
  }, HEARTBEAT_INTERVAL_MS);
  try {
    await runPipeline({
      trigger: "scheduled",
      onProgress: (event) => {
        handleProgressEvent(event).catch((err) => {
          console.error("[pipeline] Failed to write progress to DB:", err);
        });
      },
    });
  } catch (err) {
    console.error("[pipeline] Unhandled error during scheduled run:", err);
    try {
      await markRunFinished();
    } catch (markErr) {
      console.error("[pipeline] Failed to mark run finished:", markErr);
    }
  } finally {
    clearInterval(heartbeat);
    setTimeout(() => {
      clearRunStateIfFinished().catch((err) => {
        console.error("[pipeline] Failed to clear finished run state:", err);
      });
    }, FINISHED_LINGER_MS);
  }
}

async function main() {
  console.log("[pipeline] Promotions ingestion pipeline starting...");
  console.log(`[pipeline] Cron schedule: ${CRON_SCHEDULE} (override with PIPELINE_CRON_SCHEDULE env var)`);

  if (RUN_NOW_FLAG) {
    console.log("[pipeline] --run-now flag detected, executing immediately...");
    await runWithLock();
    process.exit(0);
  }

  const isValidSchedule = cron.validate(CRON_SCHEDULE);
  if (!isValidSchedule) {
    console.error(`[pipeline] Invalid cron schedule: "${CRON_SCHEDULE}". Defaulting to daily at 06:00 UTC.`);
    process.exit(1);
  }

  cron.schedule(CRON_SCHEDULE, () => {
    void runWithLock();
  }, {
    timezone: "UTC",
  });

  console.log(`[pipeline] Scheduler active. Next run at next occurrence of: ${CRON_SCHEDULE} (UTC)`);
  console.log("[pipeline] Press Ctrl+C to stop.\n");
}

main().catch((err) => {
  console.error("[pipeline] Fatal startup error:", err);
  process.exit(1);
});
