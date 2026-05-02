import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sourcesTable } from "@workspace/db";
import {
  CreateSourceBody,
  UpdateSourceParams,
  UpdateSourceBody,
  ListSourcesResponse,
  UpdateSourceResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/sources", requireAuth, async (_req, res): Promise<void> => {
  const sources = await db
    .select()
    .from(sourcesTable)
    .orderBy(sourcesTable.name);

  res.json(
    ListSourcesResponse.parse(
      sources.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    ),
  );
});

router.post("/sources", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [source] = await db
    .insert(sourcesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(
    UpdateSourceResponse.parse({
      ...source,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    }),
  );
});

router.patch("/sources/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateSourceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.handle !== undefined) updates.handle = body.data.handle;
  if (body.data.active !== undefined) updates.active = body.data.active;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [source] = await db
    .update(sourcesTable)
    .set(updates)
    .where(eq(sourcesTable.id, params.data.id))
    .returning();

  if (!source) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  res.json(
    UpdateSourceResponse.parse({
      ...source,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    }),
  );
});

export default router;
