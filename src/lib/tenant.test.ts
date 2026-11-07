import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { assertStoreAccess, findStoreBySlug } from "@/lib/tenant";
import { createStoreFixture, DB_TEST_SKIP } from "@/lib/testing/fixtures";

/**
 * `assertStoreAccess` is the single guard every store-scoped service calls, so
 * it is worth testing directly rather than only through its callers: one
 * regression here exposes every merchant's data at once.
 */

test(
  "tenant: a member may access its own store",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      await assert.doesNotReject(assertStoreAccess(fx.actor, fx.storeId));
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "tenant: another tenant's store is refused, not silently ignored",
  { skip: DB_TEST_SKIP },
  async () => {
    const mine = await createStoreFixture();
    const theirs = await createStoreFixture();
    try {
      await assert.rejects(
        assertStoreAccess(mine.actor, theirs.storeId),
        (error: Error & { code?: string }) =>
          error.name === "TenantMismatchError" || error.code === "TENANT_MISMATCH",
      );
    } finally {
      await mine.cleanup();
      await theirs.cleanup();
    }
  },
);

test(
  "tenant: an unknown or archived store looks missing rather than forbidden",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      await assert.rejects(
        assertStoreAccess(fx.actor, "does-not-exist"),
        (error: Error & { code?: string }) => error.code === "NOT_FOUND",
      );

      // Soft delete must hide the store from the guard as well.
      await prisma.store.update({
        where: { id: fx.storeId },
        data: { deletedAt: new Date() },
      });
      await assert.rejects(
        assertStoreAccess(fx.actor, fx.storeId),
        (error: Error & { code?: string }) => error.code === "NOT_FOUND",
      );
    } finally {
      await fx.cleanup();
    }
  },
);

test(
  "tenant: storefront lookup ignores archived stores",
  { skip: DB_TEST_SKIP },
  async () => {
    const fx = await createStoreFixture();
    try {
      const live = await findStoreBySlug(fx.slug);
      assert.equal(live?.id, fx.storeId);

      await prisma.store.update({
        where: { id: fx.storeId },
        data: { deletedAt: new Date() },
      });

      assert.equal(await findStoreBySlug(fx.slug), null);
    } finally {
      await fx.cleanup();
    }
  },
);
