import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_CODES, PLAN_DEFINITIONS, formatLimit, formatRate, isUnlimited } from "./plans.ts";

test("all public plan codes have complete entitlement definitions", () => {
  assert.deepEqual(PLAN_CODES, ["free", "basic", "standard", "pro"]);
  for (const code of PLAN_CODES) {
    const plan = PLAN_DEFINITIONS[code];
    assert.equal(plan.code, code);
    assert.ok(plan.$limits.requestsPerMinute > 0);
    assert.equal(typeof plan.$features.publishStore, "boolean");
  }
});

test("plan limit and rate formatting is deterministic", () => {
  assert.equal(formatLimit(null), "Unlimited");
  assert.equal(formatLimit(250, "products"), "250 products");
  assert.equal(formatRate(0.025), "2.50%");
  assert.equal(isUnlimited(null), true);
  assert.equal(isUnlimited(0), false);
});
