import { db, promotionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import seedRows from "./seed-2026-05-21.json";

type SeedRow = {
  operator: string;
  platform: string;
  postDate: string | null;
  promoType: string | null;
  offerDetails: string | null;
  minDeposit: number | null;
  rewardValue: string | null;
  wageringRequirement: string | null;
  expiryDate: string | null;
  targetAudience: string | null;
  requiresDeposit: boolean | null;
  sourceUrl: string;
  rawPostText: string;
  confidenceScore: number | null;
  promptVersion: string | null;
  detectedAt: string | null;
};

const SEED_DATE = "2026-05-21";

export async function runSeedIfNeeded(): Promise<void> {
  const result = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM promotions WHERE detected_at::date = ${SEED_DATE}`
  );
  const { count } = result.rows[0] ?? { count: "0" };

  if (parseInt(count ?? "0") > 0) {
    logger.info({ count }, `[seed] ${SEED_DATE} data already present, skipping.`);
    return;
  }

  const rows = seedRows as SeedRow[];
  logger.info({ total: rows.length }, `[seed] Inserting ${SEED_DATE} promotions...`);

  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db
      .insert(promotionsTable)
      .values(
        batch.map((r) => ({
          operator: r.operator,
          platform: r.platform,
          postDate: r.postDate ? new Date(r.postDate) : undefined,
          promoType: r.promoType,
          offerDetails: r.offerDetails,
          minDeposit: r.minDeposit != null ? String(r.minDeposit) : null,
          rewardValue: r.rewardValue,
          wageringRequirement: r.wageringRequirement,
          expiryDate: r.expiryDate ?? undefined,
          targetAudience: r.targetAudience,
          requiresDeposit: r.requiresDeposit,
          sourceUrl: r.sourceUrl,
          rawPostText: r.rawPostText,
          confidenceScore: r.confidenceScore != null ? String(r.confidenceScore) : "Low",
          promptVersion: r.promptVersion,
          detectedAt: r.detectedAt ? new Date(r.detectedAt) : undefined,
        }))
      )
      .onConflictDoNothing();
    inserted += batch.length;
  }

  logger.info({ inserted }, `[seed] Done — ${inserted} rows inserted.`);
}
