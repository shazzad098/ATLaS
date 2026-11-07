import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { DB_TEST_SKIP } from "@/lib/testing/fixtures";

/**
 * RLS coverage guard.
 *
 * `rls.test.ts` proves the policies that exist actually isolate. This test
 * proves that every table which *should* be protected has a policy at all: a
 * new tenant-scoped table shipped without one would silently bypass the last
 * line of defence and no other test would notice.
 */

const TABLES_WITHOUT_RLS = new Map<string, string>([
  [
    "Membership",
    "read before any tenant context exists (auth bootstrap); contains no merchant business data",
  ],
  ["AuditLog", "platform-wide security trail, read only by Super Admin and the owning tenant"],
  ["SupportTicket", "platform support inbox, not merchant business data"],
]);

const connectionString = process.env.DATABASE_URL ?? "";

async function query<T>(sql: string): Promise<T[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(sql);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

type TableRow = {
  table: string;
  enabled: boolean;
  forced: boolean;
  policies: number;
};

test(
  "rls coverage: every tenant/store/customer scoped table is forced under RLS",
  { skip: DB_TEST_SKIP },
  async () => {
    const rows = await query<TableRow>(`
      SELECT c.relname AS "table",
             c.relrowsecurity AS enabled,
             c.relforcerowsecurity AS forced,
             (SELECT count(*)::int FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind = 'r'
         AND EXISTS (
           SELECT 1 FROM information_schema.columns col
            WHERE col.table_schema = 'public'
              AND col.table_name = c.relname
              AND col.column_name IN ('tenantId', 'storeId', 'customerId')
         )
       ORDER BY c.relname
    `);

    assert.ok(rows.length > 10, "expected the catalog to report scoped tables");

    const unprotected = rows
      .filter((row) => !TABLES_WITHOUT_RLS.has(row.table))
      .filter((row) => !row.enabled || !row.forced || row.policies === 0)
      .map((row) => `${row.table} (enabled=${row.enabled}, forced=${row.forced}, policies=${row.policies})`);

    assert.deepEqual(unprotected, [], `table(s) without enforced RLS: ${unprotected.join("; ")}`);
  },
);

test(
  "rls coverage: every policy is bound to a request context helper",
  { skip: DB_TEST_SKIP },
  async () => {
    const policies = await query<{ tablename: string; policyname: string; qual: string | null; check: string | null }>(`
      SELECT tablename, policyname, qual, with_check AS check
        FROM pg_policies
       WHERE schemaname = 'public'
    `);

    assert.ok(policies.length >= 40, "expected the full policy set");

    const unbound = policies
      .filter((policy) => !`${policy.qual ?? ""} ${policy.check ?? ""}`.includes("app_"))
      .map((policy) => `${policy.tablename}.${policy.policyname}`);

    assert.deepEqual(unbound, [], `policy without a context helper: ${unbound.join(", ")}`);
  },
);

test(
  "rls coverage: the runtime role is not a superuser and cannot bypass RLS",
  { skip: DB_TEST_SKIP },
  async () => {
    const rows = await query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'atlas_app'`,
    );

    assert.equal(rows.length, 1, "the atlas_app runtime role must exist");
    assert.equal(rows[0].rolsuper, false, "atlas_app must not be a superuser");
    assert.equal(rows[0].rolbypassrls, false, "atlas_app must not hold BYPASSRLS");
  },
);
