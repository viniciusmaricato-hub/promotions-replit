import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { desc } from "drizzle-orm";
import { db, runsTable } from "@workspace/db";
import { ListRunsQueryParams, ListRunsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

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
