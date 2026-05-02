import { db, promotionsTable, sourcesTable, runsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { InsertPromotion, InsertRun, Source } from "@workspace/db";

export async function getActiveSources(platform?: string): Promise<Source[]> {
  if (platform) {
    return db
      .select()
      .from(sourcesTable)
      .where(and(eq(sourcesTable.active, true), eq(sourcesTable.platform, platform)));
  }
  return db.select().from(sourcesTable).where(eq(sourcesTable.active, true));
}

export async function isDuplicate(sourceUrl: string): Promise<boolean> {
  const existing = await db
    .select({ id: promotionsTable.id })
    .from(promotionsTable)
    .where(eq(promotionsTable.sourceUrl, sourceUrl))
    .limit(1);
  return existing.length > 0;
}

export async function insertPromotion(data: InsertPromotion): Promise<void> {
  await db.insert(promotionsTable).values(data);
}

export async function logRun(data: InsertRun): Promise<void> {
  await db.insert(runsTable).values(data);
}
