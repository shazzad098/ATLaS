import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { courierConnections, orderEvents, orders, shipments } from "../../drizzle/schema";
import { COURIER_INFO, type CourierProvider } from "../../shared/domain";
import { fail, fromP, toP } from "../lib/core";
import { encryptSecret, hmacHex, maskSecret, randomDigits, safeEqual, sha256 } from "../lib/crypto";
import { recordCourierFee, voidCourierFee } from "./billing";
import { audit, emitEvent } from "./ops";
import { transitionOrder } from "./orders";
import { markOnboarding } from "./stores";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

export type ShipmentStatus = (typeof shipments.$inferSelect)["status"];

/* ───────── Courier adapter contract ───────── */
export interface CourierAdapter {
  provider: CourierProvider;
  createConsignment(p: { orderNo: string; codAmount: string; district: string; recipient: string; phone: string; address: string }): Promise<{ consignmentId: string; trackingCode: string; charge: string }>;
  cancel(consignmentId: string): Promise<boolean>;
}
class SandboxCourier implements CourierAdapter {
  constructor(
    public provider: CourierProvider,
    private prefix: string
  ) {}
  async createConsignment(p: { orderNo: string; codAmount: string; district: string }) {
    const inside = p.district.toLowerCase() === "dhaka";
    return { consignmentId: `${this.prefix}C${randomDigits(9)}`, trackingCode: `${this.prefix}${randomDigits(10)}`, charge: inside ? "60.00" : "120.00" };
  }
  async cancel() {
    return true;
  }
}
export const COURIERS: Record<CourierProvider, CourierAdapter> = {
  pathao: new SandboxCourier("pathao", "PTH"),
  steadfast: new SandboxCourier("steadfast", "SF"),
  redx: new SandboxCourier("redx", "RDX"),
  paperfly: new SandboxCourier("paperfly", "PF"),
  manual: new SandboxCourier("manual", "OWN"),
};

const courierSecret = (provider: string) => sha256(`atlas-courier-webhook:${provider}:${process.env.MANUS_JWT_SECRET || "dev"}`);
export const signCourierWebhook = (provider: string, body: string) => hmacHex(courierSecret(provider), body);

/* ───────── Connections ───────── */
export async function listCouriers(scope: TenantScope) {
  requirePerm(scope, "delivery.manage");
  const rows = await db().select().from(courierConnections).where(eq(courierConnections.storeId, scope.storeId));
  const level = scope.ent.limits.courierLevel;
  return {
    level,
    maxConnections: scope.ent.limits.maxCourierConnections,
    providers: (Object.keys(COURIER_INFO) as CourierProvider[]).map(p => {
      const r = rows.find(x => x.provider === p && x.status === "connected");
      return { provider: p, ...COURIER_INFO[p], connected: p === "manual" ? true : !!r, publicConfig: r?.publicConfigJson ?? {}, allowed: p === "manual" || level !== "manual" };
    }),
  };
}

export async function connectCourier(scope: TenantScope, provider: CourierProvider, creds: { apiKey: string; secretKey?: string; storeIdAtCourier?: string }) {
  requireWrite(scope, "delivery.manage");
  if (provider === "manual") fail("VALIDATION", "Own delivery is always available");
  if (scope.ent.limits.courierLevel === "manual") fail("FEATURE_NOT_IN_PLAN", "Third-party courier integration is available on the Basic plan and above.", { requiredPlan: "basic" });
  if (!creds.apiKey.trim()) fail("VALIDATION", "API key is required");
  const connected = await db()
    .select({ id: courierConnections.id, provider: courierConnections.provider })
    .from(courierConnections)
    .where(and(eq(courierConnections.storeId, scope.storeId), eq(courierConnections.status, "connected"), ne(courierConnections.provider, provider)));
  const max = scope.ent.limits.maxCourierConnections;
  if (max !== null && connected.length >= max)
    fail("QUOTA_EXCEEDED", `Your ${scope.ent.planName} plan allows ${max} courier connection${max > 1 ? "s" : ""}. Upgrade to connect more couriers.`, { metric: "couriers", limit: max });
  const enc = encryptSecret(JSON.stringify(creds), `courier:${scope.storeId}:${provider}`);
  const [existing] = await db().select().from(courierConnections).where(and(eq(courierConnections.storeId, scope.storeId), eq(courierConnections.provider, provider))).limit(1);
  const publicConfig = { apiKey: maskSecret(creds.apiKey), storeIdAtCourier: creds.storeIdAtCourier ?? "" };
  if (existing) await db().update(courierConnections).set({ status: "connected", encryptedCredentials: enc, publicConfigJson: publicConfig }).where(eq(courierConnections.id, existing.id));
  else await db().insert(courierConnections).values({ storeId: scope.storeId, tenantId: scope.tenantId, provider, isThirdParty: COURIER_INFO[provider].thirdParty, encryptedCredentials: enc, publicConfigJson: publicConfig });
  await markOnboarding(scope.storeId, "deliveryConfigured");
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "courier.connected", resourceType: "courier", resourceId: provider, impersonationId: scope.impersonationId });
}

export async function disconnectCourier(scope: TenantScope, provider: CourierProvider) {
  requireWrite(scope, "delivery.manage");
  await db().update(courierConnections).set({ status: "disconnected", encryptedCredentials: null }).where(and(eq(courierConnections.storeId, scope.storeId), eq(courierConnections.provider, provider)));
}

/* ───────── Shipments ───────── */
export async function createShipment(scope: TenantScope, orderId: number, provider: CourierProvider, opts: { trackingCode?: string } = {}) {
  requireWrite(scope, "orders.write");
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.storeId, scope.storeId))).limit(1);
  if (!o) fail("NOT_FOUND", "Order not found");
  if (!["PAID", "CONFIRMED", "PROCESSING"].includes(o.status)) fail("INVALID_STATE", "Confirm the order before booking a courier");
  const thirdParty = COURIER_INFO[provider].thirdParty;
  if (thirdParty) {
    if (scope.ent.limits.courierLevel === "manual") fail("FEATURE_NOT_IN_PLAN", "Third-party courier booking is available on the Basic plan and above.", { requiredPlan: "basic" });
    const [conn] = await db().select().from(courierConnections).where(and(eq(courierConnections.storeId, scope.storeId), eq(courierConnections.provider, provider), eq(courierConnections.status, "connected"))).limit(1);
    if (!conn) fail("VALIDATION", `Connect ${COURIER_INFO[provider].name} in Delivery settings first`);
  }
  const [open] = await db().select({ id: shipments.id }).from(shipments).where(and(eq(shipments.orderId, o.id), inArray(shipments.status, ["created", "picked_up", "in_transit"]))).limit(1);
  if (open) fail("CONFLICT", "This order already has an active shipment");
  const codAmountP = o.paymentMethod === "cod" && o.paymentStatus !== "paid" ? toP(o.grandTotal) : 0;
  const a = o.addressSnapshotJson;
  const c = await COURIERS[provider].createConsignment({ orderNo: o.orderNo, codAmount: fromP(codAmountP), district: a.district, recipient: o.customerSnapshotJson.name, phone: o.customerSnapshotJson.phone, address: [a.line1, a.area, a.district].filter(Boolean).join(", ") });
  const now = new Date().toISOString();
  await db().transaction(async tx => {
    await tx.insert(shipments).values({
      orderId: o.id,
      storeId: o.storeId,
      provider,
      consignmentId: c.consignmentId,
      trackingCode: provider === "manual" && opts.trackingCode ? opts.trackingCode : c.trackingCode,
      status: "created",
      codAmount: fromP(codAmountP),
      charge: provider === "manual" ? "0.00" : c.charge,
      eventsJson: [{ status: "created", at: now, note: `Booked with ${COURIER_INFO[provider].name}` }],
    });
    if (thirdParty && codAmountP > 0) await recordCourierFee(tx, { tenantId: o.tenantId, storeId: o.storeId, orderId: o.id, orderNo: o.orderNo, codAmountP });
    await tx.insert(orderEvents).values({ orderId: o.id, eventType: "shipment", actorType: "merchant", actorId: scope.userId, note: `Courier booked: ${COURIER_INFO[provider].name} — tracking ${c.trackingCode}` });
  });
  await transitionOrder(o.id, "SHIPPED", { type: "merchant", id: scope.userId, impersonationId: scope.impersonationId }, `Handed to ${COURIER_INFO[provider].name}`);
  await emitEvent(o.tenantId, o.storeId, "shipment.created", { orderNo: o.orderNo, provider, trackingCode: c.trackingCode });
  return { trackingCode: c.trackingCode };
}

const SHIPMENT_FLOW: Record<ShipmentStatus, ShipmentStatus[]> = {
  created: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "returned"],
  in_transit: ["delivered", "returned"],
  delivered: [],
  returned: [],
  cancelled: [],
};

export async function updateShipmentStatus(shipmentId: number, status: ShipmentStatus, actor: { type: "merchant" | "courier"; id?: number }, note?: string) {
  const [s] = await db().select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!s) fail("NOT_FOUND", "Shipment not found");
  if (s.status === status) return s;
  if (!SHIPMENT_FLOW[s.status].includes(status)) fail("INVALID_STATE", `Shipment can't move from ${s.status} to ${status}`);
  const events = [...(s.eventsJson ?? []), { status, at: new Date().toISOString(), note }];
  await db().update(shipments).set({ status, eventsJson: events }).where(eq(shipments.id, s.id));
  await db().insert(orderEvents).values({ orderId: s.orderId, eventType: "shipment", actorType: actor.type, actorId: actor.id ?? null, note: `Tracking update: ${status.replace("_", " ")}${note ? ` — ${note}` : ""}` });
  const [o] = await db().select().from(orders).where(eq(orders.id, s.orderId)).limit(1);
  if (status === "delivered" && o.status === "SHIPPED") await transitionOrder(o.id, "DELIVERED", { type: actor.type, id: actor.id }, "Delivered by courier");
  if (status === "returned" && o.status === "SHIPPED") await transitionOrder(o.id, "RETURNED", { type: actor.type, id: actor.id }, note ?? "Returned to merchant by courier");
  if (status === "cancelled") {
    await voidCourierFee(db(), o.id, "shipment cancelled");
    await COURIERS[s.provider].cancel(s.consignmentId ?? "");
  }
  await emitEvent(o.tenantId, o.storeId, "shipment.updated", { orderNo: o.orderNo, status, trackingCode: s.trackingCode });
  return { ...s, status };
}

export async function merchantShipmentUpdate(scope: TenantScope, shipmentId: number, status: ShipmentStatus, note?: string) {
  requireWrite(scope, "orders.write");
  const [s] = await db().select({ storeId: shipments.storeId }).from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!s || s.storeId !== scope.storeId) fail("NOT_FOUND", "Shipment not found");
  return updateShipmentStatus(shipmentId, status, { type: "merchant", id: scope.userId }, note);
}

/** Courier status webhook (HMAC signed by the courier sandbox). */
export async function handleCourierWebhook(provider: string, rawBody: string, signature: string | undefined) {
  if (!(provider in COURIERS)) return { httpStatus: 404 };
  if (!signature || !safeEqual(signCourierWebhook(provider, rawBody), signature)) return { httpStatus: 401 };
  let body: { trackingCode?: string; status?: ShipmentStatus; note?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400 };
  }
  const [s] = await db().select().from(shipments).where(and(eq(shipments.provider, provider as CourierProvider), eq(shipments.trackingCode, body.trackingCode ?? ""))).limit(1);
  if (!s || !body.status) return { httpStatus: 404 };
  await updateShipmentStatus(s.id, body.status, { type: "courier" }, body.note);
  return { httpStatus: 200 };
}

export async function shipmentsForStore(scope: TenantScope, q: { status?: ShipmentStatus; limit: number }) {
  requirePerm(scope, "orders.read");
  return db()
    .select({ s: shipments, orderNo: orders.orderNo, customer: orders.customerSnapshotJson, district: orders.addressSnapshotJson })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(and(eq(shipments.storeId, scope.storeId), q.status ? eq(shipments.status, q.status) : undefined))
    .orderBy(desc(shipments.id))
    .limit(q.limit);
}

export async function publicTracking(trackingCode: string) {
  const [s] = await db().select().from(shipments).where(eq(shipments.trackingCode, trackingCode)).limit(1);
  if (!s) return null;
  return { provider: s.provider, providerName: COURIER_INFO[s.provider].name, status: s.status, events: s.eventsJson ?? [], trackingCode: s.trackingCode };
}
