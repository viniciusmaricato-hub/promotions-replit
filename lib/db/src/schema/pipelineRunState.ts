import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const pipelineRunStateTable = pgTable("pipeline_run_state", {
  id: integer("id").primaryKey(),
  status: text("status").notNull().default("idle"),
  total: integer("total").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  currentSource: text("current_source"),
  currentPlatform: text("current_platform"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PipelineRunStateRow = typeof pipelineRunStateTable.$inferSelect;
