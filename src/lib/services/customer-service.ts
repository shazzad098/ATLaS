import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { requireWritableTenant } from "@/lib/entitlements";
import { recordAudit } from "@/lib/audit";
import { fromPaisa, toPaisa } from "@/lib/money";
import {
  CUSTOMER_SEGMENTS,
  SEGMENT_LABELS,
  classifyCustomer,
  type CustomerSegment,
  type CustomerSnapshot,
} from "@/lib/customer-segments";

/**
 * Customer directory, segments and consent (PRD §4.4 "Customers: profiles,
 * order history, segments, blacklist, consent").
 *
 * Segments are derived from order history instead of being stored, so they can
 * never drift from the ledger. The computed label is deterministic and
 * unit-tested; the list query caps the working set and paginates in memory.
 */

export { CUSTOMER_SEGMENTS, SEGMENT_LABELS, classifyCustomer };
export type { CustomerSegment, CustomerSnapshot };

function snapshotFromOrders(
  orders: Array<{ grandTotal: unknown; status: string; placedAt: Date }>,
  isBlacklisted: boolean,
): CustomerSnapshot {
  const valid = orders.filter((order) => order.status !== "CANCELLED");
  const lifetimePaisa = valid.reduce(
    (sum, order) => sum + toPaisa(order.grandTotal as string | number),
    0n,
  );
  const lastOrderAt = valid
    .map((order) => order.placedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return { orderCount: valid.length, lifetimePaisa, lastOrderAt, isBlacklisted };
}

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: Date;
  isBlacklisted: boolean;
  orderCount: number;
  lifetimePaisa: bigint;
  lastOrderAt: Date | null;
  segment: Exclude<CustomerSegment, "all">;
  consent: Record<string, { granted?: boolean; updatedAt?: string; source?: string }>;
};

const MAX_SCAN = 1_000;

export async function listCustomers(
  storeId: string,
  options: { q?: string; segment?: CustomerSegment; page?: number; perPage?: number } = {},
): Promise<{ rows: CustomerRow[]; total: number; counts: Record<CustomerSegment, number> }> {
  const q = (options.q ?? "").trim();
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 20));

  const customers = await prisma.customer.findMany({
    where: {
      storeId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_SCAN,
    include: {
      orders: {
        where: { deletedAt: null },
        select: { grandTotal: true, status: true, placedAt: true },
      },
    },
  });

  const rows: CustomerRow[] = customers.map((customer) => {
    const snapshot = snapshotFromOrders(customer.orders, customer.isBlacklisted);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
      isBlacklisted: customer.isBlacklisted,
      orderCount: snapshot.orderCount,
      lifetimePaisa: snapshot.lifetimePaisa,
      lastOrderAt: snapshot.lastOrderAt,
      segment: classifyCustomer(snapshot),
      consent: (customer.consentJson ?? {}) as CustomerRow["consent"],
    };
  });

  const counts: Record<CustomerSegment, number> = {
    all: rows.length,
    new: 0,
    repeat: 0,
    vip: 0,
    inactive: 0,
    blacklisted: 0,
  };
  for (const row of rows) counts[row.segment] += 1;

  const segment = options.segment ?? "all";
  const filtered = segment === "all" ? rows : rows.filter((row) => row.segment === segment);
  const start = (page - 1) * perPage;

  return { rows: filtered.slice(start, start + perPage), total: filtered.length, counts };
}

export async function getCustomerDetail(storeId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    include: {
      orders: {
        where: { deletedAt: null },
        orderBy: { placedAt: "desc" },
        take: 100,
        select: {
          id: true,
          orderNo: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
          placedAt: true,
        },
      },
    },
  });
  if (!customer) throw new NotFoundError("Customer");

  const snapshot = snapshotFromOrders(customer.orders, customer.isBlacklisted);
  return {
    customer,
    snapshot,
    segment: classifyCustomer(snapshot),
    lifetime: fromPaisa(snapshot.lifetimePaisa),
  };
}

export type ConsentPurpose = "marketingEmail" | "marketingSms" | "orderUpdates";

export async function updateCustomerConsent(
  actor: ActorContext,
  storeId: string,
  customerId: string,
  input: { marketingEmail: boolean; marketingSms: boolean; source?: string },
): Promise<void> {
  assertPermission(actor, "customers:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    select: { id: true, consentJson: true },
  });
  if (!customer) throw new NotFoundError("Customer");

  const previous = (customer.consentJson ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const source = (input.source ?? "admin").slice(0, 40);
  const next = {
    ...previous,
    marketingEmail: { granted: input.marketingEmail, updatedAt: now, source },
    marketingSms: { granted: input.marketingSms, updatedAt: now, source },
  };

  await prisma.customer.update({
    where: { id: customer.id },
    data: { consentJson: next as never },
  });

  await recordAudit({
    action: "customer.consent_updated",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Customer",
    resourceId: customer.id,
    metadata: {
      storeId,
      marketingEmail: input.marketingEmail,
      marketingSms: input.marketingSms,
      source,
    },
  });
}

export async function setCustomerBlacklist(
  actor: ActorContext,
  storeId: string,
  customerId: string,
  input: { isBlacklisted: boolean; reason?: string },
): Promise<void> {
  assertPermission(actor, "customers:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    select: { id: true, isBlacklisted: true },
  });
  if (!customer) throw new NotFoundError("Customer");

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      isBlacklisted: input.isBlacklisted,
      notes: input.reason?.trim().slice(0, 500) || undefined,
    },
  });

  await recordAudit({
    action: input.isBlacklisted ? "customer.blacklisted" : "customer.unblacklisted",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Customer",
    resourceId: customer.id,
    metadata: { storeId, reason: input.reason?.slice(0, 200) },
  });
}
