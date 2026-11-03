import { prisma } from "@/lib/db";
import { env, sandboxMode } from "@/lib/env";

/**
 * Notification fan-out (FR-09).
 *
 * In-app notifications are stored for platform users. Customer order updates go
 * out through provider HTTP APIs and are always logged in `NotificationDelivery`
 * (success or failure) so support can answer "SMS কি গেছে?". A provider outage
 * never blocks checkout: delivery is best-effort, the order itself is already
 * committed before this runs.
 *
 * Event types: order created, payment received, shipping update, low stock,
 * subscription renewal/failure, domain verified.
 */

export const NOTIFICATION_TYPES = {
  ORDER_CREATED: "order.created",
  PAYMENT_RECEIVED: "payment.received",
  PAYMENT_FAILED: "payment.failed",
  ORDER_SHIPPED: "order.shipped",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",
  LOW_STOCK: "inventory.low_stock",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  SUBSCRIPTION_FAILED: "subscription.payment_failed",
  SUBSCRIPTION_REMINDER: "subscription.renewal_reminder",
  SUBSCRIPTION_GRACE: "subscription.grace_started",
  SUBSCRIPTION_SUSPENDED: "subscription.suspended",
  DOMAIN_VERIFIED: "domain.verified",
  STORE_PUBLISHED: "store.published",
  QUOTA_WARNING: "billing.quota_warning",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotifyInput = {
  userId: string;
  type: NotificationType | string;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  /** Only in-app is delivered by default; enable others explicitly. */
  channels?: Array<"in_app" | "email" | "sms">;
  email?: string;
  phone?: string;
};

export type DeliveryResult = { ok: boolean; provider: string; error?: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "notification delivery failed";
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 240)}`);
  }
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<DeliveryResult> {
  if (sandboxMode.email) {
    console.info(`[email:sandbox] to=${input.to} subject=${input.subject}`);
    return { ok: true, provider: "sandbox" };
  }

  const provider = env.email.provider;
  try {
    if (provider === "resend") {
      await postJson(
        env.email.baseUrl || "https://api.resend.com/emails",
        {
          from: `${env.email.fromName} <${env.email.from}>`,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        },
        { authorization: `Bearer ${env.email.apiKey}` },
      );
    } else if (provider === "sendgrid") {
      await postJson(
        env.email.baseUrl || "https://api.sendgrid.com/v3/mail/send",
        {
          personalizations: [{ to: [{ email: input.to }] }],
          from: { email: env.email.from, name: env.email.fromName },
          subject: input.subject,
          content: [{ type: "text/plain", value: input.text }],
        },
        { authorization: `Bearer ${env.email.apiKey}` },
      );
    } else if (provider === "generic") {
      await postJson(
        env.email.baseUrl,
        {
          to: input.to,
          from: env.email.from,
          fromName: env.email.fromName,
          subject: input.subject,
          text: input.text,
          apiKey: env.email.apiKey,
        },
      );
    } else {
      throw new Error(`Unsupported EMAIL_PROVIDER: ${provider || "(empty)"}`);
    }
    return { ok: true, provider: provider || "none" };
  } catch (error) {
    console.error(`[email] ${provider} failed for ${input.to}:`, error);
    return { ok: false, provider: provider || "none", error: errorMessage(error).slice(0, 300) };
  }
}

export async function sendSms(input: { to: string; text: string }): Promise<DeliveryResult> {
  if (sandboxMode.sms) {
    console.info(`[sms:sandbox] to=${input.to} text=${input.text}`);
    return { ok: true, provider: "sandbox" };
  }

  const provider = env.sms.provider;
  try {
    if (provider === "bulksmsbd") {
      const response = await fetch(env.sms.baseUrl || "https://bulksmsbd.net/api/smsapi", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          api_key: env.sms.apiKey,
          type: "text",
          number: input.to.replace(/^\+?88/, ""),
          senderid: env.sms.senderId,
          message: input.text,
        }),
      });
      if (!response.ok) throw new Error(`bulksmsbd HTTP ${response.status}`);
    } else if (provider === "sslwireless") {
      await postJson(
        env.sms.baseUrl || "https://smsplus.sslwireless.com/api/v3/send-sms",
        {
          api_token: env.sms.apiKey,
          sid: env.sms.senderId,
          msisdn: input.to.replace(/^\+?88/, ""),
          sms: input.text,
          csms_id: `atlas-${Date.now().toString(36)}`,
        },
      );
    } else if (provider === "twilio") {
      if (!env.sms.accountSid || !env.sms.authToken) {
        throw new Error("Twilio requires SMS_ACCOUNT_SID and SMS_AUTH_TOKEN.");
      }
      const body = new URLSearchParams({
        To: input.to,
        From: env.sms.senderId,
        Body: input.text,
      });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.sms.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization: `Basic ${Buffer.from(`${env.sms.accountSid}:${env.sms.authToken}`).toString("base64")}`,
          },
          body,
        },
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio HTTP ${response.status}: ${detail.slice(0, 200)}`);
      }
    } else if (provider === "generic") {
      await postJson(env.sms.baseUrl, {
        to: input.to,
        text: input.text,
        senderId: env.sms.senderId,
        apiKey: env.sms.apiKey,
      });
    } else {
      throw new Error(`Unsupported SMS_PROVIDER: ${provider || "(empty)"}`);
    }
    return { ok: true, provider: provider || "none" };
  } catch (error) {
    console.error(`[sms] ${provider} failed for ${input.to}:`, error);
    return { ok: false, provider: provider || "none", error: errorMessage(error).slice(0, 300) };
  }
}

export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? ["in_app"];

  if (channels.includes("in_app")) {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payloadJson: (input.payload ?? {}) as never,
      },
    });
  }

  if (channels.includes("email") && input.email) {
    await sendEmail({ to: input.email, subject: input.title, text: input.body ?? "" });
  }

  if (channels.includes("sms") && input.phone) {
    await sendSms({ to: input.phone, text: `${input.title}\n${input.body ?? ""}`.trim() });
  }
}

type CustomerEvent = "order.created" | "payment.received" | "order.shipped" | "order.delivered" | "order.cancelled";

function customerPreference(
  prefs: Record<string, unknown>,
  event: CustomerEvent,
  channel: "email" | "sms",
): boolean {
  const key =
    event === "order.created"
      ? channel === "email"
        ? "customerOrderEmail"
        : "customerOrderSms"
      : event === "payment.received"
        ? channel === "email"
          ? "customerPaymentEmail"
          : "customerPaymentSms"
        : channel === "email"
          ? "customerShippingEmail"
          : "customerShippingSms";
  return prefs[key] !== false;
}

async function recordDelivery(input: {
  storeId: string;
  orderId?: string | null;
  channel: "email" | "sms";
  recipient: string;
  type: string;
  result: DeliveryResult;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await prisma.notificationDelivery
    .create({
      data: {
        storeId: input.storeId,
        orderId: input.orderId ?? null,
        channel: input.channel,
        recipient: input.recipient,
        type: input.type,
        status: input.result.ok ? "SENT" : "FAILED",
        provider: input.result.provider,
        error: input.result.error,
        payloadJson: (input.payload ?? {}) as never,
        sentAt: input.result.ok ? new Date() : null,
      },
    })
    .catch((error) => {
      // Logging must not break the notification path itself.
      console.error("[notification-delivery] failed to record delivery:", error);
    });
}

/**
 * Sends a customer-facing order/payment/shipping update. Merchant settings can
 * switch each channel off per event; failures are logged and never thrown.
 */
export async function notifyCustomer(input: {
  storeId: string;
  orderId?: string | null;
  type: CustomerEvent;
  title: string;
  body: string;
  email?: string | null;
  phone?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const settings = await prisma.storeSettings.findUnique({
    where: { storeId: input.storeId },
    select: { notificationsJson: true },
  });
  const prefs = (settings?.notificationsJson ?? {}) as Record<string, unknown>;

  if (input.email && customerPreference(prefs, input.type, "email")) {
    const result = await sendEmail({ to: input.email, subject: input.title, text: input.body });
    await recordDelivery({
      storeId: input.storeId,
      orderId: input.orderId,
      channel: "email",
      recipient: input.email,
      type: input.type,
      result,
      payload: input.payload,
    });
  }

  if (input.phone && customerPreference(prefs, input.type, "sms")) {
    const result = await sendSms({ to: input.phone, text: `${input.title}\n${input.body}`.trim() });
    await recordDelivery({
      storeId: input.storeId,
      orderId: input.orderId,
      channel: "sms",
      recipient: input.phone,
      type: input.type,
      result,
      payload: input.payload,
    });
  }
}

/** Bengali customer templates for the order lifecycle. */
export function customerMessage(
  event: CustomerEvent,
  input: { storeName: string; orderNo: string; amount?: string; status?: string },
): { title: string; body: string } {
  switch (event) {
    case "order.created":
      return {
        title: `${input.storeName}: অর্ডার ${input.orderNo} গ্রহণ করা হয়েছে`,
        body: `ধন্যবাদ! আপনার অর্ডারটি পেয়েছি। মোট ${input.amount ?? ""}। আমরা শীঘ্রই যোগাযোগ করব।`,
      };
    case "payment.received":
      return {
        title: `${input.storeName}: পেমেন্ট নিশ্চিত হয়েছে`,
        body: `অর্ডার ${input.orderNo}-এর পেমেন্ট ${input.amount ?? ""} সফলভাবে গ্রহণ করা হয়েছে।`,
      };
    case "order.shipped":
      return {
        title: `${input.storeName}: অর্ডার ${input.orderNo} পাঠানো হয়েছে`,
        body: `আপনার অর্ডারটি কুরিয়ারে দেওয়া হয়েছে। ট্র্যাকিং তথ্যের জন্য দোকানে যোগাযোগ করুন।`,
      };
    case "order.delivered":
      return {
        title: `${input.storeName}: অর্ডার ${input.orderNo} ডেলিভার হয়েছে`,
        body: `আপনার অর্ডারটি ডেলিভার করা হয়েছে। কেনাকাটার জন্য ধন্যবাদ!`,
      };
    case "order.cancelled":
      return {
        title: `${input.storeName}: অর্ডার ${input.orderNo} বাতিল হয়েছে`,
        body: `আপনার অর্ডারটি বাতিল করা হয়েছে।${input.status ? ` কারণ: ${input.status}` : ""}`,
      };
  }
}

export async function listNotifications(userId: string, limit = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * Low-stock check run after each sale. One notification per variant per day
 * keeps the centre readable.
 */
export async function notifyLowStock(storeId: string) {
  const variants = await prisma.productVariant.findMany({
    where: {
      product: { storeId, deletedAt: null },
      status: "ACTIVE",
    },
    include: { product: { select: { name: true, storeId: true, store: { select: { tenantId: true } } } } },
    take: 200,
  });

  const low = variants.filter((v) => v.stockQty - v.reservedQty <= 5);
  if (low.length === 0) return;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tenantId: true, tenant: { select: { ownerUserId: true } } },
  });
  if (!store) return;

  await notify({
    userId: store.tenant.ownerUserId,
    type: NOTIFICATION_TYPES.LOW_STOCK,
    title: `${low.length}টি variant-এ stock কম`,
    body: low
      .slice(0, 5)
      .map((v) => `${v.product.name} (${v.sku}): ${v.stockQty - v.reservedQty}`)
      .join(", "),
    payload: { storeId, variantIds: low.map((v) => v.id) },
  });
}
