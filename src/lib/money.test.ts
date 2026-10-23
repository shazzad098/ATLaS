import test from "node:test";
import assert from "node:assert/strict";
import {
  addMoney,
  compareMoney,
  feeBase,
  formatBdt,
  rateOf,
  toDecimalString,
  toPaisa,
} from "./money.ts";

test("money arithmetic stays exact in paisa", () => {
  assert.equal(toPaisa("10.005"), 1001n);
  assert.equal(addMoney("10.10", "0.20", "0.05"), "10.35");
  assert.equal(compareMoney("1.00", "0.99"), 1);
  assert.equal(toDecimalString("৳1,250.00".replace("৳", "").replace(",", "")), "1250.00");
});

test("fee base excludes discounts and never becomes negative", () => {
  assert.equal(feeBase("100.00", "12.50"), "87.50");
  assert.equal(feeBase("10.00", "12.50"), "0.00");
  assert.equal(rateOf("100.00", "0.025"), "2.50");
  assert.equal(formatBdt("1250"), "৳1,250.00");
});
