import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

/** Shared Drizzle instance (connection pool). Throws when the database is not configured. */
export function db() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    _db = drizzle(url);
  }
  return _db;
}

export type DB = ReturnType<typeof db>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

/** Number of rows changed by an UPDATE/DELETE executed through mysql2. */
export function affected(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

/** Legacy helper kept for starter compatibility. */
export async function getDb() {
  return process.env.DATABASE_URL ? db() : null;
}
