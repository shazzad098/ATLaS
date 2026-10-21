import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMoney,
  compareMoney,
  feeBase,
  formatBdt,
  fromPaisa,
  isZero,
  rateOf,
  subtractMoney,
  toDecimalString,
  toNumber,
  toPaisa,
} from "./money.ts";

test("toPaisa parses decimals into integer paisa", () => {
  assert.equal(toPaisa("1250.00"), 125_000n);
  assert.equal(toPaisa(99.5), 9_950n);
  assert.equal(toPaisa("0"), 0n);
  assert.equal(toPaisa(null), 0n);
  assert.equal(toPaisa(undefined), 0n);
  assert.equal(toPaisa(""), 0n);
});

test("toPaisa rounds half away from zero, never truncates", () => {
  assert.equal(toPaisa("0.005"), 1n);
  assert.equal(toPaisa("1.005"), 101n);
  assert.equal(toPaisa("1.004"), 100n);
  assert.equal(toPaisa("-1.50"), -150n);
  assert.equal(toPaisa("-0.005"), -1n);
});

test("fromPaisa renders fixed two decimals", () => {
  assert.equal(fromPaisa(125_000n), "1250.00");
  assert.equal(fromPaisa(5n), "0.05");
  assert.equal(fromPaisa(0n), "0.00");
  assert.equal(fromPaisa(-150n), "-1.50");
});

test("toDecimalString is a Prisma-safe decimal string", () => {
  assert.equal(toDecimalString(1250), "1250.00");
  assert.equal(toDecimalString("99.999"), "100.00");
});

test("toNumber round-trips through paisa", () => {
  assert.equal(toNumber("1250.00"), 1250);
  assert.equal(toNumber("0.05"), 0.05);
});

test("rateOf computes plan and courier rates exactly", () => {
  assert.equal(rateOf("1000.00", 0.025), "25.00");
  assert.equal(rateOf("999.99", 0.005), "5.00");
  assert.equal(rateOf("1000.00", 0), "0.00");
  assert.equal(rateOf("1000.00", 0.02), "20.00");
  assert.equal(rateOf("0.10", 0.5), "0.05");
});

test("rateOf rounds the half-paisa up", () => {
  // 1.00 * 0.5% = 0.005 BDT = 0.5 paisa -> 1 paisa.
  assert.equal(rateOf("1.00", 0.005), "0.01");
});

test("feeBase removes discounts and never goes negative", () => {
  assert.equal(feeBase("1500.00", "200.00"), "1300.00");
  assert.equal(feeBase("100.00", "150.00"), "0.00");
  assert.equal(feeBase("100.00", "0"), "100.00");
});

test("addMoney and subtractMoney stay in integer paisa", () => {
  assert.equal(addMoney("0.10", "0.20"), "0.30");
  assert.equal(addMoney("1250.50", "0.50"), "1251.00");
  assert.equal(subtractMoney("1250.00", "250.55"), "999.45");
});

test("formatBdt groups thousands and keeps the taka symbol", () => {
  assert.equal(formatBdt("1234567.5"), "৳1,234,567.50");
  assert.equal(formatBdt("0"), "৳0.00");
  assert.equal(formatBdt("-1250.00"), "-৳1,250.00");
  assert.equal(formatBdt("1234.00", { withSymbol: false }), "1,234.00");
});

test("compareMoney and isZero ignore representation", () => {
  assert.equal(compareMoney("1.00", 1), 0);
  assert.equal(compareMoney("1.00", "1.01"), -1);
  assert.equal(compareMoney("1.01", "1.00"), 1);
  assert.equal(isZero("0.00"), true);
  assert.equal(isZero("0.01"), false);
});
