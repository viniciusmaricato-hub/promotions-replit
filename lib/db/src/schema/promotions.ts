import {
  pgTable,
  text,
  boolean,
  timestamp,
  date,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promotionsTable = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operator: text("operator").notNull(),
    platform: text("platform").notNull(),
    postDate: timestamp("post_date", { withTimezone: true }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    promoType: text("promo_type"),
    offerDetails: text("offer_details"),
    minDeposit: text("min_deposit"),
    rewardValue: text("reward_value"),
    wageringRequirement: text("wagering_requirement"),
    expiryDate: date("expiry_date"),
    targetAudience: text("target_audience"),
    requiresDeposit: boolean("requires_deposit"),
    sourceUrl: text("source_url").notNull(),
    rawPostText: text("raw_post_text"),
    confidenceScore: text("confidence_score").notNull().default("Low"),
    promptVersion: text("prompt_version"),
  },
  (table) => [
    index("promotions_post_date_idx").on(table.postDate),
    index("promotions_operator_idx").on(table.operator),
    index("promotions_requires_deposit_idx").on(table.requiresDeposit),
    index("promotions_detected_at_idx").on(table.detectedAt),
  ],
);

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({
  id: true,
  detectedAt: true,
});
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotionsTable.$inferSelect;
