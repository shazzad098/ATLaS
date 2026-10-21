import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInvoiceNumber,
  buildOrderNo,
  daysBetween,
  daysRemaining,
  formatDate,
  monthBounds,
  nextPeriodEnd,
} from "./dates.ts";

test("nextPeriodEnd advances by whole months", () => {
  const start = new Date("2026-01-15T06:00:00Z");
  assert.equal(nextPeriodEnd(start).getTime(), new Date("2026-02-15T06:00:00Z").getTime());
  assert.equal(nextPeriodEnd(start, 12).getTime(), new Date("2027-01-15T06:00:00Z").getTime());
});

test("nextPeriodEnd clamps month-end instead of overflowing", () => {
  const jan31 = new Date("2026-01-31T06:00:00Z");
  const feb = nextPeriodEnd(jan31);
  // Local getters: date-fns works in the server's local clock.
  assert.equal(feb.getMonth(), 1, "should land in February");
  assert.ok(feb.getDate() <= 28, "must not roll into March");
});

test("daysBetween rounds partial days up", () => {
  const a = new Date("2026-10-01T00:00:00Z");
  assert.equal(daysBetween(a, new Date("2026-10-03T00:00:00Z")), 2);
  assert.equal(daysBetween(a, new Date("2026-10-02T12:00:00Z")), 2);
  assert.equal(daysBetween(a, a), 0);
});

test("daysRemaining returns null without a target", () => {
  assert.equal(daysRemaining(null), null);
  assert.equal(daysRemaining(undefined), null);
});

test("buildOrderNo is prefixed, sortable and fixed width", () => {
  const orderNo = buildOrderNo(new Date("2026-10-21T09:30:00Z"));
  assert.match(orderNo, /^AT-\d{6}-\d{6}$/);
  assert.ok(orderNo.startsWith("AT-261021-"));
});

test("buildInvoiceNumber is zero-padded and includes the year", () => {
  assert.equal(buildInvoiceNumber(7, new Date("2026-10-21T00:00:00Z")), "INV-2026-000007");
  assert.equal(buildInvoiceNumber(123456, new Date("2026-10-21T00:00:00Z")), "INV-2026-123456");
});

test("formatDate renders in Asia/Dhaka and handles empty input", () => {
  assert.equal(formatDate(new Date("2026-10-21T00:00:00Z")), "21 Oct 2026");
  assert.equal(formatDate("2026-01-01T00:00:00Z"), "01 Jan 2026");
  assert.equal(formatDate(null), "—");
});

test("monthBounds covers the whole month", () => {
  const { start, end } = monthBounds(new Date("2026-02-14T12:00:00Z"));
  assert.equal(start.getMonth(), 1);
  assert.equal(start.getDate(), 1);
  assert.equal(start.getHours(), 0);
  assert.equal(end.getMonth(), 1);
  assert.equal(end.getDate(), 28);
});
