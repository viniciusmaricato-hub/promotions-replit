import { db, promotionsTable, sourcesTable, operatorsTable, runsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
