import {
  pgTable,
  text,
  integer,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const runsTable = pgTable("runs", {
  id: serial("id").primaryKey(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("success"),
  recordsFetched: integer("records_fetched").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  errorMessage: text("error_message"),
});

export const insertRunSchema = createInsertSchema(runsTable).omit({
  id: true,
  runAt: true,
});
export type InsertRun = z.infer<typeof insertRunSchema>;
export type Run = typeof runsTable.$inferSelect;
