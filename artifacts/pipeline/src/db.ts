import { db, promotionsTable, sourcesTable, operatorsTable, runsTable } from "@workspace/db";
import { eq, and, gte, lt } from "drizzle-orm";
import type { InsertPromotion, InsertRun, Source, Operator } from "@workspace/db";

export async function getActiveSources(platform?: string): Promise<Source[]> {
  if (platform) {
    return db
      .select()
      .from(sourcesTable)
      .where(and(eq(sourcesTable.active, true), eq(sourcesTable.platform, platform)));
  }
  return db.select().from(sourcesTable).where(eq(sourcesTable.active, true));
}

export async function getActiveOperators(): Promise<Operator[]> {
  return db
    .select()
    .from(operatorsTable)
    .where(eq(operatorsTable.active, true))
    .orderBy(operatorsTable.name);
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

/**
 * One-time cleanup: deletes all promotions inserted during the window when the
 * broken `fast-instagram-post-scraper` Apify actor was in use (2026-05-09 →
 * 2026-05-21). Those rows contain NY Post content, not operator promotions.
 * Safe to call on every run — it is a no-op once the window has been purged.
 */
export async function purgeContaminatedRows(): Promise<number> {
  const start = new Date("2026-05-09T00:00:00.000Z");
  const end = new Date("2026-05-21T00:00:00.000Z");
  const deleted = await db
    .delete(promotionsTable)
    .where(and(gte(promotionsTable.detectedAt, start), lt(promotionsTable.detectedAt, end)))
    .returning({ id: promotionsTable.id });
  return deleted.length;
}
