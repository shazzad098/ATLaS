import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMITTED_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  allowedNextStatuses,
  canTransition,
} from "./order-state.ts";

test("every status has a transition row and a Bangla label", () => {
  for (const status of ORDER_STATUSES) {
    assert.ok(ORDER_TRANSITIONS[status], `missing transitions for ${status}`);
    assert.ok(ORDER_STATUS_LABELS[status], `missing label for ${status}`);
  }
});

test("transition targets are always known statuses", () => {
  const known = new Set<string>(ORDER_STATUSES);
  for (const [from, targets] of Object.entries(ORDER_TRANSITIONS)) {
    for (const to of targets) {
      assert.ok(known.has(to), `${from} -> ${to} is not a known status`);
    }
  }
});

test("CANCELLED and REFUNDED are terminal", () => {
  assert.deepEqual(ORDER_TRANSITIONS.CANCELLED, []);
  assert.deepEqual(ORDER_TRANSITIONS.REFUNDED, []);
});

test("nothing ever transitions back to PENDING_PAYMENT", () => {
  for (const targets of Object.values(ORDER_TRANSITIONS)) {
    assert.equal(targets.includes("PENDING_PAYMENT"), false);
  }
});

test("COD confirmation reaches the committed states, payment does not skip them", () => {
  assert.equal(canTransition("PENDING_PAYMENT", "CONFIRMED"), true);
  assert.equal(canTransition("PENDING_PAYMENT", "SHIPPED"), false);
  assert.equal(canTransition("PAID", "CONFIRMED"), true);
  assert.equal(canTransition("PAID", "SHIPPED"), false);
  assert.equal(canTransition("CONFIRMED", "SHIPPED"), true);
});

test("a delivered order can request a return but not be re-shipped", () => {
  assert.equal(canTransition("DELIVERED", "RETURN_REQUESTED"), true);
  assert.equal(canTransition("DELIVERED", "SHIPPED"), false);
  assert.equal(canTransition("RETURN_REQUESTED", "RETURNED"), true);
  assert.equal(canTransition("RETURNED", "REFUNDED"), true);
});

test("refunds are reachable from every paid-side status", () => {
  for (const status of ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "RETURN_REQUESTED", "RETURNED"] as const) {
    assert.equal(canTransition(status, "REFUNDED"), true, `${status} should allow a refund`);
  }
});

test("terminal states reject every transition", () => {
  for (const status of ["CANCELLED", "REFUNDED"] as const) {
    for (const target of ORDER_STATUSES) {
      assert.equal(canTransition(status, target), false);
    }
  }
});

test("unknown statuses fail closed", () => {
  assert.equal(canTransition("NOT_A_STATUS", "PAID"), false);
  assert.equal(canTransition("PAID", "NOT_A_STATUS"), false);
  assert.deepEqual(allowedNextStatuses("NOT_A_STATUS"), []);
});

test("committed statuses are a subset of the machine and exclude terminal states", () => {
  for (const status of COMMITTED_STATUSES) {
    assert.ok(ORDER_STATUSES.includes(status));
  }
  assert.equal(COMMITTED_STATUSES.includes("CANCELLED"), false);
  assert.equal(COMMITTED_STATUSES.includes("REFUNDED"), false);
});
