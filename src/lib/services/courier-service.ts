import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertPermission, type ActorContext } from "@/lib/rbac";
import { assertStoreAccess } from "@/lib/tenant";
import { recordAudit } from "@/lib/audit";
import { assertFeature, requireWritableTenant } from "@/lib/entitlements";
import {
  authenticateCourierWebhook,
  COURIER_SIGNATURE_HEADER,
  getCourierAdapter,
  isCourierProvider,
  parseCourierWebhook,
  statusLabel,
  TERMINAL_SHIPMENT_STATUSES,
  type CourierProviderName,
  type ShipmentStatusValue,
} from "@/lib/couriers";
import { makeEvent, mergeEvents, readEvents } from "@/lib/couriers/events";
import { canTransition, applyTransition, type OrderStatusValue } from "@/lib/services/order-service";

/**
 * Courier consignments (FR-07).
 *
 * `createCourierShipment` hands a confirmed order to Pathao/RedX/Steadfast and
 * moves the order to SHIPPED. Tracking updates arrive from the sync button or
 * the signed courier webhook; both run through the same order-status bridge so
 * the timeline, inventory and fee rules stay in one place.
 */

export type CreateShipmentResult = {
  shipmentId: string;
  provider: CourierProviderName;
  providerLabel: string;
  consignmentId: string;
  trackingCode: string;
  status: ShipmentStatusValue;
  sandbox: boolean;
  orderStatus: string;
};

const SHIPPABLE_ORDER_STATUSES: OrderStatusValue[] = ["CONFIRMED", "PROCESSING", "SHIPPED"];

function recipientFrom(order: {
  customerName: string;
  customerPhone: string;
  addressSnapshotJson: unknown;
}) {
  const address = (order.addressSnapshotJson ?? {}) as Record<string, unknown>;
  const join = (...values: unknown[]) =>
    values.filter((value) => typeof value === "string" && value.trim()).join(", ");
  return {
    name: order.customerName,
    phone: order.customerPhone,
    address:
      join(address.line1, address.line2, address.area, address.city, address.district, address.postcode) ||
      "ঠিকানা দেওয়া নেই",
    city: typeof address.city === "string" ? address.city : undefined,
  };
}

export async function listOrderShipments(storeId: string, orderId: string) {
  return prisma.shipment.findMany({
    where: { storeId, orderId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCourierShipment(
  actor: ActorContext,
  storeId: string,
  orderId: string,
  provider: string,
): Promise<CreateShipmentResult> {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);
  const snapshot = await requireWritableTenant(actor.tenantId);
  assertFeature(snapshot, "thirdPartyCouriers");

  if (!isCourierProvider(provider)) {
    throw new ValidationError("কুরিয়ার নির্বাচন সঠিক নয়।");
  }

  const method = await prisma.deliveryMethod.findUnique({
    where: { storeId_provider: { storeId, provider } },
  });
  if (!method || !method.isEnabled || !method.courierStoreId) {
    throw new ValidationError(
      "এই কুরিয়ারটি চালু নেই — ডেলিভারি সেটিংসে Store ID দিয়ে চালু করুন।",
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId, deletedAt: null },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("Order");

  if (!SHIPPABLE_ORDER_STATUSES.includes(order.status as OrderStatusValue)) {
    throw new ValidationError(
      "কুরিয়ারে পাঠানোর আগে অর্ডারটি নিশ্চিত (CONFIRMED) করতে হবে।",
    );
  }

  const active = await prisma.shipment.findFirst({
    where: { storeId, orderId, status: { notIn: TERMINAL_SHIPMENT_STATUSES as never } },
  });
  if (active) {
    throw new ValidationError("এই অর্ডারের জন্য একটি চলমান কুরিয়ার শিপমেন্ট আছে।");
  }

  const adapter = getCourierAdapter(provider);
  const recipient = recipientFrom(order);
  const codAmount = order.paymentProvider === "COD" && order.paymentStatus !== "PAID"
    ? String(order.grandTotal)
    : "0";

  const created = await adapter.createShipment({
    courierStoreId: method.courierStoreId,
    orderNo: order.orderNo,
    recipientName: recipient.name,
    recipientPhone: recipient.phone,
    recipientAddress: recipient.address,
    recipientCity: recipient.city,
    note: order.notes ?? undefined,
    itemDescription: `${order.items.length}টি আইটেম`,
    itemQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    codAmount,
  });

  const rawEvents = Array.isArray(created.raw?.events) ? readEvents(created.raw?.events) : [];
  const events =
    rawEvents.length > 0
      ? rawEvents
      : [makeEvent(created.status, `${adapter.label}: কনসাইনমেন্ট ${created.consignmentId} তৈরি হয়েছে`)];

  const shipment = await prisma.shipment.create({
    data: {
      storeId,
      orderId,
      provider,
      consignmentId: created.consignmentId,
      trackingCode: created.trackingCode,
      status: created.status,
      isSandbox: created.sandbox,
      codAmount: codAmount,
      recipientName: recipient.name,
      recipientPhone: recipient.phone,
      recipientAddress: recipient.address,
      recipientCity: recipient.city ?? null,
      note: order.notes ?? null,
      eventsJson: events as never,
      lastSyncedAt: new Date(),
    },
  });

  await recordAudit({
    action: "courier.consignment_created",
    tenantId: actor.tenantId,
    actorId: actor.userId,
    resourceType: "Shipment",
    resourceId: shipment.id,
    metadata: {
      storeId,
      orderId,
      provider,
      consignmentId: created.consignmentId,
      sandbox: created.sandbox,
    },
  });

  let orderStatus = order.status;
  if (order.status === "CONFIRMED" || order.status === "PROCESSING") {
    await applyTransition({
      orderId,
      from: order.status as OrderStatusValue,
      to: "SHIPPED",
      actorType: "STAFF",
      actorId: actor.userId,
      note: `${adapter.label}-এ পাঠানো হয়েছে — ${created.trackingCode}`,
      items: order.items,
      storeId,
    });
    orderStatus = "SHIPPED";
  }

  return {
    shipmentId: shipment.id,
    provider,
    providerLabel: adapter.label,
    consignmentId: created.consignmentId,
    trackingCode: created.trackingCode,
    status: created.status,
    sandbox: created.sandbox,
    orderStatus,
  };
}

export async function syncCourierShipment(
  actor: ActorContext,
  storeId: string,
  shipmentId: string,
): Promise<{ status: ShipmentStatusValue; changed: boolean; orderStatus: string; sandbox: boolean }> {
  assertPermission(actor, "delivery:write");
  await assertStoreAccess(actor, storeId);
  await requireWritableTenant(actor.tenantId);

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, storeId },
    include: { order: { select: { orderNo: true } } },
  });
  if (!shipment) throw new NotFoundError("Shipment");

  const adapter = getCourierAdapter(shipment.provider);
  const tracked = await adapter.track({
    consignmentId: shipment.consignmentId,
    trackingCode: shipment.trackingCode,
    orderNo: shipment.order.orderNo,
    advanceFrom: shipment.status as ShipmentStatusValue,
  });

  const existingEvents = readEvents(shipment.eventsJson);
  const incoming =
    tracked.events.length > 0
      ? tracked.events
      : tracked.status !== shipment.status
        ? [
            makeEvent(
              tracked.status,
              `${adapter.label}: ${statusLabel(tracked.status)} (${shipment.trackingCode})`,
            ),
          ]
        : [];
  const events = mergeEvents(existingEvents, incoming);
  const changed = tracked.status !== shipment.status || events.length !== existingEvents.length;

  if (changed) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: tracked.status,
        eventsJson: events as never,
        lastSyncedAt: new Date(),
      },
    });

    await recordAudit({
      action: "courier.tracking_synced",
      tenantId: actor.tenantId,
      actorId: actor.userId,
      resourceType: "Shipment",
      resourceId: shipment.id,
      metadata: { storeId, provider: shipment.provider, status: tracked.status },
    });
  } else {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { lastSyncedAt: new Date() },
    });
  }

  const orderStatus = await syncOrderWithShipment({
    storeId,
    orderId: shipment.orderId,
    providerLabel: adapter.label,
    status: tracked.status,
    trackingCode: shipment.trackingCode,
    actorType: "STAFF",
    actorId: actor.userId,
  });

  return { status: tracked.status, changed, orderStatus, sandbox: tracked.sandbox };
}

/**
 * Bridge courier statuses into the order state machine.
 *
 * Courier systems are the source of truth for delivery outcomes, but the order
 * state machine still decides what is a legal transition. Returning a parcel is
 * recorded as RETURN_REQUESTED for merchant review, never straight to RETURNED.
 */
async function syncOrderWithShipment(params: {
  storeId: string;
  orderId: string;
  providerLabel: string;
  status: ShipmentStatusValue;
  trackingCode: string;
  actorType: "STAFF" | "SYSTEM";
  actorId?: string | null;
}): Promise<string> {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, storeId: params.storeId },
    include: { items: true },
  });
  if (!order) return "UNKNOWN";

  const from = order.status as OrderStatusValue;
  let current = from;

  const moveTo = async (to: OrderStatusValue, note: string) => {
    if (current === to || !canTransition(current, to)) return;
    await applyTransition({
      orderId: order.id,
      from: current,
      to,
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      note,
      items: order.items,
      storeId: params.storeId,
    });
    current = to;
  };

  if (params.status === "DELIVERED") {
    if (current === "CONFIRMED" || current === "PROCESSING") {
      await moveTo("SHIPPED", `${params.providerLabel}: কুরিয়ারে হস্তান্তর — ${params.trackingCode}`);
    }
    await moveTo("DELIVERED", `${params.providerLabel}: ডেলিভারি সম্পন্ন — ${params.trackingCode}`);
  } else if (params.status === "RETURNED") {
    // Merchant confirms the return later; auto-approving would hide the check.
    await moveTo(
      "RETURN_REQUESTED",
      `${params.providerLabel}: পার্সেল ফেরত এসেছে — যাচাই করে সিদ্ধান্ত দিন`,
    );
  } else if (params.status === "PARTIAL_DELIVERED") {
    await moveTo("SHIPPED", `${params.providerLabel}: আংশিক ডেলিভারি — ${params.trackingCode}`);
  }

  return current;
}

// ── Webhook ─────────────────────────────────────────────────────────────────

export type CourierWebhookOutcome = {
  provider: string;
  signatureValid: boolean;
  found: boolean;
  duplicate: boolean;
  status: ShipmentStatusValue | null;
  orderStatus: string | null;
  message: string;
};

const STATUS_RANK: Record<ShipmentStatusValue, number> = {
  PENDING: 0,
  PICKED_UP: 1,
  IN_TRANSIT: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  PARTIAL_DELIVERED: 4,
  RETURNED: 5,
  CANCELLED: 6,
  FAILED: 6,
};

export async function applyCourierWebhook(
  providerRaw: string,
  request: Request,
  rawBody: string,
): Promise<CourierWebhookOutcome> {
  const provider = providerRaw.toUpperCase();
  if (!isCourierProvider(provider)) {
    return {
      provider,
      signatureValid: false,
      found: false,
      duplicate: false,
      status: null,
      orderStatus: null,
      message: `অজানা courier: ${providerRaw}`,
    };
  }

  const url = new URL(request.url);
  const auth = authenticateCourierWebhook(
    rawBody,
    request.headers.get(COURIER_SIGNATURE_HEADER),
    url.searchParams.get("token"),
  );

  if (!auth.valid) {
    return {
      provider,
      signatureValid: false,
      found: false,
      duplicate: false,
      status: null,
      orderStatus: null,
      message: auth.configured
        ? "ওয়েবহুক সিগনেচার যাচাই ব্যর্থ হয়েছে।"
        : "COURIER_WEBHOOK_SECRET কনফিগার করা নেই — production-এ ওয়েবহুক বন্ধ।",
    };
  }

  let payload;
  try {
    payload = parseCourierWebhook(provider, rawBody);
  } catch (error) {
    return {
      provider,
      signatureValid: true,
      found: false,
      duplicate: false,
      status: null,
      orderStatus: null,
      message: error instanceof Error ? error.message : "webhook parse failed",
    };
  }

  // Order numbers are unique per store, not globally. Resolve the store from
  // the callback URL first (`?store=<id-or-slug>`), then require every lookup
  // key to stay inside that store. Consignment/tracking ids are globally unique
  // per provider, so they are safe even without a store hint; an order-number
  // lookup without a store scope is rejected outright.
  const storeRef =
    url.searchParams.get("store") ?? url.searchParams.get("storeId") ?? null;
  let storeId: string | null = null;
  if (storeRef) {
    const store = await prisma.store.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: storeRef }, { slug: storeRef }],
      },
      select: { id: true },
    });
    if (!store) {
      return {
        provider,
        signatureValid: true,
        found: false,
        duplicate: false,
        status: payload.status,
        orderStatus: null,
        message: "ওয়েবহুকের store সনাক্ত করা যায়নি।",
      };
    }
    storeId = store.id;
  }

  const lookup: Prisma.ShipmentWhereInput[] = [];
  if (payload.consignmentId) lookup.push({ consignmentId: payload.consignmentId });
  if (payload.trackingCode) lookup.push({ trackingCode: payload.trackingCode });
  if (payload.orderNo && storeId) {
    lookup.push({ order: { orderNo: payload.orderNo, storeId } });
  }

  const shipment =
    lookup.length === 0
      ? null
      : await prisma.shipment.findFirst({
          where: {
            provider,
            ...(storeId ? { storeId } : {}),
            OR: lookup,
          },
          orderBy: { createdAt: "desc" },
        });

  if (!shipment) {
    return {
      provider,
      signatureValid: true,
      found: false,
      duplicate: false,
      status: payload.status,
      orderStatus: null,
      message: "শিপমেন্ট পাওয়া যায়নি।",
    };
  }

  const existingEvents = readEvents(shipment.eventsJson);
  const event = makeEvent(
    payload.status,
    payload.message,
    payload.occurredAt ?? undefined,
    payload.eventId ?? undefined,
  );
  const events = mergeEvents(existingEvents, [event]);
  const duplicate = events.length === existingEvents.length;
  const currentStatus = shipment.status as ShipmentStatusValue;

  // Out-of-order webhooks must not move a delivered parcel back to transit.
  const statusAccepted = STATUS_RANK[payload.status] >= STATUS_RANK[currentStatus];

  if (!duplicate || statusAccepted) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        ...(statusAccepted ? { status: payload.status } : {}),
        eventsJson: events as never,
        lastSyncedAt: new Date(),
      },
    });
  }

  const orderStatus = statusAccepted
    ? await syncOrderWithShipment({
        storeId: shipment.storeId,
        orderId: shipment.orderId,
        providerLabel: getCourierAdapter(provider).label,
        status: payload.status,
        trackingCode: shipment.trackingCode,
        actorType: "SYSTEM",
      })
    : null;

  return {
    provider,
    signatureValid: true,
    found: true,
    duplicate,
    status: payload.status,
    orderStatus,
    message: duplicate ? "ইতিমধ্যে প্রসেস করা ইভেন্ট।" : "ওয়েবহুক প্রসেস হয়েছে।",
  };
}
