import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { toDecimalString } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import type { Tx } from "@/lib/services/fee-service";

/**
 * Discount codes (FR-08).
 *
 * Codes are unique per store and validated at checkout by `cart-service`, so a
 * coupon can never be applied by the client alone.
 */

export const couponInputSchema = z.object({
  code: z
    .string()
    .min(3, "কোড কমপক্ষে ৩ অক্ষরের হতে হবে।")
    .max(24)
    .transform((value) => value.trim().toUpperCase()),
  type: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
  value: z.coerce.number().positive("ছাড়ের পরিমাণ দিন।").max(1_000_000),
  minOrder: z.coerce.number().min(0).default(0),
  usageLimit: z.coerce.number().int().min(0).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export type CouponInput = z.infer<typeof couponInputSchema>;

export async function listCoupons(storeId: string) {
  return prisma.coupon.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createCoupon(actor: ActorContext, storeId: string, raw: unknown) {
  assertPermission(actor, "discounts:write");
  await assertStoreAccess(actor, storeId);
  const input = couponInputSchema.parse(raw);

  const clash = await prisma.coupon.findFirst({ where: { storeId, code: input.code }, select: { id: true } });
  if (clash) throw new ConflictError("এই কোডটি আগেই ব্যবহৃত হয়েছে।");

  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code: input.code,
      type: input.type,
      value: toDecimalString(input.value) as never,
      minOrder: toDecimalString(input.minOrder) as never,
      usageLimit: input.usageLimit && input.usageLimit > 0 ? input.usageLimit : null,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
      status: input.status,
    },
  });

  await recordAudit({
    action: "coupon.created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Coupon",
    resourceId: coupon.id,
    metadata: { storeId, code: coupon.code },
  });

  return coupon;
}

export async function updateCoupon(actor: ActorContext, storeId: string, couponId: string, raw: unknown) {
  assertPermission(actor, "discounts:write");
  await assertStoreAccess(actor, storeId);
  const input = couponInputSchema.parse(raw);

  const existing = await prisma.coupon.findFirst({ where: { id: couponId, storeId }, select: { id: true } });
  if (!existing) throw new NotFoundError("Coupon");

  const clash = await prisma.coupon.findFirst({
    where: { storeId, code: input.code, id: { not: couponId } },
    select: { id: true },
  });
  if (clash) throw new ConflictError("এই কোডটি আগেই ব্যবহৃত হয়েছে।");

  return prisma.coupon.update({
    where: { id: couponId },
    data: {
      code: input.code,
      type: input.type,
      value: toDecimalString(input.value) as never,
      minOrder: toDecimalString(input.minOrder) as never,
      usageLimit: input.usageLimit && input.usageLimit > 0 ? input.usageLimit : null,
      startsAt: toDate(input.startsAt),
      endsAt: toDate(input.endsAt),
      status: input.status,
    },
  });
}

export async function archiveCoupon(actor: ActorContext, storeId: string, couponId: string) {
  assertPermission(actor, "discounts:write");
  await assertStoreAccess(actor, storeId);
  const removed = await prisma.coupon.updateMany({
    where: { id: couponId, storeId },
    data: { status: "ARCHIVED" },
  });
  if (removed.count === 0) throw new NotFoundError("Coupon");
}

/** Reserve one finite coupon slot while the order/payment is pending. */
export async function reserveCoupon(tx: Tx, couponId: string): Promise<void> {
  const affected = await tx.$executeRaw`
    UPDATE "Coupon"
       SET "reservedCount" = "reservedCount" + 1
     WHERE "id" = ${couponId}
       AND "status" = 'ACTIVE'
       AND ("usageLimit" IS NULL OR "usedCount" + "reservedCount" < "usageLimit")
  `;
  if (affected === 0) throw new ConflictError("এই কুপনের ব্যবহার সীমা শেষ হয়ে গেছে।");
}

/** Finalize a pending reservation exactly once for a successful order. */
export async function finalizeCouponRedemption(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { storeId: true, couponCode: true, couponRedeemedAt: true, couponReleasedAt: true },
    });
    if (!order?.couponCode || order.couponRedeemedAt || order.couponReleasedAt) return false;
    const claimed = await tx.order.updateMany({
      where: { id: orderId, couponRedeemedAt: null, couponReleasedAt: null },
      data: { couponRedeemedAt: new Date() },
    });
    if (claimed.count === 0) return false;
    await tx.$executeRaw`
      UPDATE "Coupon"
         SET "reservedCount" = GREATEST("reservedCount" - 1, 0),
             "usedCount" = "usedCount" + 1
       WHERE "storeId" = ${order.storeId} AND "code" = ${order.couponCode}
    `;
    return true;
  });
}

/** Release a pending reservation exactly once for a failed/cancelled order. */
export async function releaseCouponReservation(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { storeId: true, couponCode: true, couponRedeemedAt: true, couponReleasedAt: true },
    });
    if (!order?.couponCode || order.couponRedeemedAt || order.couponReleasedAt) return false;
    const claimed = await tx.order.updateMany({
      where: { id: orderId, couponRedeemedAt: null, couponReleasedAt: null },
      data: { couponReleasedAt: new Date() },
    });
    if (claimed.count === 0) return false;
    await tx.$executeRaw`
      UPDATE "Coupon"
         SET "reservedCount" = GREATEST("reservedCount" - 1, 0)
       WHERE "storeId" = ${order.storeId} AND "code" = ${order.couponCode}
    `;
    return true;
  });
}
