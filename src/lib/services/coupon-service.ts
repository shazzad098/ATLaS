import { z } from "zod";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { toDecimalString } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import { assertFeature, requireWritableTenant } from "@/lib/entitlements";

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

/**
 * Coupon dates come from `<input type="date">` (YYYY-MM-DD). Parse them in the
 * platform timezone: `new Date("2026-10-31")` is UTC midnight, which at UTC+6
 * would keep a "today" coupon inactive until 6 AM in Dhaka.
 */
const DHAKA_OFFSET = "+06:00";

function toDate(value: string | undefined, boundary: "start" | "end"): Date | null {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = dateOnly
    ? new Date(
        `${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}${DHAKA_OFFSET}`,
      )
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createCoupon(actor: ActorContext, storeId: string, raw: unknown) {
  assertPermission(actor, "discounts:write");
  await assertStoreAccess(actor, storeId);
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertFeature(snapshot, "discountCampaigns");
  const input = couponInputSchema.parse(raw);

  const clash = await prisma.coupon.findFirst({ where: { storeId, code: input.code }, select: { id: true } });
  if (clash) throw new ConflictError("এই কোডটি আগেই ব্যবহৃত হয়েছে।");

  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code: input.code,
      type: input.type,
      value: toDecimalString(input.value),
      minOrder: toDecimalString(input.minOrder),
      usageLimit: input.usageLimit && input.usageLimit > 0 ? input.usageLimit : null,
      startsAt: toDate(input.startsAt, "start"),
      endsAt: toDate(input.endsAt, "end"),
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
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertFeature(snapshot, "discountCampaigns");
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
      value: toDecimalString(input.value),
      minOrder: toDecimalString(input.minOrder),
      usageLimit: input.usageLimit && input.usageLimit > 0 ? input.usageLimit : null,
      startsAt: toDate(input.startsAt, "start"),
      endsAt: toDate(input.endsAt, "end"),
      status: input.status,
    },
  });
}

export async function archiveCoupon(actor: ActorContext, storeId: string, couponId: string) {
  assertPermission(actor, "discounts:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);
  const removed = await prisma.coupon.updateMany({
    where: { id: couponId, storeId },
    data: { status: "ARCHIVED" },
  });
  if (removed.count === 0) throw new NotFoundError("Coupon");
}
