import test from "node:test";
import assert from "node:assert/strict";
import { isSuccessfulSaleStatus, SUCCESSFUL_ORDER_STATUSES } from "./order-status.ts";

test("only completed/paid order states count as successful sales", () => {
  assert.deepEqual([...SUCCESSFUL_ORDER_STATUSES], [
    "PAID",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
  ]);
  for (const status of SUCCESSFUL_ORDER_STATUSES) {
    assert.equal(isSuccessfulSaleStatus(status), true);
  }
  for (const status of ["PENDING_PAYMENT", "CANCELLED", "REFUNDED", "RETURN_REQUESTED", "RETURNED"]) {
    assert.equal(isSuccessfulSaleStatus(status), false);
  }
});
