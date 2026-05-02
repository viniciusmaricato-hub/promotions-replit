import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, operatorsTable } from "@workspace/db";
import {
  CreateOperatorBody,
  UpdateOperatorParams,
  UpdateOperatorBody,
  ListOperatorsResponse,
  UpdateOperatorResponse,
  ImportOperatorsBody,
  ImportOperatorsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serialize(o: typeof operatorsTable.$inferSelect) {
  return {
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function normalize(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

router.get("/operators", requireAuth, async (_req, res): Promise<void> => {
  const operators = await db
    .select()
    .from(operatorsTable)
    .orderBy(operatorsTable.name);

  res.json(ListOperatorsResponse.parse(operators.map(serialize)));
});

router.post("/operators", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOperatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim();
  if (name.length === 0) {
    res.status(400).json({ error: "Operator name is required." });
    return;
  }
  const homepageUrl = normalize(parsed.data.homepageUrl);
  const instagramHandle = normalize(parsed.data.instagramHandle);
  const telegramHandle = normalize(parsed.data.telegramHandle);

  if (!instagramHandle && !telegramHandle) {
    res.status(400).json({
      error: "At least one handle (Instagram or Telegram) is required.",
    });
    return;
  }

  if (homepageUrl && !isValidHttpUrl(homepageUrl)) {
    res.status(400).json({ error: "Home page must be a valid http(s) URL." });
    return;
  }

  try {
    const [operator] = await db
      .insert(operatorsTable)
      .values({ name, homepageUrl, instagramHandle, telegramHandle })
      .returning();

    res.status(201).json(UpdateOperatorResponse.parse(serialize(operator!)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      res.status(400).json({ error: `An operator named "${name}" already exists.` });
      return;
    }
    throw err;
  }
});

router.post("/operators/import", requireAuth, async (req, res): Promise<void> => {
  const parsed = ImportOperatorsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.operators.length === 0) {
    res.status(400).json({ error: "No operators to import." });
    return;
  }

  if (parsed.data.operators.length > 1000) {
    res.status(400).json({ error: "Too many rows (max 1000 per import)." });
    return;
  }

  const errors: { row: number; name?: string; error: string }[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const seenNames = new Set<string>();

  for (let i = 0; i < parsed.data.operators.length; i++) {
    const raw = parsed.data.operators[i]!;
    const rowNumber = i + 1;
    const name = (raw.name ?? "").trim();

    if (name.length === 0) {
      errors.push({ row: rowNumber, error: "Missing operator name." });
      skipped++;
      continue;
    }

    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey)) {
      errors.push({
        row: rowNumber,
        name,
        error: "Duplicate operator name in the import file.",
      });
      skipped++;
      continue;
    }
    seenNames.add(nameKey);

    const homepageUrl = normalize(raw.homepageUrl);
    const instagramHandle = normalize(raw.instagramHandle);
    const telegramHandle = normalize(raw.telegramHandle);

    if (homepageUrl && !isValidHttpUrl(homepageUrl)) {
      errors.push({
        row: rowNumber,
        name,
        error: "Home page must be a valid http(s) URL.",
      });
      skipped++;
      continue;
    }

    try {
      // Case-insensitive lookup so "BetMGM" and "betmgm" map to the same row.
      // Fetch up to 2 to detect ambiguous case-variant duplicates rather than
      // silently updating an arbitrary one.
      const matches = await db
        .select()
        .from(operatorsTable)
        .where(sql`LOWER(${operatorsTable.name}) = ${nameKey}`)
        .orderBy(operatorsTable.id)
        .limit(2);

      if (matches.length > 1) {
        errors.push({
          row: rowNumber,
          name,
          error: `Multiple existing operators match this name (case-insensitive): ${matches
            .map((m) => `"${m.name}"`)
            .join(", ")}. Resolve duplicates before importing.`,
        });
        skipped++;
        continue;
      }

      const existing = matches[0];

      if (existing) {
        // Merge: blank columns preserve existing values
        const nextHomepage = homepageUrl ?? existing.homepageUrl;
        const nextInstagram = instagramHandle ?? existing.instagramHandle;
        const nextTelegram = telegramHandle ?? existing.telegramHandle;

        if (existing.active && !nextInstagram && !nextTelegram) {
          errors.push({
            row: rowNumber,
            name,
            error:
              "Active operator must keep at least one handle. Provide a handle or deactivate first.",
          });
          skipped++;
          continue;
        }

        await db
          .update(operatorsTable)
          .set({
            homepageUrl: nextHomepage,
            instagramHandle: nextInstagram,
            telegramHandle: nextTelegram,
            updatedAt: new Date(),
          })
          .where(eq(operatorsTable.id, existing.id));
        updated++;
      } else {
        if (!instagramHandle && !telegramHandle) {
          errors.push({
            row: rowNumber,
            name,
            error: "New operators need at least one handle (Instagram or Telegram).",
          });
          skipped++;
          continue;
        }

        await db.insert(operatorsTable).values({
          name,
          homepageUrl,
          instagramHandle,
          telegramHandle,
        });
        created++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ row: rowNumber, name, error: msg });
      skipped++;
    }
  }

  res.json(
    ImportOperatorsResponse.parse({ created, updated, skipped, errors }),
  );
});

router.patch("/operators/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOperatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateOperatorBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(operatorsTable)
    .where(eq(operatorsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Operator not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  let nextName = existing.name;
  let nextHomepage = existing.homepageUrl;
  let nextInstagram = existing.instagramHandle;
  let nextTelegram = existing.telegramHandle;
  let nextActive = existing.active;

  if (body.data.name !== undefined) {
    const trimmed = body.data.name.trim();
    if (trimmed.length === 0) {
      res.status(400).json({ error: "Operator name cannot be empty." });
      return;
    }
    nextName = trimmed;
    updates.name = trimmed;
  }

  if (body.data.homepageUrl !== undefined) {
    nextHomepage = normalize(body.data.homepageUrl);
    if (nextHomepage && !isValidHttpUrl(nextHomepage)) {
      res.status(400).json({ error: "Home page must be a valid http(s) URL." });
      return;
    }
    updates.homepageUrl = nextHomepage;
  }

  if (body.data.instagramHandle !== undefined) {
    nextInstagram = normalize(body.data.instagramHandle);
    updates.instagramHandle = nextInstagram;
  }

  if (body.data.telegramHandle !== undefined) {
    nextTelegram = normalize(body.data.telegramHandle);
    updates.telegramHandle = nextTelegram;
  }

  if (body.data.active !== undefined) {
    nextActive = body.data.active;
    updates.active = body.data.active;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  if (nextActive && !nextInstagram && !nextTelegram) {
    res.status(400).json({
      error:
        "An active operator needs at least one handle (Instagram or Telegram). Add a handle or deactivate the operator first.",
    });
    return;
  }

  try {
    const [operator] = await db
      .update(operatorsTable)
      .set(updates)
      .where(eq(operatorsTable.id, params.data.id))
      .returning();

    if (!operator) {
      res.status(404).json({ error: "Operator not found" });
      return;
    }

    res.json(UpdateOperatorResponse.parse(serialize(operator)));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      res.status(400).json({ error: `An operator named "${nextName}" already exists.` });
      return;
    }
    throw err;
  }
});

export default router;
