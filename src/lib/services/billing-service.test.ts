import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import {
  markInvoicePaidBySystem,
  runBillingSweep,
  startTrial,
} from "@/lib/services/billing-service";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { DB_TEST_SKIP, createStoreFixture } from "@/lib/testing/fixtures";

/**
 * Billing owns the platform's revenue and the merchant's access. The audit
 * history of this project shows the failure modes that matter: a Free plan
 * getting suspended, a merchant settling its own invoice, and paying without
 * the store coming back. Each of those is pinned here.
 *
 * `runBillingSweep` is idempotent and global, so every test moves its own
 * subscription into the past and then runs the same production entry point.
 */

const DAY = 86_400_000;

async function subscriptionFor(tenantId: string) {
  return prisma.subscription.findUniqueOrThrow({
    where: { tenantId },
    include: { plan: true },
  });
}

test(
  "billing: the Free plan renews itself and is never invoiced or suspended",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ planCode: "free" });
    try {
      await prisma.subscription.update({
        where: { tenantId: fx.tenantId },
        data: { currentPeriodEnd: new Date(Date.now() - DAY) },
      });

      await runBillingSweep();

      const subscription = await subscriptionFor(fx.tenantId);
      assert.equal(subscription.status, "ACTIVE");
      assert.equal(subscription.plan.code, "free");
      assert.ok(subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date());

      assert.equal(await prisma.invoice.count({ where: { tenantId: fx.tenantId } }), 0);

      const store = await prisma.store.findUniqueOrThrow({ where: { id: fx.storeId } });
      assert.equal(store.status, "PUBLISHED");
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "billing: an unpaid renewal raises an invoice and enters the grace period",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ planCode: "basic" });
    try {
      // Subscription prices start at 0 until the platform owner sets them in
      // Super Admin → Plans, so pin one here to make the invoice amount assertable.
      await prisma.plan.update({ where: { code: "basic" }, data: { price: "1500.00" } });

      await prisma.subscription.update({
        where: { tenantId: fx.tenantId },
        data: { currentPeriodEnd: new Date(Date.now() - DAY) },
      });

      const result = await runBillingSweep();
      assert.equal(result.invoicesRaised, 1);
      assert.equal(result.enteredGrace, 1);

      const subscription = await subscriptionFor(fx.tenantId);
      assert.equal(subscription.status, "GRACE_PERIOD");
      assert.ok(subscription.graceEndsAt);

      const invoices = await prisma.invoice.findMany({ where: { tenantId: fx.tenantId } });
      assert.equal(invoices.length, 1);
      assert.equal(invoices[0].status, "OPEN");
      assert.equal(Number(invoices[0].total), 1500);

      // Grace still serves customers; only read-only blocks writes.
      const snapshot = await loadEntitlementSnapshot(fx.tenantId);
      assert.equal(snapshot.readOnly, false);

      // The sweep is safe to run twice: the claim prevents a duplicate invoice.
      await runBillingSweep();
      assert.equal(await prisma.invoice.count({ where: { tenantId: fx.tenantId } }), 1);
    } finally {
      await prisma.plan.update({ where: { code: "basic" }, data: { price: "0.00" } });
      await fx.cleanup();
    }
  },
);

test(
  "billing: an expired grace period moves the tenant to read-only",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ planCode: "basic" });
    try {
      await prisma.subscription.update({
        where: { tenantId: fx.tenantId },
        data: {
          status: "GRACE_PERIOD",
          currentPeriodEnd: new Date(Date.now() - 10 * DAY),
          lastPaymentFailedAt: new Date(Date.now() - 9 * DAY),
          graceEndsAt: new Date(Date.now() - DAY),
        },
      });

      const result = await runBillingSweep();
      assert.equal(result.movedToReadOnly, 1);

      const subscription = await subscriptionFor(fx.tenantId);
      assert.equal(subscription.status, "READ_ONLY");

      const snapshot = await loadEntitlementSnapshot(fx.tenantId);
      assert.equal(snapshot.readOnly, true);
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "billing: settling the invoice restores the subscription and the storefront",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ planCode: "basic" });
    try {
      await prisma.subscription.update({
        where: { tenantId: fx.tenantId },
        data: {
          status: "READ_ONLY",
          currentPeriodEnd: new Date(Date.now() - 10 * DAY),
          graceEndsAt: new Date(Date.now() - DAY),
        },
      });
      // Simulate the suspended state the previous sweep phase would leave behind.
      await prisma.store.update({ where: { id: fx.storeId }, data: { status: "SUSPENDED" } });
      await prisma.tenant.update({ where: { id: fx.tenantId }, data: { status: "SUSPENDED" } });

      const invoice = await prisma.invoice.create({
        data: {
          tenantId: fx.tenantId,
          subscriptionId: (await subscriptionFor(fx.tenantId)).id,
          number: `INV-TEST-${Date.now().toString(36)}`,
          currency: "BDT",
          status: "OPEN",
          dueAt: new Date(),
          subtotal: "1000.00",
          total: "1000.00",
          linesJson: [] as never,
        },
      });

      await markInvoicePaidBySystem(invoice.id, "integration test settlement");

      const subscription = await subscriptionFor(fx.tenantId);
      assert.equal(subscription.status, "ACTIVE");
      assert.ok(subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date());

      const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      assert.equal(paid.status, "PAID");

      const store = await prisma.store.findUniqueOrThrow({ where: { id: fx.storeId } });
      assert.equal(store.status, "PUBLISHED");
      const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: fx.tenantId } });
      assert.equal(tenant.status, "ACTIVE");
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "billing: a trial can only be started once per workspace",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture({ planCode: "free" });
    try {
      const trial = await startTrial(fx.actor, "basic");
      assert.equal(trial.status, "TRIALING");
      assert.ok(trial.trialUsedAt);

      await assert.rejects(
        startTrial(fx.actor, "standard"),
        (error: Error & { code?: string }) =>
          error.name === "AppError" && error.code === "TRIAL_ALREADY_USED",
      );

      // Cancelling the trial does not reset the one-time concession.
      await prisma.subscription.update({
        where: { tenantId: fx.tenantId },
        data: { status: "CANCELLED", cancelAtPeriodEnd: true },
      });
      await assert.rejects(
        startTrial(fx.actor, "basic"),
        (error: Error & { code?: string }) => error.code === "TRIAL_ALREADY_USED",
      );
    } finally {
      await fx.cleanup();
    }
  },
);
