import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, runsTable } from "@workspace/db";
import { ListRunsQueryParams, ListRunsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

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
