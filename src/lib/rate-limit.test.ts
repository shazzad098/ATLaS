import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimit,
  checkRateLimitLocal,
  createMemoryStore,
  resetRateLimits,
} from "./rate-limit.ts";

test("allows requests up to the limit, then blocks until the window resets", () => {
  resetRateLimits();
  const key = "test:basic";

  for (let i = 0; i < 3; i += 1) {
    assert.equal(checkRateLimitLocal(key, 3, 60_000).ok, true);
  }

  const blocked = checkRateLimitLocal(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.limit, 3);
  assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
});

test("independent keys do not share a bucket", () => {
  resetRateLimits();

  assert.equal(checkRateLimitLocal("test:a", 1, 60_000).ok, true);
  assert.equal(checkRateLimitLocal("test:a", 1, 60_000).ok, false);
  assert.equal(checkRateLimitLocal("test:b", 1, 60_000).ok, true);
});

test("an expired window starts a fresh count", () => {
  resetRateLimits();
  const key = "test:window";

  assert.equal(checkRateLimitLocal(key, 1, 0).ok, true);
  // A zero-length window is already expired on the next call.
  assert.equal(checkRateLimitLocal(key, 1, 0).ok, true);
});

test("the async edge gate counts through the configured store", async () => {
  resetRateLimits();
  const key = `test:edge:${Date.now()}`;

  assert.equal((await checkRateLimit(key, 2, 60_000)).ok, true);
  assert.equal((await checkRateLimit(key, 2, 60_000)).ok, true);

  const blocked = await checkRateLimit(key, 2, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("a store keeps its own window per key", async () => {
  const store = createMemoryStore();
  const first = await store.hit("a", 1_000);
  const second = await store.hit("a", 1_000);

  assert.equal(first.count, 1);
  assert.equal(second.count, 2);
  assert.equal(first.resetAt, second.resetAt);
});

test("a broken remote store degrades to the local window instead of failing", async () => {
  resetRateLimits();
  process.env.RATE_LIMIT_DRIVER = "redis";
  process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:1";
  process.env.UPSTASH_REDIS_REST_TOKEN = "invalid";

  try {
    const key = `test:degrade:${Date.now()}`;
    const result = await checkRateLimit(key, 5, 60_000);
    assert.equal(result.ok, true);
  } finally {
    delete process.env.RATE_LIMIT_DRIVER;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});
