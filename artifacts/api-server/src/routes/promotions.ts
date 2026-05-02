import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, gte, lte, ilike, eq, or, count, sql } from "drizzle-orm";
import { db, promotionsTable } from "@workspace/db";
import {
  ListPromotionsQueryParams,
  GetPromotionParams,
  ListPromotionsResponse,
  GetPromotionResponse,
  GetPromotionsStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/promotions", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPromotionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    operator,
    platform,
    promoType,
    requiresDeposit,
    confidenceScore,
    dateFrom,
    dateTo,
    search,
    page,
    pageSize,
  } = parsed.data;

  const conditions = [];

  if (operator) {
    conditions.push(ilike(promotionsTable.operator, `%${operator}%`));
  }
  if (platform) {
    conditions.push(eq(promotionsTable.platform, platform));
  }
  if (promoType) {
    conditions.push(ilike(promotionsTable.promoType, `%${promoType}%`));
  }
  if (requiresDeposit !== undefined) {
    conditions.push(eq(promotionsTable.requiresDeposit, requiresDeposit));
  }
  if (confidenceScore) {
    conditions.push(eq(promotionsTable.confidenceScore, confidenceScore));
  }
  if (dateFrom) {
    conditions.push(gte(promotionsTable.postDate, dateFrom));
  }
  if (dateTo) {
    conditions.push(lte(promotionsTable.postDate, dateTo));
  }
  if (search) {
    conditions.push(
      or(
        ilike(promotionsTable.offerDetails, `%${search}%`),
        ilike(promotionsTable.operator, `%${search}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(promotionsTable)
      .where(where)
      .orderBy(desc(promotionsTable.postDate))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(promotionsTable).where(where),
  ]);

  const promotions = rows.map((p) => ({
    ...p,
    postDate: p.postDate?.toISOString() ?? null,
    detectedAt: p.detectedAt.toISOString(),
    expiryDate: p.expiryDate ?? null,
  }));

  res.json(
    ListPromotionsResponse.parse({
      promotions,
      total: Number(total),
      page,
      pageSize,
    }),
  );
});

router.get("/promotions/stats", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    [{ total }],
    [{ noDeposit }],
    [{ highConf }],
    [{ opCount }],
    [{ last24hCount }],
    byPlatform,
    byPromoType,
    byOperator,
  ] = await Promise.all([
    db.select({ total: count() }).from(promotionsTable),
    db
      .select({ noDeposit: count() })
      .from(promotionsTable)
      .where(eq(promotionsTable.requiresDeposit, false)),
    db
      .select({ highConf: count() })
      .from(promotionsTable)
      .where(eq(promotionsTable.confidenceScore, "High")),
    db
      .select({ opCount: sql<number>`count(distinct ${promotionsTable.operator})` })
      .from(promotionsTable),
    db
      .select({ last24hCount: count() })
      .from(promotionsTable)
      .where(gte(promotionsTable.detectedAt, last24h)),
    db
      .select({
        platform: promotionsTable.platform,
        count: count(),
      })
      .from(promotionsTable)
      .groupBy(promotionsTable.platform),
    db
      .select({
        promoType: promotionsTable.promoType,
        count: count(),
      })
      .from(promotionsTable)
      .groupBy(promotionsTable.promoType),
    db
      .select({
        operator: promotionsTable.operator,
        count: count(),
      })
      .from(promotionsTable)
      .groupBy(promotionsTable.operator)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  res.json(
    GetPromotionsStatsResponse.parse({
      totalPromotions: Number(total),
      noDepositCount: Number(noDeposit),
      highConfidenceCount: Number(highConf),
      operatorCount: Number(opCount),
      last24hCount: Number(last24hCount),
      byPlatform: byPlatform.map((r) => ({
        platform: r.platform,
        count: Number(r.count),
      })),
      byPromoType: byPromoType
        .filter((r) => r.promoType != null)
        .map((r) => ({
          promoType: r.promoType!,
          count: Number(r.count),
        })),
      byOperator: byOperator.map((r) => ({
        operator: r.operator,
        count: Number(r.count),
      })),
    }),
  );
});

router.get("/promotions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [promotion] = await db
    .select()
    .from(promotionsTable)
    .where(eq(promotionsTable.id, params.data.id));

  if (!promotion) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }

  res.json(
    GetPromotionResponse.parse({
      ...promotion,
      postDate: promotion.postDate?.toISOString() ?? null,
      detectedAt: promotion.detectedAt.toISOString(),
      expiryDate: promotion.expiryDate ?? null,
    }),
  );
});

export default router;
