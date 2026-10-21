import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { couponRedemptions, coupons, customers, orderEvents, orderItems, orders, payments, refundRequests, returns, shipments, storeSettings, stores } from "../../drizzle/schema";
import { MERCHANT_TRANSITIONS, ORDER_STATUS_LABELS, ORDER_TRANSITIONS, PROVIDER_INFO, type OrderStatus } from "../../shared/domain";
import { fail, fmtBDT, fromP, toP } from "../lib/core";
import { partialRefundFee, recordEligibleSale, voidCourierFee, voidSaleFee } from "./billing";
import { checkLowStock, commitStock, releaseStock, restock } from "./catalog";
import { every } from "./jobs";
import { audit, emitEvent, notifyTenant, sendEmail, sendSms, sendWhatsApp, track } from "./ops";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

export type Order = typeof orders.$inferSelect;
export type Actor = { type: "customer" | "merchant" | "system" | "admin" | "gateway" | "courier" | "api"; id?: number | null; impersonationId?: number | null };

async function lockOrder(tx: DbOrTx, orderId: number) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
  if (!o) fail("NOT_FOUND", "Order not found");
  return o;
}

async function addEvent(tx: DbOrTx, orderId: number, e: { type: (typeof orderEvents.$inferInsert)["eventType"]; from?: string; to?: string; actor: Actor; note?: string }) {
  await tx.insert(orderEvents).values({ orderId, eventType: e.type, fromStatus: e.from ?? null, toStatus: e.to ?? null, actorType: e.actor.type, actorId: e.actor.id ?? null, note: e.note ?? null });
}

async function commitItems(tx: DbOrTx, o: Order) {
  if (o.stockCommitted) return [];
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  for (const it of items) await commitStock(tx, o.storeId, it.variantId, it.quantity, o.orderNo);
  await tx.update(orders).set({ stockCommitted: true }).where(eq(orders.id, o.id));
  return items.map(i => i.variantId);
}

async function restoreInventory(tx: DbOrTx, o: Order, type: "cancel_restock" | "return", actorId?: number | null) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  for (const it of items) {
    if (o.stockCommitted) await restock(tx, o.storeId, it.variantId, it.quantity - (type === "return" ? 0 : 0), o.orderNo, type, actorId);
    else await releaseStock(tx, o.storeId, it.variantId, it.quantity, o.orderNo, type === "return" ? "Returned before fulfilment" : "Order cancelled");
  }
}

async function voidCoupon(tx: DbOrTx, o: Order) {
  const reds = await tx.select().from(couponRedemptions).where(and(eq(couponRedemptions.orderId, o.id), eq(couponRedemptions.voided, false)));
  for (const r of reds) {
    await tx.update(couponRedemptions).set({ voided: true }).where(eq(couponRedemptions.id, r.id));
    await tx.update(coupons).set({ usedCount: sql`GREATEST(0, ${coupons.usedCount} - 1)` }).where(eq(coupons.id, r.couponId));
  }
}

/** Single entry point for every order status change (validated against the state machine, audited in order_events). */
export async function transitionOrder(orderId: number, to: OrderStatus, actor: Actor, note?: string, opts: { skipRefund?: boolean } = {}) {
  let lowStockVariants: number[] = [];
  let needsRefund: { paymentId: number; amountP: number } | null = null;
  const result = await db().transaction(async tx => {
    const o = await lockOrder(tx, orderId);
    if (o.status === to) return { order: o, changed: false };
    const allowed = actor.type === "merchant" || actor.type === "api" ? MERCHANT_TRANSITIONS[o.status] : ORDER_TRANSITIONS[o.status];
    if (!allowed.includes(to))
      fail("INVALID_STATE", `Order ${o.orderNo} can't move from ${ORDER_STATUS_LABELS[o.status].en} to ${ORDER_STATUS_LABELS[to].en}`, { from: o.status, to, allowed });
    if (to === "CONFIRMED" && o.paymentMethod !== "cod" && o.paymentStatus !== "paid") fail("INVALID_STATE", "Online orders are confirmed automatically after payment succeeds");
    const patch: Partial<typeof orders.$inferInsert> = { status: to };
    const now = new Date();
    switch (to) {
      case "PAID":
        patch.paymentStatus = "paid";
        lowStockVariants = await commitItems(tx, o);
        await recordEligibleSale(tx, o);
        break;
      case "CONFIRMED":
        lowStockVariants = await commitItems(tx, o);
        await recordEligibleSale(tx, o);
        break;
      case "PROCESSING":
        patch.fulfillmentStatus = "packed";
        lowStockVariants = await commitItems(tx, o);
        break;
      case "SHIPPED":
        patch.fulfillmentStatus = "shipped";
        lowStockVariants = await commitItems(tx, o);
        await recordEligibleSale(tx, o);
        break;
      case "DELIVERED":
        patch.fulfillmentStatus = "delivered";
        patch.deliveredAt = now;
        if (o.paymentMethod === "cod") patch.paymentStatus = "cod_collected";
        break;
      case "CANCELLED":
        patch.fulfillmentStatus = "cancelled";
        patch.cancelledAt = now;
        await restoreInventory(tx, o, "cancel_restock", actor.id);
        await voidSaleFee(tx, o, "order cancelled");
        await voidCourierFee(tx, o.id, "order cancelled");
        await voidCoupon(tx, o);
        if (o.paymentStatus === "paid" && !opts.skipRefund) {
          const [p] = await tx.select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "succeeded"))).limit(1);
          if (p) needsRefund = { paymentId: p.id, amountP: toP(o.grandTotal) - toP(o.refundedTotal) };
        }
        if (o.paymentMethod === "cod") patch.paymentStatus = "unpaid";
        break;
      case "REFUNDED":
        if (o.status === "PAID") await restoreInventory(tx, o, "cancel_restock", actor.id);
        await voidSaleFee(tx, o, "order fully refunded");
        await voidCoupon(tx, o);
        patch.paymentStatus = "refunded";
        patch.refundedTotal = o.grandTotal;
        break;
      case "RETURN_REQUESTED":
        await tx.insert(returns).values({ orderId: o.id, storeId: o.storeId, reason: note ?? null });
        break;
      case "RETURNED":
        patch.fulfillmentStatus = "returned";
        if (o.stockCommitted) await restoreInventory(tx, o, "return", actor.id);
        await tx.update(returns).set({ status: "received", resolvedAt: now }).where(and(eq(returns.orderId, o.id), inArray(returns.status, ["requested", "approved"])));
        if (o.paymentStatus !== "paid") {
          // Undelivered COD (refused/returned by courier) never became a completed sale.
          await voidSaleFee(tx, o, "COD order returned undelivered");
          await voidCourierFee(tx, o.id, "returned to merchant");
          patch.paymentStatus = "unpaid";
        }
        break;
    }
    if (o.status === "RETURN_REQUESTED" && to === "DELIVERED") {
      await tx.update(returns).set({ status: "rejected", resolvedAt: now }).where(and(eq(returns.orderId, o.id), eq(returns.status, "requested")));
      delete patch.deliveredAt;
    }
    await tx.update(orders).set(patch).where(eq(orders.id, o.id));
    await addEvent(tx, o.id, { type: "status_change", from: o.status, to, actor, note });
    return { order: { ...o, ...patch } as Order, changed: true, from: o.status };
  });
  if (!result.changed) return result.order;
  const o = result.order;
  if (needsRefund) {
    const { refundPayment } = await import("./payments");
    const r = needsRefund as { paymentId: number; amountP: number };
    const ok = await refundPayment(r.paymentId, r.amountP, "Order cancelled");
    await db()
      .update(orders)
      .set(ok ? { paymentStatus: "refunded", refundedTotal: o.grandTotal } : {})
      .where(eq(orders.id, o.id));
    await addEvent(db(), o.id, { type: "refund", actor: { type: "system" }, note: ok ? `Full refund ${fmtBDT(fromP(r.amountP))} sent to ${PROVIDER_INFO[o.paymentMethod as keyof typeof PROVIDER_INFO]?.name ?? o.paymentMethod}` : "Automatic refund failed — process manually" });
  }
  await audit({ tenantId: o.tenantId, actorId: actor.id ?? null, actorType: actor.type, action: "order.status_changed", resourceType: "order", resourceId: o.id, metadata: { orderNo: o.orderNo, from: result.from, to }, impersonationId: actor.impersonationId ?? null });
  await emitEvent(o.tenantId, o.storeId, "order.status_changed", { orderNo: o.orderNo, from: result.from, to });
  if (lowStockVariants.length) await checkLowStock(o.tenantId, o.storeId, lowStockVariants);
  await notifyCustomerStatus(o, to);
  return o;
}

async function storeInfo(storeId: number) {
  const [s] = await db().select({ name: stores.name, slug: stores.slug }).from(stores).where(eq(stores.id, storeId)).limit(1);
  const [st] = await db().select({ n: storeSettings.notificationsJson }).from(storeSettings).where(eq(storeSettings.storeId, storeId)).limit(1);
  return { name: s?.name ?? "Store", slug: s?.slug ?? "", prefs: st?.n ?? {} };
}
export const trackingPath = (slug: string, o: Pick<Order, "orderNo" | "accessToken">) => `/s/${slug}/order/${o.orderNo}?t=${o.accessToken}`;

export async function notifyCustomerStatus(o: Order, to: OrderStatus) {
  const msgs: Partial<Record<OrderStatus, string>> = {
    CONFIRMED: "has been confirmed",
    PAID: "payment is received",
    SHIPPED: "has been shipped",
    DELIVERED: "has been delivered. Thank you!",
    CANCELLED: "has been cancelled",
    REFUNDED: "has been refunded",
  };
  const m = msgs[to];
  if (!m) return;
  const s = await storeInfo(o.storeId);
  if (s.prefs.customerSms === false) return;
  await sendSms({ to: o.customerSnapshotJson.phone, body: `${s.name}: Your order ${o.orderNo} ${m}. Track: ${trackingPath(s.slug, o)}`, template: `order_${to.toLowerCase()}`, tenantId: o.tenantId });
}

/** Order-created notifications to merchant and customer (SMS / email / WhatsApp-ready). */
export async function notifyOrderPlaced(o: Order, kind: "placed" | "paid") {
  const s = await storeInfo(o.storeId);
  const amount = fmtBDT(o.grandTotal);
  await notifyTenant(o.tenantId, "orders.read", {
    type: kind === "paid" ? "payment.received" : "order.created",
    title: kind === "paid" ? `Payment received — ${o.orderNo}` : `New order ${o.orderNo}`,
    body: kind === "paid" ? `${amount} paid via ${PROVIDER_INFO[o.paymentMethod as keyof typeof PROVIDER_INFO]?.name ?? o.paymentMethod}.` : `${o.customerSnapshotJson.name} • ${amount} • ${o.paymentMethod === "cod" ? "Cash on delivery — confirm by phone" : "Awaiting online payment"}`,
    link: `/app/orders/${o.id}`,
    dedupeKey: `order:${o.id}:${kind}`,
  });
  const link = trackingPath(s.slug, o);
  const text =
    kind === "paid"
      ? `${s.name}: Payment of ${amount} received for order ${o.orderNo}. Track: ${link}`
      : `${s.name}: Thank you ${o.customerSnapshotJson.name}! Order ${o.orderNo} (${amount}) is placed${o.paymentMethod === "cod" ? " — pay on delivery" : ""}. Track: ${link}`;
  if (s.prefs.customerSms !== false) await sendSms({ to: o.customerSnapshotJson.phone, body: text, template: `order_${kind}`, tenantId: o.tenantId });
  if (s.prefs.customerEmail !== false && o.customerSnapshotJson.email)
    await sendEmail({ to: o.customerSnapshotJson.email, subject: `${s.name} — order ${o.orderNo} ${kind === "paid" ? "payment received" : "confirmation"}`, body: text, template: `order_${kind}`, tenantId: o.tenantId });
  if (s.prefs.customerWhatsapp) await sendWhatsApp({ to: o.customerSnapshotJson.phone, body: text, template: `order_${kind}`, tenantId: o.tenantId });
}

/* ───────── Merchant order operations ───────── */
export async function merchantTransition(scope: TenantScope, orderId: number, to: OrderStatus, note?: string) {
  requireWrite(scope, to === "REFUNDED" ? "orders.refund" : "orders.write");
  const [o] = await db().select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.storeId, scope.storeId))).limit(1);
  if (!o) fail("NOT_FOUND", "Order not found");
  return transitionOrder(orderId, to, { type: "merchant", id: scope.userId, impersonationId: scope.impersonationId }, note);
}

export async function addNote(scope: TenantScope, orderId: number, note: string) {
  requireWrite(scope, "orders.write");
  const [o] = await db().select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.storeId, scope.storeId))).limit(1);
  if (!o) fail("NOT_FOUND", "Order not found");
  await addEvent(db(), orderId, { type: "note", actor: { type: "merchant", id: scope.userId }, note: note.trim() });
}

export async function listOrders(
  scope: TenantScope,
  q: { status?: OrderStatus | "all" | "needs_action"; search?: string; paymentMethod?: string; from?: Date; to?: Date; page: number; pageSize: number }
) {
  requirePerm(scope, "orders.read");
  const conds = [eq(orders.storeId, scope.storeId)];
  if (q.status === "needs_action") conds.push(or(and(eq(orders.status, "PENDING_PAYMENT"), eq(orders.paymentMethod, "cod")), inArray(orders.status, ["PAID", "CONFIRMED", "RETURN_REQUESTED"]))!);
  else if (q.status && q.status !== "all") conds.push(eq(orders.status, q.status));
  if (q.paymentMethod) conds.push(eq(orders.paymentMethod, q.paymentMethod));
  if (q.from) conds.push(gte(orders.createdAt, q.from));
  if (q.to) conds.push(lte(orders.createdAt, q.to));
  if (q.search?.trim()) {
    const s = `%${q.search.trim()}%`;
    conds.push(or(like(orders.orderNo, s), sql`JSON_UNQUOTE(JSON_EXTRACT(${orders.customerSnapshotJson}, '$.name')) like ${s}`, sql`JSON_UNQUOTE(JSON_EXTRACT(${orders.customerSnapshotJson}, '$.phone')) like ${s}`)!);
  }
  const where = and(...conds);
  const [{ total }] = await db().select({ total: sql<number>`count(*)` }).from(orders).where(where);
  const rows = await db()
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      paymentMethod: orders.paymentMethod,
      grandTotal: orders.grandTotal,
      customer: orders.customerSnapshotJson,
      district: sql<string>`JSON_UNQUOTE(JSON_EXTRACT(${orders.addressSnapshotJson}, '$.district'))`,
      itemCount: sql<number>`(select coalesce(sum(oi.quantity),0) from ${orderItems} oi where oi.orderId = ${orders.id})`,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const counts = await db()
    .select({ status: orders.status, n: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.storeId, scope.storeId))
    .groupBy(orders.status);
  return { items: rows.map(r => ({ ...r, itemCount: Number(r.itemCount) })), total: Number(total), counts: Object.fromEntries(counts.map(c => [c.status, Number(c.n)])) };
}

export async function orderDetail(storeId: number, orderId: number) {
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.storeId, storeId))).limit(1);
  if (!o) fail("NOT_FOUND", "Order not found");
  const [items, events, pays, refunds, ships, rets] = await Promise.all([
    db().select().from(orderItems).where(eq(orderItems.orderId, o.id)),
    db().select().from(orderEvents).where(eq(orderEvents.orderId, o.id)).orderBy(asc(orderEvents.id)),
    db().select().from(payments).where(eq(payments.orderId, o.id)).orderBy(desc(payments.id)),
    db().select().from(refundRequests).where(eq(refundRequests.orderId, o.id)).orderBy(desc(refundRequests.id)),
    db().select().from(shipments).where(eq(shipments.orderId, o.id)).orderBy(desc(shipments.id)),
    db().select().from(returns).where(eq(returns.orderId, o.id)),
  ]);
  const [customer] = o.customerId ? await db().select().from(customers).where(eq(customers.id, o.customerId)).limit(1) : [];
  return { order: o, items, events, payments: pays, refunds, shipments: ships, returns: rets, customer: customer ?? null, allowedTransitions: MERCHANT_TRANSITIONS[o.status] };
}

/* ───────── Refund requests (full or partial) ───────── */
export async function requestRefund(scope: TenantScope, orderId: number, input: { items?: { orderItemId: number; quantity: number }[]; amount?: string; reason: string }) {
  requireWrite(scope, "orders.write");
  const { order: o, items } = await orderDetail(scope.storeId, orderId);
  if (!["paid", "partially_refunded", "cod_collected"].includes(o.paymentStatus)) fail("INVALID_STATE", "Only paid orders can be refunded");
  const remainingP = toP(o.grandTotal) - toP(o.refundedTotal);
  let amountP = 0;
  let isFull = false;
  if (input.items?.length) {
    for (const r of input.items) {
      const it = items.find(i => i.id === r.orderItemId);
      if (!it) fail("VALIDATION", "Unknown order item");
      if (r.quantity < 1 || r.quantity > it.quantity - it.refundedQty) fail("VALIDATION", `Refund quantity for ${it.nameSnapshot} exceeds what's refundable`);
      amountP += Math.round((toP(it.lineTotal) - toP(it.discountTotal)) * (r.quantity / it.quantity));
    }
  } else if (input.amount) amountP = toP(input.amount);
  else {
    amountP = remainingP;
    isFull = true;
  }
  if (amountP <= 0 || amountP > remainingP) fail("VALIDATION", `Refund must be between ৳1 and ${fmtBDT(fromP(remainingP))}`);
  if (amountP === remainingP) isFull = true;
  const [row] = await db()
    .insert(refundRequests)
    .values({ orderId, storeId: scope.storeId, tenantId: scope.tenantId, amount: fromP(amountP), isFull, itemsJson: input.items ?? null, reason: input.reason, method: o.paymentMethod, requestedBy: scope.userId })
    .$returningId();
  await addEvent(db(), orderId, { type: "refund", actor: { type: "merchant", id: scope.userId }, note: `Refund requested: ${fmtBDT(fromP(amountP))} — ${input.reason}` });
  await notifyTenant(scope.tenantId, "orders.refund", { type: "refund.requested", title: `Refund request for ${o.orderNo}`, body: `${fmtBDT(fromP(amountP))} — ${input.reason}`, link: `/app/orders/${orderId}` });
  return row.id;
}

export async function reviewRefund(scope: TenantScope, refundId: number, approve: boolean) {
  requireWrite(scope, "orders.refund");
  const [r] = await db().select().from(refundRequests).where(and(eq(refundRequests.id, refundId), eq(refundRequests.storeId, scope.storeId))).limit(1);
  if (!r || r.status !== "requested") fail("INVALID_STATE", "Refund request is not pending");
  if (!approve) {
    await db().update(refundRequests).set({ status: "rejected", reviewedBy: scope.userId, processedAt: new Date() }).where(eq(refundRequests.id, r.id));
    await addEvent(db(), r.orderId, { type: "refund", actor: { type: "merchant", id: scope.userId }, note: "Refund request rejected" });
    return { status: "rejected" };
  }
  const { order: o, items } = await orderDetail(scope.storeId, r.orderId);
  let ok = true;
  let providerRefundId: string | null = null;
  if (o.paymentMethod !== "cod") {
    const [p] = await db().select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "succeeded"))).limit(1);
    const { refundPayment } = await import("./payments");
    ok = p ? await refundPayment(p.id, toP(r.amount), r.reason ?? "Refund") : false;
    providerRefundId = p ? `RF-${p.reference}` : null;
  }
  if (!ok) {
    await db().update(refundRequests).set({ status: "failed", reviewedBy: scope.userId }).where(eq(refundRequests.id, r.id));
    fail("PAYMENT_FAILED", "The gateway refund failed. Try again or refund manually.");
  }
  await db().transaction(async tx => {
    await tx.update(refundRequests).set({ status: "processed", reviewedBy: scope.userId, processedAt: new Date(), providerRefundId }).where(eq(refundRequests.id, r.id));
    const newRefunded = toP(o.refundedTotal) + toP(r.amount);
    const full = newRefunded >= toP(o.grandTotal);
    let refundedBaseP = 0;
    for (const ri of r.itemsJson ?? []) {
      const it = items.find(i => i.id === ri.orderItemId);
      if (!it) continue;
      await tx.update(orderItems).set({ refundedQty: it.refundedQty + ri.quantity }).where(eq(orderItems.id, it.id));
      refundedBaseP += Math.round((toP(it.lineTotal) - toP(it.discountTotal)) * (ri.quantity / it.quantity));
    }
    await tx.update(orders).set({ refundedTotal: fromP(newRefunded), paymentStatus: full ? "refunded" : "partially_refunded" }).where(eq(orders.id, o.id));
    if (!full && refundedBaseP > 0) await partialRefundFee(tx, o, refundedBaseP, `partial refund #${r.id}`);
    await addEvent(tx, o.id, { type: "refund", actor: { type: "merchant", id: scope.userId }, note: `Refund processed: ${fmtBDT(r.amount)}${providerRefundId ? ` (ref ${providerRefundId})` : " (manual/COD)"}` });
  });
  const refreshed = (await orderDetail(scope.storeId, r.orderId)).order;
  if (refreshed.paymentStatus === "refunded" && ORDER_TRANSITIONS[refreshed.status].includes("REFUNDED"))
    await transitionOrder(r.orderId, "REFUNDED", { type: "merchant", id: scope.userId }, "Fully refunded", { skipRefund: true });
  else if (refreshed.paymentStatus === "refunded") await voidSaleFee(db(), refreshed, "order fully refunded");
  return { status: "processed" };
}

/* ───────── Customer-side helpers ───────── */
export async function customerOrder(storeId: number, orderNo: string, token: string) {
  const [o] = await db().select().from(orders).where(and(eq(orders.storeId, storeId), eq(orders.orderNo, orderNo))).limit(1);
  if (!o || o.accessToken !== token) return null;
  const items = await db().select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const events = await db()
    .select({ toStatus: orderEvents.toStatus, eventType: orderEvents.eventType, createdAt: orderEvents.createdAt })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, o.id), inArray(orderEvents.eventType, ["status_change", "created", "shipment"])))
    .orderBy(asc(orderEvents.id));
  const ships = await db().select({ provider: shipments.provider, trackingCode: shipments.trackingCode, status: shipments.status, events: shipments.eventsJson }).from(shipments).where(eq(shipments.orderId, o.id));
  const pays = await db().select({ provider: payments.provider, status: payments.status, reference: payments.reference, createdAt: payments.createdAt }).from(payments).where(eq(payments.orderId, o.id)).orderBy(desc(payments.id));
  return { order: o, items, events, shipments: ships, payments: pays };
}

export async function customerRequestReturn(storeId: number, orderNo: string, token: string, reason: string) {
  const data = await customerOrder(storeId, orderNo, token);
  if (!data) fail("NOT_FOUND", "Order not found");
  if (data.order.status !== "DELIVERED") fail("INVALID_STATE", "Returns can be requested after delivery");
  if (data.order.deliveredAt && Date.now() - data.order.deliveredAt.getTime() > 7 * 24 * 3600_000) fail("INVALID_STATE", "The 7-day return window has passed");
  await transitionOrder(data.order.id, "RETURN_REQUESTED", { type: "customer" }, reason);
  await notifyTenant(data.order.tenantId, "orders.write", { type: "order.return_requested", title: `Return requested — ${orderNo}`, body: reason, link: `/app/orders/${data.order.id}` });
}

export async function customerCancel(storeId: number, orderNo: string, token: string) {
  const data = await customerOrder(storeId, orderNo, token);
  if (!data) fail("NOT_FOUND", "Order not found");
  if (data.order.status !== "PENDING_PAYMENT") fail("INVALID_STATE", "This order can no longer be cancelled online. Please contact the store.");
  await transitionOrder(data.order.id, "CANCELLED", { type: "customer" }, "Cancelled by customer");
}

/* ───────── Abandoned online orders: release stock after 60 minutes without payment ───────── */
every("expire-unpaid-orders", 60_000, async () => {
  const cutoff = new Date(Date.now() - 60 * 60_000);
  const stale = await db()
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "PENDING_PAYMENT"), sql`${orders.paymentMethod} <> 'cod'`, lte(orders.createdAt, cutoff), inArray(orders.paymentStatus, ["pending", "failed", "unpaid"])))
    .limit(50);
  for (const s of stale) await transitionOrder(s.id, "CANCELLED", { type: "system" }, "Payment not completed within 60 minutes — stock released").catch(() => undefined);
});

export async function trackPaymentSuccess(o: Order) {
  await track("payment_succeeded", { tenantId: o.tenantId, storeId: o.storeId, props: { orderNo: o.orderNo, provider: o.paymentMethod, amount: o.grandTotal } });
}
