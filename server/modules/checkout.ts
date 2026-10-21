import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, affected } from "../db";
import {
  cartItems,
  carts,
  couponRedemptions,
  coupons,
  customers,
  deliveryZones,
  orderEvents,
  orderItems,
  orders,
  paymentMethods,
  productImages,
  products,
  productVariants,
  storeSettings,
  stores,
  type Address,
} from "../../drizzle/schema";
import { BD_DISTRICTS, normalizeBdPhone, type OnlineProvider, type PaymentProvider } from "../../shared/domain";
import { addDays, fail, fmtBDT, fromP, pctOf, toP } from "../lib/core";
import { randomToken } from "../lib/crypto";
import { getEntitlements } from "./billing";
import { reserveStock } from "./catalog";
import { audit, emitEvent, track } from "./ops";
import { notifyOrderPlaced, type Order } from "./orders";
import { initiateOrderPayment } from "./payments";

type Store = typeof stores.$inferSelect;

/* ───────── Cart ───────── */
async function cartFor(storeId: number, sessionKey: string, create: boolean) {
  const [c] = await db().select().from(carts).where(and(eq(carts.storeId, storeId), eq(carts.sessionKey, sessionKey))).limit(1);
  if (c && c.status === "active") return c;
  if (!create) return null;
  if (c) {
    await db().delete(cartItems).where(eq(cartItems.cartId, c.id));
    await db().update(carts).set({ status: "active", expiresAt: addDays(new Date(), 14) }).where(eq(carts.id, c.id));
    return { ...c, status: "active" as const };
  }
  const [row] = await db().insert(carts).values({ storeId, sessionKey, expiresAt: addDays(new Date(), 14) }).$returningId();
  const [fresh] = await db().select().from(carts).where(eq(carts.id, row.id)).limit(1);
  return fresh;
}

async function variantForStore(storeId: number, variantId: number) {
  const [v] = await db()
    .select({ v: productVariants, productStatus: products.status, productName: products.name, deleted: products.deletedAt })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.id, variantId), eq(productVariants.storeId, storeId)))
    .limit(1);
  if (!v || v.deleted || v.productStatus !== "active" || v.v.status !== "active") fail("NOT_FOUND", "This product is no longer available");
  return v;
}

export async function cartAdd(storeId: number, sessionKey: string, variantId: number, qty: number) {
  if (qty < 1 || qty > 50) fail("VALIDATION", "Quantity must be between 1 and 50");
  const v = await variantForStore(storeId, variantId);
  const cart = (await cartFor(storeId, sessionKey, true))!;
  const [existing] = await db().select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId))).limit(1);
  const nextQty = (existing?.quantity ?? 0) + qty;
  const available = v.v.stockQty - v.v.reservedQty;
  if (nextQty > available) fail("OUT_OF_STOCK", available > 0 ? `Only ${available} left of ${v.productName}` : `${v.productName} is out of stock`, { available });
  if (existing) await db().update(cartItems).set({ quantity: nextQty, unitPriceSnapshot: v.v.price }).where(eq(cartItems.id, existing.id));
  else await db().insert(cartItems).values({ cartId: cart.id, variantId, quantity: qty, unitPriceSnapshot: v.v.price });
  return cartView(storeId, sessionKey);
}

export async function cartSetQty(storeId: number, sessionKey: string, variantId: number, qty: number) {
  const cart = await cartFor(storeId, sessionKey, false);
  if (!cart) return cartView(storeId, sessionKey);
  if (qty <= 0) await db().delete(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
  else {
    const v = await variantForStore(storeId, variantId);
    const available = v.v.stockQty - v.v.reservedQty;
    if (qty > available) fail("OUT_OF_STOCK", `Only ${available} left of ${v.productName}`, { available });
    await db().update(cartItems).set({ quantity: Math.min(qty, 50) }).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, variantId)));
  }
  return cartView(storeId, sessionKey);
}

export async function cartView(storeId: number, sessionKey: string) {
  const cart = await cartFor(storeId, sessionKey, false);
  if (!cart) return { lines: [], subtotal: "0.00", count: 0, issues: [] as string[] };
  const rows = await db()
    .select({
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      price: productVariants.price,
      comparePrice: productVariants.comparePrice,
      options: productVariants.optionValuesJson,
      sku: productVariants.sku,
      stockQty: productVariants.stockQty,
      reservedQty: productVariants.reservedQty,
      variantStatus: productVariants.status,
      productId: products.id,
      productName: products.name,
      productNameBn: products.nameBn,
      productSlug: products.slug,
      productStatus: products.status,
      categoryId: products.categoryId,
      deletedAt: products.deletedAt,
      image: sql<string | null>`(select i.url from ${productImages} i where i.productId = ${products.id} order by i.sortOrder limit 1)`,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.id));
  const issues: string[] = [];
  const lines = rows.map(r => {
    const available = r.stockQty - r.reservedQty;
    const sellable = !r.deletedAt && r.productStatus === "active" && r.variantStatus === "active";
    if (!sellable) issues.push(`${r.productName} is no longer available`);
    else if (r.quantity > available) issues.push(available > 0 ? `Only ${available} left of ${r.productName}` : `${r.productName} is out of stock`);
    const variantLabel = Object.values(r.options ?? {}).join(" / ");
    return { ...r, variantLabel, available, sellable, lineTotal: fromP(toP(r.price) * r.quantity) };
  });
  return { lines, subtotal: fromP(lines.reduce((s, l) => s + toP(l.lineTotal), 0)), count: lines.reduce((s, l) => s + l.quantity, 0), issues };
}

/* ───────── Coupons ───────── */
type CouponLine = { productId: number; categoryId: number | null; lineP: number };
export async function evaluateCoupon(storeId: number, rawCode: string, ctx: { subtotalP: number; lines: CouponLine[]; phone?: string | null }) {
  const code = rawCode.trim().toUpperCase();
  const [c] = await db().select().from(coupons).where(and(eq(coupons.storeId, storeId), eq(coupons.code, code))).limit(1);
  const now = Date.now();
  if (!c || c.status !== "active") return { ok: false as const, error: "This coupon code is not valid" };
  if (c.startsAt && c.startsAt.getTime() > now) return { ok: false as const, error: "This coupon is not active yet" };
  if (c.endsAt && c.endsAt.getTime() < now) return { ok: false as const, error: "This coupon has expired" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { ok: false as const, error: "This coupon has reached its usage limit" };
  if (c.minOrder && ctx.subtotalP < toP(c.minOrder)) return { ok: false as const, error: `Add ${fmtBDT(fromP(toP(c.minOrder) - ctx.subtotalP))} more to use ${code}` };
  const phone = ctx.phone ? normalizeBdPhone(ctx.phone) : null;
  if (c.perCustomerLimit && phone) {
    const [{ n }] = await db()
      .select({ n: sql<number>`count(*)` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, c.id), eq(couponRedemptions.customerPhone, phone), eq(couponRedemptions.voided, false)));
    if (Number(n) >= c.perCustomerLimit) return { ok: false as const, error: "You've already used this coupon" };
  }
  if (c.firstOrderOnly && phone) {
    const [cust] = await db().select({ totalOrders: customers.totalOrders }).from(customers).where(and(eq(customers.storeId, storeId), eq(customers.phone, phone))).limit(1);
    if (cust && cust.totalOrders > 0) return { ok: false as const, error: "This coupon is for first orders only" };
  }
  const cats = c.categoryIdsJson ?? [];
  const baseP = cats.length ? ctx.lines.filter(l => l.categoryId && cats.includes(l.categoryId)).reduce((s, l) => s + l.lineP, 0) : ctx.subtotalP;
  if (baseP <= 0) return { ok: false as const, error: "This coupon doesn't apply to the items in your cart" };
  let discountP = c.type === "percentage" ? pctOf(baseP, Number(c.value)) : Math.min(toP(c.value), baseP);
  if (c.maxDiscount) discountP = Math.min(discountP, toP(c.maxDiscount));
  return { ok: true as const, coupon: c, discountP, baseP, label: c.type === "percentage" ? `${Number(c.value)}% off` : `${fmtBDT(c.value)} off` };
}

/* ───────── Delivery & tax ───────── */
export async function zoneFor(storeId: number, district: string | null | undefined) {
  const zones = await db()
    .select()
    .from(deliveryZones)
    .where(and(eq(deliveryZones.storeId, storeId), eq(deliveryZones.status, "active")))
    .orderBy(asc(deliveryZones.sortOrder));
  if (!district) return { zone: null, zones };
  const exact = zones.find(z => z.districtsJson.some(d => d.toLowerCase() === district.toLowerCase()));
  return { zone: exact ?? zones.find(z => z.districtsJson.includes("*")) ?? null, zones };
}

export type QuoteInput = { couponCode?: string | null; district?: string | null; phone?: string | null };
export async function buildQuote(storeId: number, sessionKey: string, input: QuoteInput) {
  const cart = await cartView(storeId, sessionKey);
  const subtotalP = toP(cart.subtotal);
  let discountP = 0;
  let couponError: string | null = null;
  let couponLabel: string | null = null;
  let couponId: number | null = null;
  const lines: CouponLine[] = cart.lines.map(l => ({ productId: l.productId, categoryId: l.categoryId, lineP: toP(l.lineTotal) }));
  if (input.couponCode?.trim()) {
    const r = await evaluateCoupon(storeId, input.couponCode, { subtotalP, lines, phone: input.phone });
    if (r.ok) {
      discountP = r.discountP;
      couponLabel = r.label;
      couponId = r.coupon.id;
    } else couponError = r.error;
  }
  const { zone, zones } = await zoneFor(storeId, input.district);
  const afterDiscountP = subtotalP - discountP;
  let shippingP = zone ? toP(zone.charge) : 0;
  if (zone?.freeAbove && afterDiscountP >= toP(zone.freeAbove)) shippingP = 0;
  const [settings] = await db().select({ tax: storeSettings.taxJson, checkout: storeSettings.checkoutJson }).from(storeSettings).where(eq(storeSettings.storeId, storeId)).limit(1);
  const tax = settings?.tax;
  let taxP = 0;
  if (tax?.enabled) taxP = tax.inclusive ? Math.round((afterDiscountP * tax.ratePercent) / (100 + tax.ratePercent)) : pctOf(afterDiscountP, tax.ratePercent);
  const totalP = afterDiscountP + shippingP + (tax?.enabled && !tax.inclusive ? taxP : 0);
  return {
    cart,
    subtotal: fromP(subtotalP),
    discount: fromP(discountP),
    couponLabel,
    couponError,
    couponId,
    shipping: fromP(shippingP),
    zone: zone ? { id: zone.id, name: zone.name, nameBn: zone.nameBn, charge: zone.charge, eta: zone.etaText, freeAbove: zone.freeAbove } : null,
    zones: zones.map(z => ({ id: z.id, name: z.name, charge: z.charge, eta: z.etaText, districts: z.districtsJson })),
    tax: tax?.enabled ? { amount: fromP(taxP), ratePercent: tax.ratePercent, inclusive: tax.inclusive, label: tax.label } : null,
    total: fromP(totalP),
    minOrder: settings?.checkout?.minOrder ?? null,
  };
}

/* ───────── Place order ───────── */
export type PlaceOrderInput = {
  sessionKey: string;
  idempotencyKey: string;
  customer: { name: string; phone: string; email?: string | null };
  address: { line1: string; area?: string; district: string; postcode?: string };
  note?: string | null;
  couponCode?: string | null;
  paymentMethod: PaymentProvider;
  marketingConsent: boolean;
  locale: "bn" | "en";
};

export async function placeOrder(store: Store, input: PlaceOrderInput, meta: { ip: string; source?: "storefront" | "api" }) {
  const ent = await getEntitlements(store.tenantId);
  if (store.status !== "published" || !ent.storefrontLive) fail("FORBIDDEN", "This store is not accepting orders right now");
  if (!ent.acceptingOrders) fail("READ_ONLY", "This store is temporarily not accepting new orders");
  const [dup] = await db().select().from(orders).where(and(eq(orders.storeId, store.id), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1);
  if (dup) return { order: dup, payment: null, duplicate: true };

  const phone = normalizeBdPhone(input.customer.phone);
  if (!phone) fail("VALIDATION", "Enter a valid Bangladesh mobile number (01XXXXXXXXX)");
  if (!input.customer.name.trim()) fail("VALIDATION", "Name is required");
  if (!input.address.line1.trim()) fail("VALIDATION", "Delivery address is required");
  if (!(BD_DISTRICTS as readonly string[]).includes(input.address.district)) fail("VALIDATION", "Select a valid district");
  const [blocked] = await db().select({ status: customers.status }).from(customers).where(and(eq(customers.storeId, store.id), eq(customers.phone, phone))).limit(1);
  if (blocked?.status === "blacklisted") fail("FORBIDDEN", "We couldn't place this order. Please contact the store directly.");

  const [pm] = await db().select().from(paymentMethods).where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.provider, input.paymentMethod), eq(paymentMethods.status, "active"))).limit(1);
  if (!pm || (input.paymentMethod !== "cod" && !pm.encryptedSecretRef)) fail("VALIDATION", "Selected payment method is not available");
  const [settings] = await db().select().from(storeSettings).where(eq(storeSettings.storeId, store.id)).limit(1);
  if (input.paymentMethod === "cod" && settings?.checkoutJson?.codEnabled === false) fail("VALIDATION", "Cash on delivery is not available for this store");

  const q = await buildQuote(store.id, input.sessionKey, { couponCode: input.couponCode, district: input.address.district, phone });
  if (!q.cart.lines.length) fail("VALIDATION", "Your cart is empty");
  if (q.cart.issues.length) fail("OUT_OF_STOCK", q.cart.issues[0], { issues: q.cart.issues });
  if (input.couponCode && q.couponError) fail("VALIDATION", q.couponError);
  if (!q.zone) fail("VALIDATION", "This store doesn't deliver to the selected district");
  if (q.minOrder && toP(q.subtotal) < toP(q.minOrder)) fail("VALIDATION", `Minimum order is ${fmtBDT(q.minOrder)}`);

  const accessToken = randomToken(18);
  const isCod = input.paymentMethod === "cod";
  const discountP = toP(q.discount);
  const subtotalP = toP(q.subtotal);
  let orderId = 0;
  let orderNo = "";
  try {
    await db().transaction(async tx => {
      await tx.update(stores).set({ orderSeq: sql`${stores.orderSeq} + 1` }).where(eq(stores.id, store.id));
      const [{ seq }] = await tx.select({ seq: stores.orderSeq }).from(stores).where(eq(stores.id, store.id));
      orderNo = `${store.slug.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "ATL"}-${seq}`;
      const address: Address = { name: input.customer.name.trim(), phone, line1: input.address.line1.trim(), area: input.address.area?.trim(), district: input.address.district, postcode: input.address.postcode?.trim() };
      await tx
        .insert(customers)
        .values({
          storeId: store.id,
          name: input.customer.name.trim(),
          phone,
          email: input.customer.email?.trim() || null,
          addressJson: address,
          consentJson: { marketing: input.marketingConsent, updatedAt: new Date().toISOString(), source: "checkout" },
          totalOrders: 1,
          lastOrderAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            name: input.customer.name.trim(),
            email: sql`coalesce(${input.customer.email?.trim() || null}, ${customers.email})`,
            addressJson: address,
            consentJson: { marketing: input.marketingConsent, updatedAt: new Date().toISOString(), source: "checkout" },
            totalOrders: sql`${customers.totalOrders} + 1`,
            lastOrderAt: new Date(),
          },
        });
      const [cust] = await tx.select({ id: customers.id }).from(customers).where(and(eq(customers.storeId, store.id), eq(customers.phone, phone))).limit(1);
      const [o] = await tx
        .insert(orders)
        .values({
          storeId: store.id,
          tenantId: store.tenantId,
          orderNo,
          customerId: cust.id,
          status: "PENDING_PAYMENT",
          paymentStatus: isCod ? "cod_pending" : "pending",
          paymentMethod: input.paymentMethod,
          subtotal: q.subtotal,
          discountTotal: q.discount,
          shippingTotal: q.shipping,
          taxTotal: q.tax?.amount ?? "0.00",
          grandTotal: q.total,
          couponCode: q.couponId ? input.couponCode!.trim().toUpperCase() : null,
          customerSnapshotJson: { name: input.customer.name.trim(), phone, email: input.customer.email?.trim() || undefined },
          addressSnapshotJson: address,
          deliverySnapshotJson: { zoneId: q.zone!.id, zoneName: q.zone!.name, charge: q.shipping, eta: q.zone!.eta ?? undefined },
          taxSnapshotJson: q.tax ? { ratePercent: q.tax.ratePercent, inclusive: q.tax.inclusive, label: q.tax.label } : null,
          customerNote: input.note?.trim() || null,
          idempotencyKey: input.idempotencyKey,
          accessToken,
          source: meta.source ?? "storefront",
          locale: input.locale,
        })
        .$returningId();
      orderId = o.id;
      // Proportional discount allocation across lines (immutable snapshot).
      let allocated = 0;
      for (const [i, l] of q.cart.lines.entries()) {
        const ok = await reserveStock(tx, store.id, l.variantId, l.quantity, orderNo);
        if (!ok) fail("OUT_OF_STOCK", `${l.productName} just sold out. Please update your cart.`);
        const lineP = toP(l.lineTotal);
        const share = i === q.cart.lines.length - 1 ? discountP - allocated : Math.round((discountP * lineP) / Math.max(subtotalP, 1));
        allocated += share;
        await tx.insert(orderItems).values({
          orderId: o.id,
          productId: l.productId,
          variantId: l.variantId,
          nameSnapshot: l.productName,
          skuSnapshot: l.sku,
          variantSnapshot: l.variantLabel || null,
          imageSnapshot: l.image,
          quantity: l.quantity,
          unitPrice: l.price,
          discountTotal: fromP(share),
          lineTotal: l.lineTotal,
        });
      }
      if (q.couponId) {
        const ok = affected(
          await tx
            .update(coupons)
            .set({ usedCount: sql`${coupons.usedCount} + 1` })
            .where(and(eq(coupons.id, q.couponId), sql`(${coupons.usageLimit} is null or ${coupons.usedCount} < ${coupons.usageLimit})`))
        );
        if (!ok) fail("VALIDATION", "This coupon has just reached its usage limit");
        await tx.insert(couponRedemptions).values({ couponId: q.couponId, orderId: o.id, customerPhone: phone, amount: q.discount });
      }
      await tx.insert(orderEvents).values({ orderId: o.id, eventType: "created", toStatus: "PENDING_PAYMENT", actorType: meta.source === "api" ? "api" : "customer", note: `Order placed — ${isCod ? "Cash on delivery" : "online payment"}` });
      await tx.update(carts).set({ status: "converted", customerId: cust.id }).where(and(eq(carts.storeId, store.id), eq(carts.sessionKey, input.sessionKey)));
    });
  } catch (e) {
    if (String((e as Error).message).includes("orders_idem_uq")) {
      const [again] = await db().select().from(orders).where(and(eq(orders.storeId, store.id), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1);
      if (again) return { order: again, payment: null, duplicate: true };
    }
    throw e;
  }
  const [order] = await db().select().from(orders).where(eq(orders.id, orderId)).limit(1);
  await db()
    .update(customers)
    .set({ totalSpent: sql`${customers.totalSpent} + ${order.grandTotal}` })
    .where(eq(customers.id, order.customerId!));
  await audit({ tenantId: store.tenantId, actorType: meta.source === "api" ? "api" : "customer", action: "order.created", resourceType: "order", resourceId: order.id, ip: meta.ip, metadata: { orderNo, total: order.grandTotal, method: input.paymentMethod } });
  await track("order_created", { tenantId: store.tenantId, storeId: store.id, props: { orderNo, total: order.grandTotal, method: input.paymentMethod } });
  await emitEvent(store.tenantId, store.id, "order.created", { orderNo, total: order.grandTotal, paymentMethod: input.paymentMethod, items: q.cart.lines.map(l => ({ sku: l.sku, name: l.productName, quantity: l.quantity })) });
  await notifyOrderPlaced(order as Order, "placed");
  let payment: { reference: string; redirectUrl: string } | null = null;
  if (!isCod) payment = await initiateOrderPayment(order as Order, input.paymentMethod as OnlineProvider, `ord:${order.id}:1`);
  return { order, payment, duplicate: false };
}

export async function retryOrderPayment(storeId: number, orderNo: string, token: string, provider: OnlineProvider) {
  const [o] = await db().select().from(orders).where(and(eq(orders.storeId, storeId), eq(orders.orderNo, orderNo))).limit(1);
  if (!o || o.accessToken !== token) fail("NOT_FOUND", "Order not found");
  return initiateOrderPayment(o, provider);
}

export async function storeOrderFor(storeId: number, orderNo: string, token: string) {
  const [o] = await db().select().from(orders).where(and(eq(orders.storeId, storeId), eq(orders.orderNo, orderNo))).limit(1);
  if (!o || o.accessToken !== token) fail("NOT_FOUND", "Order not found");
  return o;
}

/** Customer self-service order lookup by phone (OTP verified in the router). */
export async function ordersByPhone(storeId: number, phone: string) {
  return db()
    .select({ orderNo: orders.orderNo, status: orders.status, grandTotal: orders.grandTotal, createdAt: orders.createdAt, accessToken: orders.accessToken, paymentMethod: orders.paymentMethod })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), sql`JSON_UNQUOTE(JSON_EXTRACT(${orders.customerSnapshotJson}, '$.phone')) = ${phone}`))
    .orderBy(sql`${orders.createdAt} desc`)
    .limit(30);
}

export async function variantsByIds(storeId: number, ids: number[]) {
  if (!ids.length) return [];
  return db().select().from(productVariants).where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, ids)));
}
