import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEATURE_LABELS,
  PLAN_CODES,
  PLAN_DEFINITIONS,
  formatLimit,
  formatRate,
  isUnlimited,
  planMatrixFor,
} from "./plans.ts";

test("the plan ladder is sorted Free -> Basic -> Standard -> Pro", () => {
  const sorted = [...PLAN_CODES].sort(
    (a, b) => PLAN_DEFINITIONS[a].sortOrder - PLAN_DEFINITIONS[b].sortOrder,
  );
  assert.deepEqual(sorted, [...PLAN_CODES]);
  assert.equal(planMatrixFor("free").code, "free");
});

test("product quota climbs with the plan, Pro is unlimited", () => {
  const products = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code].$limits.products);
  assert.deepEqual(products, [25, 250, 1000, null]);
  assert.equal(isUnlimited(PLAN_DEFINITIONS.pro.$limits.products), true);
  assert.equal(isUnlimited(PLAN_DEFINITIONS.free.$limits.products), false);
});

test("overage rate falls as the plan grows (PRD 5.1)", () => {
  const rates = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code].$limits.overageRate);
  assert.deepEqual(rates, [0.025, 0.02, 0.01, 0]);
  for (let i = 1; i < rates.length; i += 1) {
    assert.ok(rates[i] <= rates[i - 1], "overage must not increase with a higher plan");
  }
});

test("monthly order quota climbs with the plan, Pro is unlimited", () => {
  assert.deepEqual(
    PLAN_CODES.map((code) => PLAN_DEFINITIONS[code].$limits.monthlyOrders),
    [50, 500, 2000, null],
  );
});

test("staff seats climb 1 -> 2 -> 5 -> 10", () => {
  assert.deepEqual(
    PLAN_CODES.map((code) => PLAN_DEFINITIONS[code].$limits.staffSeats),
    [1, 2, 5, 10],
  );
});

test("only Standard and Pro may switch themes on a published store", () => {
  assert.equal(PLAN_DEFINITIONS.free.$limits.themeSwitching, "STARTER_ONLY");
  assert.equal(PLAN_DEFINITIONS.basic.$limits.themeSwitching, "NOT_ALLOWED");
  assert.equal(PLAN_DEFINITIONS.standard.$limits.themeSwitching, "ALLOWED");
  assert.equal(PLAN_DEFINITIONS.pro.$limits.themeSwitching, "ALLOWED");
});

test("custom domain needs Standard, domain + subdomain needs Pro-level policy", () => {
  assert.equal(PLAN_DEFINITIONS.free.$limits.customDomain, false);
  assert.equal(PLAN_DEFINITIONS.basic.$limits.customDomain, false);
  assert.equal(PLAN_DEFINITIONS.standard.$limits.customDomain, true);
  assert.equal(PLAN_DEFINITIONS.pro.$limits.customDomain, true);
  assert.equal(PLAN_DEFINITIONS.standard.$limits.domainWithSubdomain, true);
});

test("every plan ships at least the two starter themes", () => {
  for (const code of PLAN_CODES) {
    assert.ok(PLAN_DEFINITIONS[code].$limits.themes.includes("nokshi"));
    assert.ok(PLAN_DEFINITIONS[code].$limits.themes.includes("bazar"));
  }
});

test("API access and request rate grow together", () => {
  assert.deepEqual(
    PLAN_CODES.map((code) => PLAN_DEFINITIONS[code].$limits.apiAccess),
    ["READ_ONLY_PUBLIC", "READ_WEBHOOKS", "SCOPED", "FULL"],
  );
  const rates = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code].$limits.requestsPerMinute);
  assert.deepEqual(rates, [60, 120, 300, 600]);
});

test("trial length is 7 days on every plan, Free is the only free price", () => {
  for (const code of PLAN_CODES) {
    assert.equal(PLAN_DEFINITIONS[code].trialDays, 7);
  }
  assert.equal(PLAN_DEFINITIONS.free.monthlyPriceBdt, 0);
  assert.equal(PLAN_DEFINITIONS.basic.monthlyPriceBdt, null);
  assert.equal(PLAN_DEFINITIONS.standard.monthlyPriceBdt, null);
  assert.equal(PLAN_DEFINITIONS.pro.monthlyPriceBdt, null);
});

test("priority support is a paid-tier feature only", () => {
  assert.equal(PLAN_DEFINITIONS.free.$features.prioritySupport, false);
  assert.equal(PLAN_DEFINITIONS.basic.$features.prioritySupport, false);
  assert.equal(PLAN_DEFINITIONS.standard.$features.prioritySupport, true);
  assert.equal(PLAN_DEFINITIONS.pro.$features.onboardingAssistance, true);
});

test("third-party couriers start at Basic", () => {
  assert.equal(PLAN_DEFINITIONS.free.$features.thirdPartyCouriers, false);
  assert.equal(PLAN_DEFINITIONS.basic.$features.thirdPartyCouriers, true);
});

test("formatLimit renders unlimited and grouped numbers", () => {
  assert.equal(formatLimit(null), "Unlimited");
  assert.equal(formatLimit(1000), "1,000");
  assert.equal(formatLimit(2, "seats"), "2 seats");
});

test("formatRate drops trailing zeros", () => {
  assert.equal(formatRate(0.025), "2.5%");
  assert.equal(formatRate(0.02), "2%");
  assert.equal(formatRate(0), "0%");
  assert.equal(formatRate(1), "100%");
});

test("every advertised feature key has a human label", () => {
  for (const key of Object.keys(FEATURE_LABELS)) {
    assert.ok(FEATURE_LABELS[key].length > 0, `missing label for ${key}`);
  }
});
