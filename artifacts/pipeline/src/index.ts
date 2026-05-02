import cron from "node-cron";
import { runPipeline } from "./pipeline.js";

const RUN_NOW_FLAG = process.argv.includes("--run-now");

const CRON_SCHEDULE = process.env["PIPELINE_CRON_SCHEDULE"] ?? "0 6 * * *";

async function main() {
  console.log("[pipeline] Promotions ingestion pipeline starting...");
  console.log(`[pipeline] Cron schedule: ${CRON_SCHEDULE} (override with PIPELINE_CRON_SCHEDULE env var)`);

  if (RUN_NOW_FLAG) {
    console.log("[pipeline] --run-now flag detected, executing immediately...");
    await runPipeline();
    process.exit(0);
  }

  const isValidSchedule = cron.validate(CRON_SCHEDULE);
  if (!isValidSchedule) {
    console.error(`[pipeline] Invalid cron schedule: "${CRON_SCHEDULE}". Defaulting to daily at 06:00 UTC.`);
    process.exit(1);
  }

  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runPipeline();
    } catch (err) {
      console.error("[pipeline] Unhandled error during scheduled run:", err);
    }
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
