import test from "node:test";
import assert from "node:assert/strict";

/**
 * End-to-end smoke suite.
 *
 * Unlike the unit and integration suites, this one talks to a **running
 * server** over HTTP, so it catches the wiring the other layers cannot: the
 * proxy's host routing, the security headers, the API envelope on the wire, and
 * whether the seeded demo storefront actually renders.
 *
 * It only runs when `E2E_BASE_URL` points at a started instance; CI starts the
 * production build, seeds a database, and then runs this file.
 */

const BASE = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const SKIP = BASE
  ? false
  : "set E2E_BASE_URL=http://127.0.0.1:3000 and start the app to run the smoke suite";

type Envelope = {
  data: unknown;
  error: { code: string; message: string } | null;
  meta: { requestId: string };
};

async function get(path: string, init: RequestInit = {}): Promise<Response> {
  assert.ok(BASE, "E2E_BASE_URL is required when the suite is not skipped");
  return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
}

test("e2e: /api/v1/health reports a live database", { skip: SKIP }, async () => {
  const response = await get("/api/v1/health");
  assert.equal(response.status, 200);

  const body = (await response.json()) as Envelope;
  const data = body.data as { status: string; database: string; metrics: { databaseLatencyMs: number } };
  assert.equal(body.error, null);
  assert.equal(data.status, "ok");
  assert.equal(data.database, "up");
  assert.ok(body.meta.requestId.startsWith("req_"));
});

test("e2e: the OpenAPI document is served and versioned", { skip: SKIP }, async () => {
  const response = await get("/api/v1/openapi.json");
  assert.equal(response.status, 200);

  const document = (await response.json()) as { openapi: string; paths: Record<string, unknown> };
  assert.match(document.openapi, /^3\.1\./);
  assert.ok(Object.keys(document.paths).length >= 20);
});

test("e2e: the marketing site renders", { skip: SKIP }, async () => {
  for (const path of ["/", "/pricing", "/how-it-works", "/help"]) {
    const response = await get(path);
    assert.equal(response.status, 200, `${path} should render`);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  }
});

test("e2e: the seeded storefront renders on the /store route", { skip: SKIP }, async () => {
  const response = await get("/store/nokshi-demo");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.length > 1_000);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
});

test("e2e: the admin panel redirects a signed-out visitor to login", { skip: SKIP }, async () => {
  const response = await get("/admin");
  assert.ok(
    [301, 302, 303, 307, 308].includes(response.status),
    `expected a redirect, got ${response.status}`,
  );
  assert.match(response.headers.get("location") ?? "", /\/login/);
});

test("e2e: the API refuses anonymous access with the standard envelope", { skip: SKIP }, async () => {
  const response = await get("/api/v1/me");
  assert.equal(response.status, 401);

  const body = (await response.json()) as Envelope;
  assert.equal(body.data, null);
  assert.equal(body.error?.code, "UNAUTHENTICATED");
  assert.ok(body.meta.requestId.startsWith("req_"));
});

test("e2e: a malformed request body fails validation, not with a 500", { skip: SKIP }, async () => {
  const response = await get("/api/v1/auth/request-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 422);

  const body = (await response.json()) as Envelope;
  assert.equal(body.error?.code, "VALIDATION_FAILED");
});

test("e2e: every response carries the baseline security headers", { skip: SKIP }, async () => {
  const response = await get("/");
  const headers = response.headers;

  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.match(headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(headers.get("referrer-policy") ?? "", /strict-origin-when-cross-origin/);
  assert.match(headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.equal(headers.get("x-powered-by"), null);
});

test("e2e: unknown pages return a 404, not an unhandled error", { skip: SKIP }, async () => {
  const response = await get("/this-page-does-not-exist");
  assert.equal(response.status, 404);
});
