import { and, asc, eq, lte, lt, sql } from "drizzle-orm";
import { db, affected } from "../db";
import { jobs } from "../../drizzle/schema";

type Handler = (payload: Record<string, unknown>, job: typeof jobs.$inferSelect) => Promise<Record<string, unknown> | void>;
const handlers = new Map<string, Handler>();
export function registerJob(type: string, handler: Handler) {
  handlers.set(type, handler);
}

export async function enqueue(
  type: string,
  payload: Record<string, unknown>,
  opts: { runAt?: Date; tenantId?: number | null; dedupeKey?: string; maxAttempts?: number; createdBy?: number | null } = {}
): Promise<number | null> {
  try {
    const [row] = await db()
      .insert(jobs)
      .values({
        type,
        payloadJson: payload,
        runAt: opts.runAt ?? new Date(),
        tenantId: opts.tenantId ?? null,
        dedupeKey: opts.dedupeKey ?? null,
        maxAttempts: opts.maxAttempts ?? 5,
        createdBy: opts.createdBy ?? null,
      })
      .$returningId();
    return row.id;
  } catch (e) {
    if (opts.dedupeKey && String((e as Error).message).includes("Duplicate")) return null;
    throw e;
  }
}

const BACKOFF_SEC = [30, 120, 600, 1800, 7200, 21600];

async function runOne(job: typeof jobs.$inferSelect) {
  const claimed = affected(
    await db()
      .update(jobs)
      .set({ status: "running", lockedAt: new Date(), attempts: sql`${jobs.attempts} + 1` })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, "queued")))
  );
  if (!claimed) return;
  const handler = handlers.get(job.type);
  try {
    if (!handler) throw new Error(`No handler for job type ${job.type}`);
    const result = await handler(job.payloadJson, job);
    await db()
      .update(jobs)
      .set({ status: "succeeded", finishedAt: new Date(), resultJson: result ?? null, lastError: null })
      .where(eq(jobs.id, job.id));
  } catch (e) {
    const attempts = job.attempts + 1;
    const dead = attempts >= job.maxAttempts;
    await db()
      .update(jobs)
      .set({
        status: dead ? "dead" : "queued",
        lastError: String((e as Error)?.message ?? e).slice(0, 2000),
        runAt: new Date(Date.now() + (BACKOFF_SEC[Math.min(attempts - 1, BACKOFF_SEC.length - 1)] ?? 60) * 1000),
        finishedAt: dead ? new Date() : null,
      })
      .where(eq(jobs.id, job.id));
  }
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await db()
      .update(jobs)
      .set({ status: "queued", lockedAt: null })
      .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, new Date(Date.now() - 10 * 60 * 1000))));
    const due = await db()
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, new Date())))
      .orderBy(asc(jobs.runAt))
      .limit(8);
    for (const j of due) await runOne(j);
  } catch (e) {
    console.warn("[jobs] tick failed", (e as Error).message);
  } finally {
    running = false;
  }
}

type Periodic = { name: string; everyMs: number; fn: () => Promise<void>; lastRun: number };
const periodic: Periodic[] = [];
export function every(name: string, everyMs: number, fn: () => Promise<void>) {
  periodic.push({ name, everyMs, fn, lastRun: 0 });
}
async function runPeriodic() {
  const now = Date.now();
  for (const p of periodic) {
    if (now - p.lastRun < p.everyMs) continue;
    p.lastRun = now;
    try {
      await p.fn();
    } catch (e) {
      console.warn(`[scheduler] ${p.name} failed`, (e as Error).message);
    }
  }
}

export function startWorker() {
  if (!process.env.DATABASE_URL) return;
  setInterval(tick, 2000).unref();
  setInterval(runPeriodic, 15_000).unref();
  setTimeout(runPeriodic, 5000).unref();
}

export async function retryJob(id: number) {
  await db().update(jobs).set({ status: "queued", runAt: new Date(), maxAttempts: sql`${jobs.attempts} + 3` }).where(eq(jobs.id, id));
}
