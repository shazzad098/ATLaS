import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INACTIVE_DAYS,
  VIP_ORDER_COUNT,
  VIP_SPEND_PAISA,
  classifyCustomer,
  type CustomerSnapshot,
} from "./customer-segments.ts";

const NOW = new Date("2026-10-23T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function snapshot(patch: Partial<CustomerSnapshot> = {}): CustomerSnapshot {
  return {
    orderCount: 0,
    lifetimePaisa: 0n,
    lastOrderAt: null,
    isBlacklisted: false,
    ...patch,
  };
}

test("customers without orders or with a single order are new", () => {
  assert.equal(classifyCustomer(snapshot(), NOW), "new");
  assert.equal(
    classifyCustomer(snapshot({ orderCount: 1, lastOrderAt: daysAgo(2), lifetimePaisa: 50_000n }), NOW),
    "new",
  );
});

test("two or more orders become repeat when no other rule matches", () => {
  assert.equal(
    classifyCustomer(snapshot({ orderCount: 2, lastOrderAt: daysAgo(3), lifetimePaisa: 90_000n }), NOW),
    "repeat",
  );
});

test("VIP is reached by lifetime spend or order count", () => {
  assert.equal(
    classifyCustomer(snapshot({ orderCount: 2, lastOrderAt: daysAgo(1), lifetimePaisa: VIP_SPEND_PAISA }), NOW),
    "vip",
  );
  assert.equal(
    classifyCustomer(
      snapshot({ orderCount: VIP_ORDER_COUNT, lastOrderAt: daysAgo(1), lifetimePaisa: 10_000n }),
      NOW,
    ),
    "vip",
  );
});

test("inactive needs an old last order and outranks repeat", () => {
  assert.equal(
    classifyCustomer(
      snapshot({ orderCount: 3, lastOrderAt: daysAgo(INACTIVE_DAYS + 1), lifetimePaisa: 100_000n }),
      NOW,
    ),
    "inactive",
  );
  assert.equal(
    classifyCustomer(
      snapshot({ orderCount: 3, lastOrderAt: daysAgo(INACTIVE_DAYS), lifetimePaisa: 100_000n }),
      NOW,
    ),
    "repeat",
  );
});

test("blacklist always wins", () => {
  assert.equal(
    classifyCustomer(
      snapshot({ isBlacklisted: true, orderCount: 10, lastOrderAt: daysAgo(1), lifetimePaisa: 9_000_000n }),
      NOW,
    ),
    "blacklisted",
  );
});
