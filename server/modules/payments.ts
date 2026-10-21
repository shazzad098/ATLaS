import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, affected } from "../db";
import { invoices, orderEvents, orders, paymentMethods, payments, paymentWebhookEvents, sandboxGatewayTransactions, stores } from "../../drizzle/schema";
import { ONLINE_PROVIDERS, PROVIDER_INFO, type OnlineProvider, type PaymentProvider } from "../../shared/domain";
import { fail, fmtBDT, fromP, pctOf, toP } from "../lib/core";
import { encryptSecret, hmacHex, maskSecret, randomId, randomToken, safeEqual, sha256 } from "../lib/crypto";
import { onInvoicePaid, saveMethod } from "./billing";
import { every } from "./jobs";
import { audit, emitEvent, notifyTenant, sendSms, track } from "./ops";
import { notifyOrderPlaced, trackingPath, trackPaymentSuccess, transitionOrder, type Order } from "./orders";
import { markOnboarding } from "./stores";
import { requirePerm, requireWrite, type TenantScope } from "./tenancy";

export type Payment = typeof payments.$inferSelect;
const PAYMENT_TTL_MS = 15 * 60_000;
const SETTLEMENT_DELAY_MS = 2 * 24 * 3600_000;

/* ───────── Gateway adapter contract ───────── */
export interface GatewayAdapter {
  provider: OnlineProvider;
  initiate(p: { reference: string; amount: string; merchantName: string; callbackUrl: string }): Promise<{ redirectUrl: string; providerTxnId: string }>;
  query(reference: string): Promise<{ status: "pending" | "succeeded" | "failed" | "cancelled" | "refunded"; amount: string; providerTxnId: string } | null>;
  refund(reference: string, amountP: number): Promise<boolean>;
  verifySignature(rawBody: string, signature: string): boolean;
}

const webhookSecret = (provider: string) => sha256(`atlas-sandbox-webhook:${provider}:${process.env.MANUS_JWT_SECRET || "dev"}`);
export const signWebhook = (provider: string, rawBody: string) => hmacHex(webhookSecret(provider), rawBody);

/** Sandbox gateway: behaves like the provider (own ledger, hosted payment page, signed server-to-server webhooks). */
class SandboxGateway implements GatewayAdapter {
  constructor(
    public provider: OnlineProvider,
    private prefix: string
  ) {}
  async initiate(p: { reference: string; amount: string; merchantName: string; callbackUrl: string }) {
    const providerTxnId = `${this.prefix}${randomId(10).toUpperCase()}`;
    await db().insert(sandboxGatewayTransactions).values({ provider: this.provider, reference: p.reference, providerTxnId, amount: p.amount, status: "pending", callbackUrl: p.callbackUrl, merchantName: p.merchantName });
    return { redirectUrl: `/pay/${this.provider}/${p.reference}`, providerTxnId };
  }
  async query(reference: string) {
    const [t] = await db().select().from(sandboxGatewayTransactions).where(eq(sandboxGatewayTransactions.reference, reference)).limit(1);
    return t ? { status: t.status, amount: t.amount, providerTxnId: t.providerTxnId } : null;
  }
  async refund(reference: string, amountP: number) {
    const [t] = await db().select().from(sandboxGatewayTransactions).where(eq(sandboxGatewayTransactions.reference, reference)).limit(1);
    if (!t || !["succeeded", "refunded"].includes(t.status) || amountP > toP(t.amount)) return false;
    if (amountP >= toP(t.amount)) await db().update(sandboxGatewayTransactions).set({ status: "refunded" }).where(eq(sandboxGatewayTransactions.id, t.id));
    return true;
  }
  verifySignature(rawBody: string, signature: string) {
    return safeEqual(signWebhook(this.provider, rawBody), signature);
  }
}
export const GATEWAYS: Record<OnlineProvider, GatewayAdapter> = {
  bkash: new SandboxGateway("bkash", "BK"),
  nagad: new SandboxGateway("nagad", "NG"),
  sslcommerz: new SandboxGateway("sslcommerz", "SSL"),
};
const isOnline = (p: string): p is OnlineProvider => (ONLINE_PROVIDERS as readonly string[]).includes(p);
const newReference = () => `ATL${Date.now().toString(36).toUpperCase()}${randomId(6).toUpperCase()}`;

async function orderEvent(orderId: number, actorType: "gateway" | "system" | "customer", note: string) {
  await db().insert(orderEvents).values({ orderId, eventType: "payment", actorType, note });
}

/* ───────── Order payments ───────── */
export async function initiateOrderPayment(o: Order, provider: OnlineProvider, idempotencyKey?: string) {
  const [pm] = await db()
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, o.storeId), eq(paymentMethods.provider, provider), eq(paymentMethods.status, "active")))
    .limit(1);
  if (!pm) fail("VALIDATION", `${PROVIDER_INFO[provider].name} is not enabled for this store`);
  if (o.status !== "PENDING_PAYMENT") fail("INVALID_STATE", "This order is not awaiting payment");
  if (idempotencyKey) {
    const [dup] = await db().select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).limit(1);
    if (dup) return { reference: dup.reference, redirectUrl: `/pay/${dup.provider}/${dup.reference}` };
  }
  const [paid] = await db().select({ id: payments.id }).from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "succeeded"))).limit(1);
  if (paid) fail("CONFLICT", "This order is already paid");
  await db()
    .update(payments)
    .set({ status: "expired", failureReason: "Superseded by a new attempt" })
    .where(and(eq(payments.orderId, o.id), inArray(payments.status, ["initiated", "pending"])));
  const [store] = await db().select({ name: stores.name }).from(stores).where(eq(stores.id, o.storeId)).limit(1);
  const reference = newReference();
  const { redirectUrl, providerTxnId } = await GATEWAYS[provider].initiate({ reference, amount: o.grandTotal, merchantName: store?.name ?? "ATLaS store", callbackUrl: `/api/payments/callback/${reference}` });
  await db().insert(payments).values({
    scope: "order",
    tenantId: o.tenantId,
    storeId: o.storeId,
    orderId: o.id,
    provider,
    reference,
    providerTxnId,
    amount: o.grandTotal,
    status: "pending",
    idempotencyKey: idempotencyKey ?? null,
    expiresAt: new Date(Date.now() + PAYMENT_TTL_MS),
  });
  await db().update(orders).set({ paymentMethod: provider, paymentStatus: "pending" }).where(eq(orders.id, o.id));
  await orderEvent(o.id, "customer", `Payment initiated via ${PROVIDER_INFO[provider].name} (ref ${reference})`);
  return { reference, redirectUrl };
}

/** Customer switches a pending online order to cash on delivery. */
export async function switchToCod(o: Order) {
  if (o.status !== "PENDING_PAYMENT" || o.paymentMethod === "cod") fail("INVALID_STATE", "This order can't be switched to COD");
  const [cod] = await db().select().from(paymentMethods).where(and(eq(paymentMethods.storeId, o.storeId), eq(paymentMethods.provider, "cod"), eq(paymentMethods.status, "active"))).limit(1);
  if (!cod) fail("VALIDATION", "Cash on delivery is not available for this store");
  await db().update(payments).set({ status: "cancelled", failureReason: "Customer switched to COD" }).where(and(eq(payments.orderId, o.id), inArray(payments.status, ["initiated", "pending"])));
  await db().update(orders).set({ paymentMethod: "cod", paymentStatus: "cod_pending" }).where(eq(orders.id, o.id));
  await orderEvent(o.id, "customer", "Customer switched to Cash on Delivery");
  const [fresh] = await db().select().from(orders).where(eq(orders.id, o.id)).limit(1);
  await notifyOrderPlaced(fresh, "placed");
}

/* ───────── Sandbox hosted payment page ───────── */
export async function sandboxView(reference: string) {
  const [t] = await db().select().from(sandboxGatewayTransactions).where(eq(sandboxGatewayTransactions.reference, reference)).limit(1);
  if (!t) fail("NOT_FOUND", "Payment session not found");
  const [p] = await db().select().from(payments).where(eq(payments.reference, reference)).limit(1);
  return {
    provider: t.provider as OnlineProvider,
    reference: t.reference,
    providerTxnId: t.providerTxnId,
    amount: t.amount,
    merchantName: t.merchantName,
    status: t.status,
    expiresAt: p?.expiresAt ?? null,
    expired: p?.status === "expired",
    scope: p?.scope ?? "order",
  };
}

/** Customer approves/declines on the sandbox gateway; the "provider" then sends a signed webhook. */
export async function sandboxAct(reference: string, action: "approve" | "decline" | "cancel", opts: { pin?: string } = {}) {
  const [t] = await db().select().from(sandboxGatewayTransactions).where(eq(sandboxGatewayTransactions.reference, reference)).limit(1);
  if (!t) fail("NOT_FOUND", "Payment session not found");
  if (t.status === "pending") {
    if (action === "approve" && opts.pin !== undefined && !/^\d{4,6}$/.test(opts.pin)) fail("VALIDATION", "Enter your 4–6 digit PIN (any digits work in sandbox)");
    const status = action === "approve" ? "succeeded" : action === "decline" ? "failed" : "cancelled";
    await db().update(sandboxGatewayTransactions).set({ status }).where(eq(sandboxGatewayTransactions.id, t.id));
    const body = JSON.stringify({ eventId: `evt_${randomId(18)}`, type: "payment.updated", reference, providerTxnId: t.providerTxnId, status, amount: t.amount, occurredAt: new Date().toISOString() });
    await handleGatewayWebhook(t.provider, body, signWebhook(t.provider, body));
  }
  return { redirectUrl: `/api/payments/callback/${reference}` };
}

/* ───────── Webhooks (signature + idempotency) ───────── */
export async function handleGatewayWebhook(provider: string, rawBody: string, signature: string | undefined) {
  if (!isOnline(provider)) return { httpStatus: 404, status: "ignored" as const };
  let body: { eventId?: string; reference?: string; status?: string; providerTxnId?: string; amount?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { httpStatus: 400, status: "rejected" as const };
  }
  const payloadHash = sha256(rawBody);
  const eventKey = String(body.eventId ?? payloadHash).slice(0, 100);
  const valid = !!signature && GATEWAYS[provider].verifySignature(rawBody, signature);
  let eventId: number;
  try {
    const [row] = await db()
      .insert(paymentWebhookEvents)
      .values({ provider, eventKey, signatureValid: valid, payloadHash, payloadJson: body as Record<string, unknown>, paymentReference: body.reference?.slice(0, 40) ?? null, status: "received" })
      .$returningId();
    eventId = row.id;
  } catch (e) {
    if (!String((e as Error).message).includes("Duplicate")) throw e;
    await db()
      .insert(paymentWebhookEvents)
      .values({ provider, eventKey: `${eventKey}#dup-${randomId(6)}`, signatureValid: valid, payloadHash, payloadJson: body as Record<string, unknown>, paymentReference: body.reference?.slice(0, 40) ?? null, status: "duplicate", processedAt: new Date() });
    return { httpStatus: 200, status: "duplicate" as const };
  }
  if (!valid) {
    await db().update(paymentWebhookEvents).set({ status: "rejected", error: "Signature verification failed — payment left pending", processedAt: new Date() }).where(eq(paymentWebhookEvents.id, eventId));
    return { httpStatus: 401, status: "rejected" as const };
  }
  try {
    const result = await applyProviderStatus(body.reference ?? "", body.status ?? "", body.providerTxnId ?? "", body.amount ?? "0", "webhook");
    await db()
      .update(paymentWebhookEvents)
      .set({ status: result === "unknown" || result === "already_processed" ? "ignored" : "processed", error: result === "amount_mismatch" ? "Amount mismatch" : result === "already_processed" ? "Already processed (idempotent)" : null, processedAt: new Date() })
      .where(eq(paymentWebhookEvents.id, eventId));
    return { httpStatus: 200, status: "processed" as const, result };
  } catch (e) {
    await db().update(paymentWebhookEvents).set({ status: "failed", error: String((e as Error).message).slice(0, 250), processedAt: new Date() }).where(eq(paymentWebhookEvents.id, eventId));
    return { httpStatus: 500, status: "failed" as const };
  }
}

async function applyProviderStatus(reference: string, status: string, providerTxnId: string, amount: string, source: "webhook" | "callback" | "reconcile") {
  const [p] = await db().select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!p) return "unknown" as const;
  if (status === "succeeded") {
    if (toP(amount) !== toP(p.amount)) {
      await db().update(payments).set({ status: "failed", failureReason: `Amount mismatch: provider ${amount} vs expected ${p.amount}` }).where(eq(payments.id, p.id));
      if (p.orderId) await orderEvent(p.orderId, "system", `Payment ${reference} rejected — amount mismatch`);
      return "amount_mismatch" as const;
    }
    return markPaymentSucceeded(p, providerTxnId || p.providerTxnId || "", source);
  }
  if (status === "failed" || status === "cancelled") {
    const changed = affected(
      await db()
        .update(payments)
        .set({ status: status === "failed" ? "failed" : "cancelled", failureReason: status === "failed" ? "Declined by provider" : "Cancelled by customer" })
        .where(and(eq(payments.id, p.id), inArray(payments.status, ["initiated", "pending"])))
    );
    if (!changed) return "already_processed" as const;
    if (p.scope === "order" && p.orderId) {
      await db().update(orders).set({ paymentStatus: "failed" }).where(and(eq(orders.id, p.orderId), eq(orders.paymentStatus, "pending")));
      await orderEvent(p.orderId, "gateway", `Payment ${status} via ${PROVIDER_INFO[p.provider].name} (ref ${reference})`);
      const [o] = await db().select().from(orders).where(eq(orders.id, p.orderId)).limit(1);
      const [s] = await db().select({ name: stores.name, slug: stores.slug }).from(stores).where(eq(stores.id, o.storeId)).limit(1);
      await sendSms({ to: o.customerSnapshotJson.phone, body: `${s?.name}: Payment for order ${o.orderNo} was not completed. Retry or switch to COD: ${trackingPath(s?.slug ?? "", o)}`, template: "payment_failed", tenantId: o.tenantId });
      await notifyTenant(o.tenantId, "orders.read", { type: "payment.failed", title: `Payment ${status} — ${o.orderNo}`, body: `${fmtBDT(o.grandTotal)} via ${PROVIDER_INFO[p.provider].name}. The customer can retry.`, link: `/app/orders/${o.id}` });
      await emitEvent(o.tenantId, o.storeId, "payment.failed", { orderNo: o.orderNo, reference });
    } else if (p.scope === "platform_invoice") {
      await notifyTenant(p.tenantId, "billing.manage", { type: "billing.payment_failed", title: "Subscription payment failed", body: `Payment ${reference} was ${status}. Retry from Billing.`, link: "/app/billing" });
    }
    return "failed" as const;
  }
  return "unknown" as const;
}

async function markPaymentSucceeded(p: Payment, providerTxnId: string, source: string) {
  const fee = p.scope === "order" ? pctOf(toP(p.amount), PROVIDER_INFO[p.provider].feePercent) : 0;
  const changed = affected(
    await db()
      .update(payments)
      .set({ status: "succeeded", providerTxnId, feeAmount: fromP(fee), settlementStatus: p.scope === "order" ? "unsettled" : "not_applicable", failureReason: null })
      .where(and(eq(payments.id, p.id), inArray(payments.status, ["initiated", "pending", "expired", "failed"])))
  );
  if (!changed) return "already_processed" as const;
  if (p.scope === "order" && p.orderId) {
    const [o] = await db().select().from(orders).where(eq(orders.id, p.orderId)).limit(1);
    const [otherPaid] = await db()
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.orderId, p.orderId), eq(payments.status, "succeeded"), sql`${payments.id} <> ${p.id}`))
      .limit(1);
    if (o.status === "PENDING_PAYMENT" && !otherPaid) {
      const paid = await transitionOrder(o.id, "PAID", { type: "gateway" }, `Paid via ${PROVIDER_INFO[p.provider].name} — txn ${providerTxnId} (${source})`);
      await notifyOrderPlaced(paid, "paid");
      await trackPaymentSuccess(paid);
      await emitEvent(o.tenantId, o.storeId, "payment.succeeded", { orderNo: o.orderNo, reference: p.reference, amount: p.amount, provider: p.provider });
    } else {
      // Late or duplicate success: never double-charge — refund automatically.
      const ok = await refundPayment(p.id, toP(p.amount), otherPaid ? "Duplicate payment" : "Payment arrived after order was closed");
      await orderEvent(o.id, "system", `${otherPaid ? "Duplicate" : "Late"} payment ${p.reference} ${ok ? "refunded automatically" : "needs manual refund"}`);
    }
  } else if (p.scope === "platform_invoice" && p.invoiceId) {
    const meta = (p.rawReference ?? {}) as { saveForAutoRenew?: boolean };
    if (meta.saveForAutoRenew) await saveMethod(p.tenantId, { provider: p.provider, label: `${PROVIDER_INFO[p.provider].name} •••• ${providerTxnId.slice(-4)}`, token: randomToken(16) });
    await onInvoicePaid(p.invoiceId);
  }
  return "succeeded" as const;
}

/** Customer return URL: verifies with the provider (query) instead of trusting URL params. */
export async function handleCallback(reference: string) {
  const [p] = await db().select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!p) return "/";
  if (["initiated", "pending"].includes(p.status) && isOnline(p.provider)) {
    const q = await GATEWAYS[p.provider].query(reference);
    if (q && q.status !== "pending") await applyProviderStatus(reference, q.status, q.providerTxnId, q.amount, "callback");
  }
  const [fresh] = await db().select().from(payments).where(eq(payments.id, p.id)).limit(1);
  if (p.scope === "order" && p.orderId) {
    const [o] = await db().select().from(orders).where(eq(orders.id, p.orderId)).limit(1);
    const [s] = await db().select({ slug: stores.slug }).from(stores).where(eq(stores.id, o.storeId)).limit(1);
    return `${trackingPath(s?.slug ?? "", o)}&payment=${fresh.status}`;
  }
  return `/app/billing?payment=${fresh.status}&invoice=${p.invoiceId ?? ""}`;
}

export async function refundPayment(paymentId: number, amountP: number, reason: string) {
  const [p] = await db().select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p || p.status !== "succeeded" || !isOnline(p.provider)) return false;
  const ok = await GATEWAYS[p.provider].refund(p.reference, amountP);
  if (!ok) return false;
  const refunds = [...(((p.rawReference ?? {}) as { refunds?: unknown[] }).refunds ?? []), { amount: fromP(amountP), reason, at: new Date().toISOString() }];
  const totalRefundedP = refunds.reduce<number>((s, r) => s + toP((r as { amount: string }).amount), 0);
  await db()
    .update(payments)
    .set({ rawReference: { ...(p.rawReference ?? {}), refunds }, status: totalRefundedP >= toP(p.amount) ? "refunded" : "succeeded" })
    .where(eq(payments.id, p.id));
  if (p.storeId) await emitEvent(p.tenantId, p.storeId, "payment.refunded", { reference: p.reference, amount: fromP(amountP), reason });
  return true;
}

/* ───────── Platform (subscription) payments ───────── */
export async function payInvoice(tenantId: number, invoiceId: number, provider: OnlineProvider, saveForAutoRenew: boolean, actorId: number) {
  const [inv] = await db().select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))).limit(1);
  if (!inv) fail("NOT_FOUND", "Invoice not found");
  if (inv.status !== "open") fail("INVALID_STATE", "This invoice is not open");
  await db()
    .update(payments)
    .set({ status: "expired", failureReason: "Superseded by a new attempt" })
    .where(and(eq(payments.invoiceId, inv.id), inArray(payments.status, ["initiated", "pending"])));
  const reference = newReference();
  const { redirectUrl, providerTxnId } = await GATEWAYS[provider].initiate({ reference, amount: inv.total, merchantName: "ATLaS subscription", callbackUrl: `/api/payments/callback/${reference}` });
  await db().insert(payments).values({
    scope: "platform_invoice",
    tenantId,
    invoiceId: inv.id,
    provider,
    reference,
    providerTxnId,
    amount: inv.total,
    status: "pending",
    settlementStatus: "not_applicable",
    rawReference: { saveForAutoRenew, actorId },
    expiresAt: new Date(Date.now() + PAYMENT_TTL_MS),
  });
  await audit({ tenantId, actorId, actorType: "merchant", action: "billing.payment_initiated", resourceType: "invoice", resourceId: inv.id, metadata: { provider, reference } });
  return { reference, redirectUrl };
}

/** Auto-renew charge against a saved wallet token (called by billing lifecycle). */
export async function recordPlatformCharge(invoice: typeof invoices.$inferSelect, provider: string, success: boolean) {
  const prov = (isOnline(provider) ? provider : "bkash") as OnlineProvider;
  const reference = newReference();
  const providerTxnId = `${prov.slice(0, 2).toUpperCase()}${randomId(10).toUpperCase()}`;
  await db().insert(sandboxGatewayTransactions).values({ provider: prov, reference, providerTxnId, amount: invoice.total, status: success ? "succeeded" : "failed", merchantName: "ATLaS subscription" });
  await db().insert(payments).values({
    scope: "platform_invoice",
    tenantId: invoice.tenantId,
    invoiceId: invoice.id,
    provider: prov,
    reference,
    providerTxnId,
    amount: invoice.total,
    status: success ? "succeeded" : "failed",
    failureReason: success ? null : "Auto-renew charge declined (insufficient balance)",
    settlementStatus: "not_applicable",
    rawReference: { autoRenew: true },
  });
}

/* ───────── Merchant: gateway connections & transactions ───────── */
export const GATEWAY_FIELDS: Record<OnlineProvider, { key: string; label: string; secret: boolean }[]> = {
  bkash: [
    { key: "merchantNumber", label: "bKash merchant number", secret: false },
    { key: "appKey", label: "App key", secret: true },
    { key: "appSecret", label: "App secret", secret: true },
    { key: "username", label: "Username", secret: false },
    { key: "password", label: "Password", secret: true },
  ],
  nagad: [
    { key: "merchantId", label: "Merchant ID", secret: false },
    { key: "merchantNumber", label: "Nagad merchant number", secret: false },
    { key: "publicKey", label: "Public key (PG)", secret: true },
    { key: "privateKey", label: "Merchant private key", secret: true },
  ],
  sslcommerz: [
    { key: "storeId", label: "Store ID", secret: false },
    { key: "storePassword", label: "Store password", secret: true },
  ],
};

export async function listPaymentMethods(scope: TenantScope) {
  requirePerm(scope, "payments.manage");
  const rows = await db().select().from(paymentMethods).where(eq(paymentMethods.storeId, scope.storeId));
  return (["cod", ...ONLINE_PROVIDERS] as PaymentProvider[]).map(provider => {
    const r = rows.find(x => x.provider === provider);
    return {
      provider,
      name: PROVIDER_INFO[provider].name,
      feePercent: PROVIDER_INFO[provider].feePercent,
      connected: !!r && (provider === "cod" || !!r.encryptedSecretRef),
      status: r?.status ?? "inactive",
      mode: r?.mode ?? "sandbox",
      publicConfig: r?.publicConfigJson ?? {},
      fields: isOnline(provider) ? GATEWAY_FIELDS[provider] : [],
    };
  });
}

export async function connectGateway(scope: TenantScope, provider: OnlineProvider, credentials: Record<string, string>) {
  requireWrite(scope, "payments.manage");
  const fields = GATEWAY_FIELDS[provider];
  for (const f of fields) if (!credentials[f.key]?.trim()) fail("VALIDATION", `${f.label} is required`);
  const publicConfig: Record<string, string> = {};
  for (const f of fields) publicConfig[f.key] = f.secret ? maskSecret(credentials[f.key]) : credentials[f.key].trim();
  const secretRef = encryptSecret(JSON.stringify(Object.fromEntries(fields.map(f => [f.key, credentials[f.key].trim()]))), `gateway:${scope.storeId}:${provider}`);
  await db()
    .insert(paymentMethods)
    .values({ storeId: scope.storeId, provider, mode: "sandbox", publicConfigJson: publicConfig, encryptedSecretRef: secretRef, status: "active" })
    .onDuplicateKeyUpdate({ set: { publicConfigJson: publicConfig, encryptedSecretRef: secretRef, status: "active", mode: "sandbox" } });
  await markOnboarding(scope.storeId, "paymentConfigured");
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "payments.gateway_connected", resourceType: "payment_method", resourceId: provider, impersonationId: scope.impersonationId });
}

export async function setPaymentMethodStatus(scope: TenantScope, provider: PaymentProvider, active: boolean) {
  requireWrite(scope, "payments.manage");
  if (provider !== "cod") {
    const [r] = await db().select().from(paymentMethods).where(and(eq(paymentMethods.storeId, scope.storeId), eq(paymentMethods.provider, provider))).limit(1);
    if (active && !r?.encryptedSecretRef) fail("VALIDATION", "Connect the gateway credentials first");
  }
  await db()
    .insert(paymentMethods)
    .values({ storeId: scope.storeId, provider, mode: provider === "cod" ? "live" : "sandbox", status: active ? "active" : "inactive" })
    .onDuplicateKeyUpdate({ set: { status: active ? "active" : "inactive" } });
  const active_ = await db().select().from(paymentMethods).where(and(eq(paymentMethods.storeId, scope.storeId), eq(paymentMethods.status, "active")));
  if (!active_.length) {
    await db().update(paymentMethods).set({ status: "active" }).where(and(eq(paymentMethods.storeId, scope.storeId), eq(paymentMethods.provider, provider)));
    fail("VALIDATION", "Keep at least one payment method active");
  }
  if (active) await markOnboarding(scope.storeId, "paymentConfigured");
}

export async function disconnectGateway(scope: TenantScope, provider: OnlineProvider) {
  requireWrite(scope, "payments.manage");
  await db().update(paymentMethods).set({ status: "inactive", encryptedSecretRef: null, publicConfigJson: {} }).where(and(eq(paymentMethods.storeId, scope.storeId), eq(paymentMethods.provider, provider)));
  await audit({ tenantId: scope.tenantId, actorId: scope.userId, actorType: "merchant", action: "payments.gateway_disconnected", resourceType: "payment_method", resourceId: provider, impersonationId: scope.impersonationId });
}

export async function storefrontPaymentOptions(storeId: number) {
  const rows = await db().select().from(paymentMethods).where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.status, "active")));
  return rows.filter(r => r.provider === "cod" || r.encryptedSecretRef).map(r => ({ provider: r.provider, name: PROVIDER_INFO[r.provider].name, mode: r.mode }));
}

export async function transactions(scope: TenantScope, q: { page: number; pageSize: number; status?: string; provider?: string }) {
  requirePerm(scope, "payments.manage");
  const where = and(eq(payments.storeId, scope.storeId), eq(payments.scope, "order"), q.status ? eq(payments.status, q.status as Payment["status"]) : undefined, q.provider ? eq(payments.provider, q.provider as PaymentProvider) : undefined);
  const [{ total }] = await db().select({ total: sql<number>`count(*)` }).from(payments).where(where);
  const rows = await db()
    .select({ p: payments, orderNo: orders.orderNo })
    .from(payments)
    .leftJoin(orders, eq(orders.id, payments.orderId))
    .where(where)
    .orderBy(desc(payments.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const [sum] = await db()
    .select({
      gross: sql<string>`coalesce(sum(case when ${payments.status} in ('succeeded','refunded') then ${payments.amount} else 0 end),0)`,
      fees: sql<string>`coalesce(sum(case when ${payments.status} in ('succeeded','refunded') then ${payments.feeAmount} else 0 end),0)`,
      settled: sql<string>`coalesce(sum(case when ${payments.settlementStatus} = 'settled' then ${payments.amount} - ${payments.feeAmount} else 0 end),0)`,
      unsettled: sql<string>`coalesce(sum(case when ${payments.status} = 'succeeded' and ${payments.settlementStatus} = 'unsettled' then ${payments.amount} - ${payments.feeAmount} else 0 end),0)`,
    })
    .from(payments)
    .where(and(eq(payments.storeId, scope.storeId), eq(payments.scope, "order")));
  return {
    items: rows.map(r => ({ ...r.p, orderNo: r.orderNo, net: fromP(toP(r.p.amount) - toP(r.p.feeAmount)), refunds: ((r.p.rawReference ?? {}) as { refunds?: { amount: string; reason: string; at: string }[] }).refunds ?? [] })),
    total: Number(total),
    summary: { gross: fromP(toP(sum.gross)), fees: fromP(toP(sum.fees)), net: fromP(toP(sum.gross) - toP(sum.fees)), settled: fromP(toP(sum.settled)), unsettled: fromP(toP(sum.unsettled)) },
  };
}

/* ───────── Reconciliation (ATLaS ledger vs provider ledger) ───────── */
export async function reconciliation(filter: { tenantId?: number; storeId?: number; from: Date; to: Date }) {
  const local = await db()
    .select()
    .from(payments)
    .where(and(gte(payments.createdAt, filter.from), lte(payments.createdAt, filter.to), filter.tenantId ? eq(payments.tenantId, filter.tenantId) : undefined, filter.storeId ? eq(payments.storeId, filter.storeId) : undefined))
    .orderBy(desc(payments.id))
    .limit(1000);
  const refs = local.map(l => l.reference);
  const provider = refs.length ? await db().select().from(sandboxGatewayTransactions).where(inArray(sandboxGatewayTransactions.reference, refs)) : [];
  const map = new Map(provider.map(p => [p.reference, p]));
  const expected: Record<string, string[]> = {
    succeeded: ["succeeded"],
    refunded: ["refunded", "succeeded"],
    failed: ["failed"],
    cancelled: ["cancelled", "pending"],
    pending: ["pending"],
    initiated: ["pending"],
    expired: ["pending", "cancelled", "failed"],
  };
  const rows = local.map(l => {
    const prov = map.get(l.reference);
    let result: "matched" | "status_mismatch" | "amount_mismatch" | "missing_at_provider" = "matched";
    if (!prov) result = "missing_at_provider";
    else if (toP(prov.amount) !== toP(l.amount)) result = "amount_mismatch";
    else if (!expected[l.status]?.includes(prov.status)) result = "status_mismatch";
    return { reference: l.reference, scope: l.scope, provider: l.provider, amount: l.amount, fee: l.feeAmount, localStatus: l.status, providerStatus: prov?.status ?? null, providerTxnId: prov?.providerTxnId ?? null, settlement: l.settlementStatus, createdAt: l.createdAt, result };
  });
  const ok = rows.filter(r => r.result === "matched").length;
  return { rows, totals: { count: rows.length, matched: ok, exceptions: rows.length - ok } };
}

/** Repairs a status mismatch by re-querying the provider (used from reconciliation exceptions). */
export async function resyncPayment(reference: string) {
  const [p] = await db().select().from(payments).where(eq(payments.reference, reference)).limit(1);
  if (!p || !isOnline(p.provider)) fail("NOT_FOUND", "Payment not found");
  const q = await GATEWAYS[p.provider].query(reference);
  if (!q) fail("NOT_FOUND", "Provider has no record of this payment");
  return applyProviderStatus(reference, q.status, q.providerTxnId, q.amount, "reconcile");
}

export async function runSettlement(minAgeMs = SETTLEMENT_DELAY_MS) {
  const cutoff = new Date(Date.now() - minAgeMs);
  const n = affected(
    await db()
      .update(payments)
      .set({ settlementStatus: "settled", settledAt: new Date() })
      .where(and(eq(payments.scope, "order"), eq(payments.status, "succeeded"), eq(payments.settlementStatus, "unsettled"), lte(payments.createdAt, cutoff)))
  );
  return { settled: n };
}

export async function webhookMonitor(q: { provider?: string; status?: string; limit: number }) {
  return db()
    .select()
    .from(paymentWebhookEvents)
    .where(and(q.provider ? eq(paymentWebhookEvents.provider, q.provider) : undefined, q.status ? eq(paymentWebhookEvents.status, q.status as (typeof paymentWebhookEvents.$inferSelect)["status"]) : undefined))
    .orderBy(desc(paymentWebhookEvents.id))
    .limit(q.limit);
}

/** Super Admin tester: replays a stored event (idempotency) or sends a forged one (signature check). */
export async function adminWebhookTest(kind: "replay" | "forged", eventId?: number) {
  if (kind === "replay") {
    const [e] = eventId ? await db().select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.id, eventId)).limit(1) : await db().select().from(paymentWebhookEvents).where(eq(paymentWebhookEvents.status, "processed")).orderBy(desc(paymentWebhookEvents.id)).limit(1);
    if (!e?.payloadJson) fail("NOT_FOUND", "No processed webhook to replay");
    const raw = JSON.stringify(e.payloadJson);
    return handleGatewayWebhook(e.provider, raw, signWebhook(e.provider, raw));
  }
  const [p] = await db().select().from(payments).where(inArray(payments.status, ["pending", "initiated"])).orderBy(desc(payments.id)).limit(1);
  const raw = JSON.stringify({ eventId: `evt_forged_${randomId(8)}`, reference: p?.reference ?? "ATLUNKNOWN", status: "succeeded", amount: p?.amount ?? "1.00", providerTxnId: "FORGED" });
  return handleGatewayWebhook(p?.provider && isOnline(p.provider) ? p.provider : "bkash", raw, "invalid-signature");
}

/* ───────── Background: expiry and settlement ───────── */
every("expire-payments", 60_000, async () => {
  const now = new Date();
  const stale = await db()
    .select()
    .from(payments)
    .where(and(inArray(payments.status, ["initiated", "pending"]), lte(payments.expiresAt, now)))
    .limit(100);
  for (const p of stale) {
    const changed = affected(await db().update(payments).set({ status: "expired", failureReason: "Customer did not complete payment in 15 minutes" }).where(and(eq(payments.id, p.id), inArray(payments.status, ["initiated", "pending"]))));
    if (changed && p.orderId) {
      await db().update(orders).set({ paymentStatus: "failed" }).where(and(eq(orders.id, p.orderId), eq(orders.paymentStatus, "pending")));
      await orderEvent(p.orderId, "system", `Payment ${p.reference} expired — customer can retry`);
    }
  }
});
every("settle-payments", 10 * 60_000, async () => {
  await runSettlement();
});

export async function trackCheckoutStarted(storeId: number, tenantId: number) {
  await track("checkout_started", { tenantId, storeId });
}
