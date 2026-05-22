import app from "./app";
import { logger } from "./lib/logger";
import { runSeedIfNeeded } from "./seed-2026-05-21";
import { db, promotionsTable, operatorsTable } from "@workspace/db";
import { notInArray } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function purgeUnknownOperatorPromotions() {
  const operators = await db.select({ name: operatorsTable.name }).from(operatorsTable);
  if (operators.length === 0) return;
  const names = operators.map((o) => o.name);
  const result = await db.delete(promotionsTable).where(notInArray(promotionsTable.operator, names));
  const deleted = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (deleted > 0) {
    logger.info({ deleted }, "[cleanup] Removed promotions for unknown operators");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  runSeedIfNeeded().catch((seedErr) => {
    logger.error({ err: seedErr }, "[seed] Failed to run seed");
  });

  purgeUnknownOperatorPromotions().catch((e) => {
    logger.error({ err: e }, "[cleanup] Failed to purge unknown-operator promotions");
  });
});
