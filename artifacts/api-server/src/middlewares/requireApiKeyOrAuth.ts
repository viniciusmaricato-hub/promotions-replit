import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { createHash } from "crypto";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function lookupApiKey(rawKey: string): Promise<boolean> {
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const rows = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.keyHash, hash))
    .limit(1);

  if (rows.length === 0) return false;

  await db
    .update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.keyHash, hash));

  return true;
}

export async function requireApiKeyOrAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey =
    (req.headers["x-api-key"] as string | undefined) ??
    (req.query["api_key"] as string | undefined);

  if (apiKey) {
    try {
      const valid = await lookupApiKey(apiKey);
      if (valid) {
        next();
        return;
      }
    } catch {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  const auth = getAuth(req);
  if (auth?.userId) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
