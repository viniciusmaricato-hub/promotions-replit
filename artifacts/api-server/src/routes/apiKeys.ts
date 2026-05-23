import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/api-keys", requireAuth, async (_req, res): Promise<void> => {
  const keys = await db
    .select({
      id: apiKeysTable.id,
      label: apiKeysTable.label,
      keyPrefix: apiKeysTable.keyPrefix,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
    })
    .from(apiKeysTable)
    .orderBy(apiKeysTable.createdAt);

  res.json({ keys });
});

router.post("/api-keys", requireAuth, async (req, res): Promise<void> => {
  const { label } = req.body as { label?: string };

  if (!label || typeof label !== "string" || label.trim().length === 0) {
    res.status(400).json({ error: "label is required" });
    return;
  }

  const rawKey = `pm_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 11);

  const [row] = await db
    .insert(apiKeysTable)
    .values({
      label: label.trim(),
      keyHash: hash,
      keyPrefix,
    })
    .returning({
      id: apiKeysTable.id,
      label: apiKeysTable.label,
      keyPrefix: apiKeysTable.keyPrefix,
      createdAt: apiKeysTable.createdAt,
      lastUsedAt: apiKeysTable.lastUsedAt,
    });

  res.status(201).json({ key: { ...row, rawKey } });
});

router.delete("/api-keys/:id", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;

  const result = await db
    .delete(apiKeysTable)
    .where(eq(apiKeysTable.id, id))
    .returning({ id: apiKeysTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  res.status(204).send();
});

export default router;
