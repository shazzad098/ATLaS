import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits } from "./rate-limit.ts";

test("allows requests up to the limit, then blocks until the window resets", () => {
  resetRateLimits();
  const key = "test:basic";

  for (let i = 0; i < 3; i += 1) {
    assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
  }

  const blocked = checkRateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.limit, 3);
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
});

test("independent keys do not share a bucket", () => {
  resetRateLimits();

  assert.equal(checkRateLimit("test:a", 1, 60_000).ok, true);
  assert.equal(checkRateLimit("test:a", 1, 60_000).ok, false);
  assert.equal(checkRateLimit("test:b", 1, 60_000).ok, true);
});

test("an expired window starts a fresh count", () => {
  resetRateLimits();
  const key = "test:window";

  assert.equal(checkRateLimit(key, 1, 0).ok, true);
  // A zero-length window is already expired on the next call.
  assert.equal(checkRateLimit(key, 1, 0).ok, true);
});
