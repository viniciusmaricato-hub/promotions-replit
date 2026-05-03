import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, runsTable } from "@workspace/db";
import { ListRunsQueryParams, ListRunsResponse } from "@workspace/api-zod";
import { runPipeline } from "@workspace/pipeline/pipeline";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

let isRunning = false;

router.post("/runs/trigger", requireAuth, async (_req, res): Promise<void> => {
  if (isRunning) {
    res.status(409).json({ error: "A pipeline run is already in progress." });
    return;
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  void (async () => {
    try {
      logger.info("[runs/trigger] starting manual pipeline run");
      await runPipeline();
      logger.info("[runs/trigger] manual pipeline run completed");
    } catch (err) {
      logger.error({ err }, "[runs/trigger] manual pipeline run failed");
    } finally {
      isRunning = false;
    }
  })();

  res.status(202).json({ status: "started", startedAt });
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
