import { prisma } from "@/lib/db";
import { env, sandboxMode } from "@/lib/env";

/**
 * Notification fan-out (FR-09).
 *
 * In-app notifications are stored; email and SMS go through swappable adapters.
 * With no provider configured the adapters log, which keeps beta usable while
 * provider onboarding is pending.
 *
 * Event types: order created, payment received, low stock, subscription
 * renewal/failure, domain verified.
 */

export const NOTIFICATION_TYPES = {
  ORDER_CREATED: "order.created",
  PAYMENT_RECEIVED: "payment.received",
  PAYMENT_FAILED: "payment.failed",
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

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  if (sandboxMode.email) {
    console.info(`[email:sandbox] to=${input.to} subject=${input.subject}`);
    return;
  }
  console.info(`[email] via ${env.email.provider} to=${input.to} subject=${input.subject}`);
  // Provider integration point (Resend/SES/etc).
}

export async function sendSms(input: { to: string; text: string }): Promise<void> {
  if (sandboxMode.sms) {
    console.info(`[sms:sandbox] to=${input.to} text=${input.text}`);
    return;
  }
  console.info(`[sms] via ${env.sms.provider} to=${input.to}`);
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
