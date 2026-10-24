import assert from "node:assert/strict";
import test from "node:test";
import { ANALYTICS_EVENTS } from "./analytics-taxonomy.ts";

test("analytics taxonomy contains every required funnel event", () => {
  const required = [
    "signup_completed",
    "store_created",
    "theme_selected",
    "first_product_created",
    "store_published",
    "checkout_started",
    "payment_succeeded",
    "order_created",
    "subscription_started",
    "subscription_renewed",
    "subscription_failed",
    "plan_upgraded",
  ];
  assert.deepEqual([...ANALYTICS_EVENTS], required);
});
