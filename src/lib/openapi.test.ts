import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OPENAPI_DOCUMENT, endpointSummaries, type HttpMethod } from "@/lib/openapi";

/**
 * The OpenAPI document is the contract the developer site renders and the SDK
 * generators would consume, so it must not drift from the routes that exist.
 * This test walks `src/app/api/v1` and compares it with the document in both
 * directions: a new route must be documented, and a removed route must not stay
 * in the spec.
 */

const API_ROOT = fileURLToPath(new URL("../app/api/v1", import.meta.url));

/**
 * Endpoints that are deliberately not part of the public contract.
 * Keep this list tiny and justified — it is the escape hatch that lets drift
 * back in.
 */
const INTERNAL_ROUTES = new Map<string, string>([
  ["/api/v1/openapi.json", "serves this document; not a data endpoint"],
  [
    "/api/v1/super-admin/notifications",
    "Super Admin console polling feed, session-authenticated, not for API keys",
  ],
]);

function routeFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(full));
    else if (entry.name === "route.ts") files.push(full);
  }
  return files;
}

function toPath(file: string): string {
  const relative = file
    .replace(API_ROOT, "")
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");
  return `/api/v1${relative.replace(/\[([^\]]+)\]/g, "{$1}")}`;
}

const document = OPENAPI_DOCUMENT as unknown as {
  openapi: string;
  info: { title?: string; version?: string };
  paths: Record<string, Record<string, { responses?: Record<string, unknown>; summary?: string }>>;
};

const documentedPaths = Object.keys(document.paths);
const implementedPaths = routeFiles(API_ROOT)
  .map(toPath)
  .filter((path) => !INTERNAL_ROUTES.has(path))
  .sort();

test("openapi: the document is a 3.1 spec with an identity", () => {
  assert.match(document.openapi, /^3\.1\./);
  assert.ok(document.info.title);
  assert.ok(document.info.version);
});

test("openapi: every implemented route is documented", () => {
  const missing = implementedPaths.filter((path) => !documentedPaths.includes(path));
  assert.deepEqual(missing, [], `undocumented route(s): ${missing.join(", ")}`);
});

test("openapi: every documented path exists as a route", () => {
  const stale = documentedPaths.filter((path) => !implementedPaths.includes(path));
  assert.deepEqual(stale, [], `documented but missing route(s): ${stale.join(", ")}`);
});

test("openapi: every operation documents a summary and at least one response", () => {
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      assert.ok(operation.summary, `${method.toUpperCase()} ${path} has no summary`);
      assert.ok(
        operation.responses && Object.keys(operation.responses).length > 0,
        `${method.toUpperCase()} ${path} documents no responses`,
      );
    }
  }
});

test("openapi: the developer page lists exactly the documented operations", () => {
  const operationCount = Object.values(document.paths).reduce(
    (total, operations) => total + Object.keys(operations).length,
    0,
  );
  assert.equal(endpointSummaries().length, operationCount);

  const methods: HttpMethod[] = ["get", "post", "patch", "delete"];
  for (const summary of endpointSummaries()) {
    assert.ok(
      methods.includes(summary.method.toLowerCase() as HttpMethod),
      `unexpected method ${summary.method}`,
    );
    assert.ok(summary.path.startsWith("/api/v1/"), `unexpected path ${summary.path}`);
  }
});
