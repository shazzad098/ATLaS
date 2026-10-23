import Papa from "papaparse";
import { and, asc, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { coupons, customers, deliveryZones, orders } from "../../drizzle/schema";
import { normalizeBdPhone } from "../../shared/domain";
import { fail, toP } from "../lib/core";
import { assertFeature } from "./billing";
import { audit } from "./ops";
import { markOnboarding } from "./stores";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

/* ───────── Customers & segments ───────── */
export const SEGMENTS = ["all", "new", "repeat", "vip", "inactive", "blacklisted", "subscribed"] as const;
export type Segment = (typeof SEGMENTS)[number];
const VIP_SPEND = 10000;

function segmentCond(segment: Segment) {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 3600_000);
  switch (segment) {
    case "new":
      return eq(customers.totalOrders, 1);
    case "repeat":
      return gte(customers.totalOrders, 2);
    case "vip":
      return gte(customers.totalSpent, String(VIP_SPEND));
    case "inactive":
      return lt(customers.lastOrderAt, sixtyDaysAgo);
    case "blacklisted":
      return eq(customers.status, "blacklisted");
    case "subscribed":
      return sql`JSON_EXTRACT(${customers.consentJson}, '$.marketing') = true`;
    default:
      return undefined;
  }
}

export async function listCustomers(scope: TenantScope, q: { search?: string; segment: Segment; page: number; pageSize: number }) {
  requirePerm(scope, "customers.read");
  const s = q.search?.trim() ? `%${q.search.trim()}%` : null;
  const where = and(eq(customers.storeId, scope.storeId), segmentCond(q.segment), s ? or(like(customers.name, s), like(customers.phone, s), like(customers.email, s)) : undefined);
  const [{ total }] = await db().select({ total: sql<number>`count(*)` }).from(customers).where(where);
  const items = await db()
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.lastOrderAt), desc(customers.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const counts: Record<string, number> = {};
  for (const seg of SEGMENTS) {
    const [{ n }] = await db().select({ n: sql<number>`count(*)` }).from(customers).where(and(eq(customers.storeId, scope.storeId), segmentCond(seg)));
    counts[seg] = Number(n);
  }
  const canSeePii = scope.permissions.has("customers.export_pii");
  return {
    items: items.map(c => ({ ...c, phone: canSeePii || scope.permissions.has("orders.write") ? c.phone : `${c.phone.slice(0, 5)}••••${c.phone.slice(-2)}`, segment: segmentOf(c) })),
    total: Number(total),
    counts,
  };
}

function segmentOf(c: typeof customers.$inferSelect) {
  if (c.status === "blacklisted") return "blacklisted";
  if (toP(c.totalSpent) >= VIP_SPEND * 100) return "vip";
  if (c.totalOrders >= 2) return "repeat";
  return "new";
}

export async function customerDetail(scope: TenantScope, id: number) {
  requirePerm(scope, "customers.read");
  const [c] = await db().select().from(customers).where(and(eq(customers.id, id), eq(customers.storeId, scope.storeId))).limit(1);
  if (!c) fail("NOT_FOUND", "Customer not found");
  const history = await db()
    .select({ id: orders.id, orderNo: orders.orderNo, status: orders.status, grandTotal: orders.grandTotal, paymentMethod: orders.paymentMethod, createdAt: orders.createdAt })
    .from(orders)
    .where(and(eq(orders.storeId, scope.storeId), eq(orders.customerId, c.id)))
    .orderBy(desc(orders.createdAt))
    .limit(100);
  const delivered = history.filter(h => h.status === "DELIVERED").length;
  const returned = history.filter(h => ["RETURNED", "CANCELLED"].includes(h.status)).length;
  return { customer: { ...c, segment: segmentOf(c) }, orders: history, stats: { delivered, returnedOrCancelled: returned, successRate: history.length ? Math.round((delivered / history.length) * 100) : null } };
}

export async function updateCustomer(scope: TenantScope, id: number, patch: { notes?: string; tags?: string[]; marketingConsent?: boolean; email?: string | null; name?: string }) {
  requireWrite(scope, "customers.write");
  const [c] = await db().select().from(customers).where(and(eq(customers.id, id), eq(customers.storeId, scope.storeId))).limit(1);
  if (!c) fail("NOT_FOUND", "Customer not found");
  await db()
    .update(customers)
    .set({
      notes: patch.notes ?? c.notes,
      tagsJson: patch.tags ?? c.tagsJson,
      email: patch.email === undefined ? c.email : patch.email,
      name: patch.name ?? c.name,
      consentJson: patch.marketingConsent === undefined ? c.consentJson : { marketing: patch.marketingConsent, updatedAt: new Date().toISOString(), source: "merchant" },
    })
    .where(eq(customers.id, id));
}

export async function setBlacklist(scope: TenantScope, id: number, blacklisted: boolean, reason?: string) {
  requireWrite(scope, "customers.write");
  if (blacklisted && !reason?.trim()) fail("VALIDATION", "Add a reason for blacklisting");
  await db()
    .update(customers)
    .set({ status: blacklisted ? "blacklisted" : "active", blacklistReason: blacklisted ? reason!.trim() : null })
    .where(and(eq(customers.id, id), eq(customers.storeId, scope.storeId)));
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: blacklisted ? "customer.blacklisted" : "customer.unblacklisted", resourceType: "customer", resourceId: id, metadata: { reason }, impersonationId: scope.impersonationId });
}

export async function exportCustomersCsv(scope: TenantScope, segment: Segment) {
  requirePerm(scope, "customers.export_pii");
  assertFeature(scope.ent.limits.reportsLevel !== "basic", "Customer CSV export", "basic");
  const rows = await db().select().from(customers).where(and(eq(customers.storeId, scope.storeId), segmentCond(segment))).orderBy(asc(customers.id));
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "customer.pii_exported", metadata: { segment, count: rows.length }, impersonationId: scope.impersonationId });
  return Papa.unparse(
    rows.map(c => ({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      district: c.addressJson?.district ?? "",
      total_orders: c.totalOrders,
      total_spent: c.totalSpent,
      last_order_at: c.lastOrderAt?.toISOString() ?? "",
      marketing_consent: c.consentJson?.marketing ? "yes" : "no",
      status: c.status,
    }))
  );
}

export async function customerByPhone(storeId: number, phone: string) {
  const p = normalizeBdPhone(phone);
  if (!p) return null;
  const [c] = await db().select().from(customers).where(and(eq(customers.storeId, storeId), eq(customers.phone, p))).limit(1);
  return c ?? null;
}

/* ───────── Coupons ───────── */
export type CouponInput = {
  id?: number;
  code: string;
  type: "percentage" | "fixed";
  value: string;
  minOrder?: string | null;
  maxDiscount?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  firstOrderOnly?: boolean;
  categoryIds?: number[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  status: "active" | "inactive";
};

export async function listCoupons(scope: TenantScope) {
  requirePerm(scope, "discounts.manage");
  return db().select().from(coupons).where(eq(coupons.storeId, scope.storeId)).orderBy(desc(coupons.id));
}

export async function upsertCoupon(scope: TenantScope, input: CouponInput) {
  requireWrite(scope, "discounts.manage");
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) fail("VALIDATION", "Coupon code must be 3–30 letters, numbers, - or _");
  const value = Number(input.value);
  if (!(value > 0)) fail("VALIDATION", "Discount value must be greater than 0");
  if (input.type === "percentage" && value > 90) fail("VALIDATION", "Percentage discount can't exceed 90%");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) fail("VALIDATION", "End date must be after start date");
  const advanced = !!(input.perCustomerLimit || input.firstOrderOnly || input.categoryIds?.length || input.maxDiscount);
  if (advanced && scope.ent.limits.couponLevel !== "advanced")
    fail("FEATURE_NOT_IN_PLAN", "Advanced campaigns (per-customer limits, first-order, category targeting, max discount) are available on the Standard plan and above.", { requiredPlan: "standard" });
  const values = {
    code,
    type: input.type,
    value: value.toFixed(2),
    minOrder: input.minOrder ? Number(input.minOrder).toFixed(2) : null,
    maxDiscount: input.maxDiscount ? Number(input.maxDiscount).toFixed(2) : null,
    usageLimit: input.usageLimit ?? null,
    perCustomerLimit: input.perCustomerLimit ?? null,
    firstOrderOnly: input.firstOrderOnly ?? false,
    categoryIdsJson: input.categoryIds?.length ? input.categoryIds : null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    status: input.status,
  };
  try {
    if (input.id) {
      await db().update(coupons).set(values).where(and(eq(coupons.id, input.id), eq(coupons.storeId, scope.storeId)));
      return input.id;
    }
    const [row] = await db().insert(coupons).values({ ...values, storeId: scope.storeId }).$returningId();
    await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "coupon.created", resourceType: "coupon", resourceId: row.id, metadata: { code }, impersonationId: scope.impersonationId });
    return row.id;
  } catch (e) {
    if (String((e as Error).message).includes("Duplicate")) fail("CONFLICT", `Coupon ${code} already exists`);
    throw e;
  }
}

export async function deleteCoupon(scope: TenantScope, id: number) {
  requireWrite(scope, "discounts.manage");
  const [c] = await db().select().from(coupons).where(and(eq(coupons.id, id), eq(coupons.storeId, scope.storeId))).limit(1);
  if (!c) fail("NOT_FOUND", "Coupon not found");
  if (c.usedCount > 0) {
    await db().update(coupons).set({ status: "inactive" }).where(eq(coupons.id, id));
    return { deactivated: true };
  }
  await db().delete(coupons).where(eq(coupons.id, id));
  return { deleted: true };
}

/* ───────── Delivery zones ───────── */
export async function listZones(storeId: number) {
  return db().select().from(deliveryZones).where(eq(deliveryZones.storeId, storeId)).orderBy(asc(deliveryZones.sortOrder));
}
export async function upsertZone(scope: TenantScope, input: { id?: number; name: string; nameBn?: string; districts: string[]; charge: string; freeAbove?: string | null; etaText?: string; sortOrder?: number; status: "active" | "inactive" }) {
  requireWrite(scope, "delivery.manage");
  if (!input.districts.length) fail("VALIDATION", "Select at least one district (or * for all others)");
  if (Number(input.charge) < 0) fail("VALIDATION", "Delivery charge can't be negative");
  const values = {
    name: input.name.trim(),
    nameBn: input.nameBn ?? null,
    districtsJson: input.districts,
    charge: Number(input.charge).toFixed(2),
    freeAbove: input.freeAbove ? Number(input.freeAbove).toFixed(2) : null,
    etaText: input.etaText ?? null,
    sortOrder: input.sortOrder ?? 0,
    status: input.status,
  };
  let id = input.id;
  if (id) await db().update(deliveryZones).set(values).where(and(eq(deliveryZones.id, id), eq(deliveryZones.storeId, scope.storeId)));
  else id = (await db().insert(deliveryZones).values({ ...values, storeId: scope.storeId }).$returningId())[0].id;
  await markOnboarding(scope.storeId, "deliveryConfigured");
  return id;
}
export async function deleteZone(scope: TenantScope, id: number) {
  requireWrite(scope, "delivery.manage");
  const zones = await listZones(scope.storeId);
  if (zones.filter(z => z.status === "active" && z.id !== id).length === 0) fail("VALIDATION", "Keep at least one active delivery zone");
  await db().delete(deliveryZones).where(and(eq(deliveryZones.id, id), eq(deliveryZones.storeId, scope.storeId)));
}
export async function confirmDeliverySetup(scope: TenantScope) {
  requireWrite(scope, "delivery.manage");
  await markOnboarding(scope.storeId, "deliveryConfigured");
}
