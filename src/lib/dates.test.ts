import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceNumber, buildOrderNo, nextPeriodEnd } from "./dates.ts";

test("invoice and order identifiers are stable and formatted", () => {
  const date = new Date("2026-10-23T12:00:00.000Z");
  assert.equal(buildInvoiceNumber(42, date), "INV-2026-000042");
  assert.match(buildOrderNo(date), /^AT-261023-\d{6}$/);
});

test("billing periods advance by whole months", () => {
  const start = new Date("2026-01-15T00:00:00.000Z");
  assert.equal(nextPeriodEnd(start, 1).toISOString(), "2026-02-15T00:00:00.000Z");
  assert.equal(nextPeriodEnd(start, 12).toISOString(), "2027-01-15T00:00:00.000Z");
});
