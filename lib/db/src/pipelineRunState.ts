import { and, eq, lt, or, ne } from "drizzle-orm";
import { db } from "./index";
import {
  pipelineRunStateTable,
  type PipelineRunStateRow,
} from "./schema/pipelineRunState";

export const RUN_STATE_ROW_ID = 1;
export const STALE_LOCK_MS = 15 * 60 * 1000;
export const FINISHED_LINGER_MS = 8000;

export type PipelineProgressSnapshot = {
  status: "idle" | "running" | "finished";
  total: number;
  completed: number;
  currentSource: string | null;
  currentPlatform: "Instagram" | "Telegram" | null;
  startedAt: string | null;
  finishedAt: string | null;
};

const IDLE_SNAPSHOT: PipelineProgressSnapshot = {
  status: "idle",
  total: 0,
  completed: 0,
  currentSource: null,
  currentPlatform: null,
  startedAt: null,
  finishedAt: null,
};

async function ensureRow(): Promise<void> {
  await db
    .insert(pipelineRunStateTable)
    .values({ id: RUN_STATE_ROW_ID })
    .onConflictDoNothing();
}

function rowToSnapshot(row: PipelineRunStateRow): PipelineProgressSnapshot {
  const platform =
    row.currentPlatform === "Instagram" || row.currentPlatform === "Telegram"
      ? row.currentPlatform
      : null;
  const status =
    row.status === "running" || row.status === "finished" ? row.status : "idle";
  return {
    status,
    total: row.total,
    completed: row.completed,
    currentSource: row.currentSource,
    currentPlatform: platform,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function isStaleFinished(row: PipelineRunStateRow, now: Date): boolean {
  if (row.status !== "finished") return false;
  const ref = row.finishedAt ?? row.updatedAt;
  return now.getTime() - ref.getTime() > FINISHED_LINGER_MS;
}

export async function tryAcquireRunLock(): Promise<
  { acquired: true; startedAt: string } | { acquired: false; current: PipelineProgressSnapshot }
> {
  await ensureRow();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

  const updated = await db
    .update(pipelineRunStateTable)
    .set({
      status: "running",
      total: 0,
      completed: 0,
      currentSource: null,
      currentPlatform: null,
      startedAt: now,
      finishedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(pipelineRunStateTable.id, RUN_STATE_ROW_ID),
        or(
          ne(pipelineRunStateTable.status, "running"),
          lt(pipelineRunStateTable.updatedAt, staleBefore),
        ),
      ),
    )
    .returning();

  if (updated.length > 0) {
    return { acquired: true, startedAt: now.toISOString() };
  }

  const current = await getProgressSnapshot();
  return { acquired: false, current };
}

export async function getProgressSnapshot(): Promise<PipelineProgressSnapshot> {
  const rows = await db
    .select()
    .from(pipelineRunStateTable)
    .where(eq(pipelineRunStateTable.id, RUN_STATE_ROW_ID))
    .limit(1);

  const row = rows[0];
  if (!row) return { ...IDLE_SNAPSHOT };

  const now = new Date();

  if (
    row.status === "running" &&
    now.getTime() - row.updatedAt.getTime() > STALE_LOCK_MS
  ) {
    return { ...IDLE_SNAPSHOT };
  }

  if (isStaleFinished(row, now)) {
    return { ...IDLE_SNAPSHOT };
  }

  return rowToSnapshot(row);
}

type ProgressUpdate = Partial<{
  status: "running" | "finished";
  total: number;
  completed: number;
  currentSource: string | null;
  currentPlatform: "Instagram" | "Telegram" | null;
  finishedAt: Date | null;
}>;

export async function updateRunProgress(update: ProgressUpdate): Promise<void> {
  await db
    .update(pipelineRunStateTable)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(pipelineRunStateTable.id, RUN_STATE_ROW_ID));
}

export async function markRunFinished(opts: {
  total?: number;
  completed?: number;
} = {}): Promise<void> {
  const now = new Date();
  await db
    .update(pipelineRunStateTable)
    .set({
      status: "finished",
      ...(opts.total !== undefined ? { total: opts.total } : {}),
      ...(opts.completed !== undefined ? { completed: opts.completed } : {}),
      currentSource: null,
      currentPlatform: null,
      finishedAt: now,
      updatedAt: now,
    })
    .where(eq(pipelineRunStateTable.id, RUN_STATE_ROW_ID));
}

export async function clearRunStateIfFinished(): Promise<void> {
  await db
    .update(pipelineRunStateTable)
    .set({
      status: "idle",
      total: 0,
      completed: 0,
      currentSource: null,
      currentPlatform: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pipelineRunStateTable.id, RUN_STATE_ROW_ID),
        eq(pipelineRunStateTable.status, "finished"),
      ),
    );
}

export async function heartbeatRunLock(): Promise<void> {
  await db
    .update(pipelineRunStateTable)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(pipelineRunStateTable.id, RUN_STATE_ROW_ID),
        eq(pipelineRunStateTable.status, "running"),
      ),
    );
}
