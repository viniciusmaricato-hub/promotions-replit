import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  runsTable,
  tryAcquireRunLock,
  getProgressSnapshot,
  updateRunProgress,
  markRunFinished,
  clearRunStateIfFinished,
  heartbeatRunLock,
  FINISHED_LINGER_MS,
} from "@workspace/db";

const HEARTBEAT_INTERVAL_MS = 30_000;
import { ListRunsQueryParams, ListRunsResponse } from "@workspace/api-zod";
import { runPipeline, type PipelineProgressEvent } from "@workspace/pipeline/pipeline";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

router.post("/runs/trigger", requireAuth, async (_req, res): Promise<void> => {
  const lock = await tryAcquireRunLock();
  if (!lock.acquired) {
    res.status(409).json({ error: "A pipeline run is already in progress." });
    return;
  }

  const startedAt = lock.startedAt;

  void (async () => {
    const heartbeat = setInterval(() => {
      heartbeatRunLock().catch((err) => {
        logger.error({ err }, "[runs/trigger] heartbeat failed");
      });
    }, HEARTBEAT_INTERVAL_MS);
    try {
      logger.info("[runs/trigger] starting manual pipeline run");
      await runPipeline({
        onProgress: (event) => {
          handleProgressEvent(event).catch((err) => {
            logger.error({ err }, "[runs/trigger] progress update failed");
          });
        },
        trigger: "manual",
      });
      logger.info("[runs/trigger] manual pipeline run completed");
    } catch (err) {
      logger.error({ err }, "[runs/trigger] manual pipeline run failed");
      try {
        await markRunFinished();
      } catch (markErr) {
        logger.error({ err: markErr }, "[runs/trigger] failed to mark run finished");
      }
    } finally {
      clearInterval(heartbeat);
      setTimeout(() => {
        clearRunStateIfFinished().catch((err) => {
          logger.error({ err }, "[runs/trigger] failed to clear finished run state");
        });
      }, FINISHED_LINGER_MS);
    }
  })();

  res.status(202).json({ status: "started", startedAt });
});

router.get("/runs/progress", requireAuth, async (_req, res): Promise<void> => {
  const snapshot = await getProgressSnapshot();
  res.json(snapshot);
});

router.get("/runs", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListRunsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const runs = await db
    .select()
    .from(runsTable)
    .orderBy(desc(runsTable.runAt))
    .limit(parsed.data.limit);

  res.json(
    ListRunsResponse.parse(
      runs.map((r) => ({
        ...r,
        runAt: r.runAt.toISOString(),
      })),
    ),
  );
});

export default router;
