import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Repository invariants that are cheap to check and expensive to get wrong.
 *
 * These are not behaviour tests; they guard the project's *contract with its
 * operators*: every environment variable the code needs must be documented, and
 * the migration chain must stay well-formed. Both have caused production
 * surprises in projects like this one, and neither is caught by unit tests.
 */

const ROOT = new URL("../../", import.meta.url);
const ENV_SOURCE = readFileSync(new URL("env.ts", import.meta.url), "utf8");
const EXAMPLE_SOURCE = readFileSync(new URL(".env.example", ROOT), "utf8");

function environmentNames(): string[] {
  const names = new Set<string>();
  for (const match of ENV_SOURCE.matchAll(/(?:required|optional)\("([A-Z0-9_]+)"/g)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function exampleKeys(): string[] {
  return EXAMPLE_SOURCE.split(/\r?\n/)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
    .filter((key): key is string => Boolean(key));
}

test("env docs: every variable the app requires is in .env.example", () => {
  const documented = new Set(exampleKeys());
  const missing = environmentNames().filter((name) => !documented.has(name));

  assert.deepEqual(missing, [], `undocumented environment variable(s): ${missing.join(", ")}`);
});

test("env docs: .env.example has no duplicated keys", () => {
  const keys = exampleKeys();
  const seen = new Set<string>();
  const duplicates = keys.filter((key) => {
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });

  assert.deepEqual(duplicates, [], `duplicated key(s): ${duplicates.join(", ")}`);
});

test("env docs: secrets are blank in the example, never a plausible value", () => {
  // A committed default is how "dev-only" secrets end up in production.
  const secretKeys = [
    "AUTH_SECRET",
    "OTP_HASH_SECRET",
    "SECRETS_KEY",
    "CRON_SECRET",
    "SMS_API_KEY",
    "EMAIL_API_KEY",
    "BKASH_APP_SECRET",
    "SSLCOMMERZ_STORE_PASSWORD",
    "S3_SECRET_ACCESS_KEY",
  ];

  for (const key of secretKeys) {
    const line = EXAMPLE_SOURCE.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
    assert.ok(line, `${key} is missing from .env.example`);
    // The local-development placeholders below are intentional and documented as
    // dev-only in the file itself; everything else must be empty.
    const allowed = ["dev-only-change-me-0123456789abcdefghijklmnop", "dev-only-32-char-secret-manager-key"];
    const value = line.slice(key.length + 1).replace(/^"|"$/g, "");
    assert.ok(
      value === "" || allowed.includes(value),
      `${key} ships a default value that could reach production`,
    );
  }
});

test("migrations: every folder is timestamp-ordered and uniquely named", () => {
  const dir = readdirSync(new URL("prisma/migrations", ROOT), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.ok(dir.length > 10, "expected the migration chain to be present");

  const invalid = dir.filter((name) => !/^\d{14}_[a-z0-9]+(_[a-z0-9]+)*$/.test(name));
  assert.deepEqual(invalid, [], `malformed migration folder(s): ${invalid.join(", ")}`);

  const stamps = dir.map((name) => name.slice(0, 14));
  assert.equal(new Set(stamps).size, stamps.length, "two migrations share a timestamp");
});

test("migrations: every migration has a non-empty SQL file", () => {
  const root = fileURLToPath(new URL("prisma/migrations", ROOT));
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sql = readFileSync(fileURLToPath(new URL(`prisma/migrations/${entry.name}/migration.sql`, ROOT)), "utf8");
    assert.ok(sql.trim().length > 0, `${entry.name} is empty`);
    assert.match(sql.trim(), /;$/, `${entry.name} does not end with a semicolon`);
  }
});
