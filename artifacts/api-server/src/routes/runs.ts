import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, runsTable } from "@workspace/db";
import { ListRunsQueryParams, ListRunsResponse } from "@workspace/api-zod";
import { runPipeline, type PipelineProgressEvent } from "@workspace/pipeline/pipeline";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type ProgressState = {
  status: "idle" | "running" | "finished";
  total: number;
  completed: number;
  currentSource: string | null;
  currentPlatform: "Instagram" | "Telegram" | null;
  startedAt: string | null;
  finishedAt: string | null;
};

const IDLE_STATE: ProgressState = {
  status: "idle",
  total: 0,
  completed: 0,
  currentSource: null,
  currentPlatform: null,
  startedAt: null,
  finishedAt: null,
};

let progress: ProgressState = { ...IDLE_STATE };
let resetTimer: NodeJS.Timeout | null = null;
const FINISHED_LINGER_MS = 8000;

function handleProgressEvent(event: PipelineProgressEvent): void {
  switch (event.type) {
    case "started":
      progress = {
        status: "running",
        total: event.total,
        completed: 0,
        currentSource: null,
        currentPlatform: null,
        startedAt: progress.startedAt ?? new Date().toISOString(),
        finishedAt: null,
      };
      break;
    case "job-started":
      progress = {
        ...progress,
        status: "running",
        total: event.total,
        currentSource: event.source,
        currentPlatform: event.platform,
      };
      break;
    case "job-finished":
      progress = {
        ...progress,
        status: "running",
        total: event.total,
        completed: event.index + 1,
      };
      break;
    case "finished":
      progress = {
        ...progress,
        status: "finished",
        total: event.total,
        completed: event.total,
        currentSource: null,
        currentPlatform: null,
        finishedAt: new Date().toISOString(),
      };
      break;
  }
}

router.post("/runs/trigger", requireAuth, async (_req, res): Promise<void> => {
  if (progress.status === "running") {
    res.status(409).json({ error: "A pipeline run is already in progress." });
    return;
  }

  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  const startedAt = new Date().toISOString();
  progress = {
    status: "running",
    total: 0,
    completed: 0,
    currentSource: null,
    currentPlatform: null,
    startedAt,
    finishedAt: null,
  };

  void (async () => {
    try {
      logger.info("[runs/trigger] starting manual pipeline run");
      await runPipeline({ onProgress: handleProgressEvent });
      logger.info("[runs/trigger] manual pipeline run completed");
    } catch (err) {
      logger.error({ err }, "[runs/trigger] manual pipeline run failed");
      progress = {
        ...progress,
        status: "finished",
        finishedAt: new Date().toISOString(),
      };
    } finally {
      resetTimer = setTimeout(() => {
        progress = { ...IDLE_STATE };
        resetTimer = null;
      }, FINISHED_LINGER_MS);
    }
  })();

  res.status(202).json({ status: "started", startedAt });
});

router.get("/runs/progress", requireAuth, (_req, res): void => {
  res.json(progress);
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
