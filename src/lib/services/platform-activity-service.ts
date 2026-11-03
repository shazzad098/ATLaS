import { prisma } from "@/lib/db";
import { formatBdt } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatusValue } from "@/lib/order-state";

/**
 * Platform activity feed for Super Admin notifications.
 *
 * The AuditLog is the single source of truth: every merchant update, platform
 * change and privileged action already writes a row there. This service turns
 * those rows into human-readable, tenant-aware notification items with enough
 * detail to understand the change without opening the audit table.
 */

export type PlatformActivityTone =
  | "order"
  | "catalog"
  | "store"
  | "staff"
  | "theme"
  | "billing"
  | "support"
  | "security"
  | "neutral";

export type PlatformActivityItem = {
  id: string;
  action: string;
  title: string;
  detail: string;
  category: string;
  tone: PlatformActivityTone;
  actorName: string;
  actorPhone: string | null;
  tenantName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  href: string | null;
  createdAt: string;
};

export type PlatformActivitySnapshot = {
  items: PlatformActivityItem[];
  unread: number;
  latestAt: string | null;
  serverTime: string;
};

const ACTION_META: Record<string, { title: string; category: string; tone: PlatformActivityTone }> = {
  "order.created": { title: "নতুন অর্ডার এসেছে", category: "অর্ডার", tone: "order" },
  "order.status_changed": { title: "অর্ডার স্ট্যাটাস পরিবর্তন", category: "অর্ডার", tone: "order" },
  "order.return_requested": { title: "রিটার্ন অনুরোধ", category: "অর্ডার", tone: "order" },
  "payment.cod_collected": { title: "COD পেমেন্ট সংগ্রহ", category: "পেমেন্ট", tone: "order" },
  "payment.refunded": { title: "রিফান্ড সম্পন্ন", category: "পেমেন্ট", tone: "order" },
  "product.created": { title: "নতুন পণ্য যোগ হয়েছে", category: "ক্যাটালগ", tone: "catalog" },
  "product.updated": { title: "পণ্য আপডেট হয়েছে", category: "ক্যাটালগ", tone: "catalog" },
  "product.archived": { title: "পণ্য archive হয়েছে", category: "ক্যাটালগ", tone: "catalog" },
  "product.discount_applied": { title: "পণ্যে ডিসকাউন্ট", category: "ক্যাটালগ", tone: "catalog" },
  "product.discount_removed": { title: "পণ্যের ডিসকাউন্ট সরানো", category: "ক্যাটালগ", tone: "catalog" },
  "category.created": { title: "নতুন ক্যাটাগরি", category: "ক্যাটালগ", tone: "catalog" },
  "inventory.adjusted": { title: "স্টক সমন্বয়", category: "ইনভেন্টরি", tone: "catalog" },
  "store.created": { title: "নতুন স্টোর তৈরি", category: "স্টোর", tone: "store" },
  "store.published": { title: "স্টোর প্রকাশিত হয়েছে", category: "স্টোর", tone: "store" },
  "store.unpublished": { title: "স্টোর unpublish হয়েছে", category: "স্টোর", tone: "store" },
  "store.settings_updated": { title: "স্টোর সেটিংস আপডেট", category: "স্টোর", tone: "store" },
  "store.archived": { title: "স্টোর archive হয়েছে", category: "স্টোর", tone: "store" },
  "staff.invited": { title: "নতুন টিম সদস্য", category: "টিম", tone: "staff" },
  "staff.removed": { title: "টিম সদস্য সরানো", category: "টিম", tone: "staff" },
  "staff.role_changed": { title: "সদস্যের role পরিবর্তন", category: "টিম", tone: "staff" },
  "staff.role_created": { title: "নতুন কাস্টম role", category: "টিম", tone: "staff" },
  "staff.role_updated": { title: "role আপডেট", category: "টিম", tone: "staff" },
  "staff.role_deleted": { title: "role ডিলিট", category: "টিম", tone: "staff" },
  "theme.selected": { title: "থিম নির্বাচন", category: "থিম", tone: "theme" },
  "theme.draft_saved": { title: "থিম draft সেভ", category: "থিম", tone: "theme" },
  "theme.published": { title: "থিম প্রকাশিত", category: "থিম", tone: "theme" },
  "subscription.plan_changed": { title: "প্ল্যান পরিবর্তন", category: "বিলিং", tone: "billing" },
  "subscription.trial_started": { title: "ট্রায়াল শুরু", category: "বিলিং", tone: "billing" },
  "subscription.cancelled": { title: "সাবস্ক্রিপশন বাতিল", category: "বিলিং", tone: "billing" },
  "invoice.paid": { title: "ইনভয়েস পরিশোধিত", category: "বিলিং", tone: "billing" },
  "support.ticket_created": { title: "নতুন সাপোর্ট টিকেট", category: "সাপোর্ট", tone: "support" },
  "support.ticket_closed": { title: "সাপোর্ট টিকেট বন্ধ", category: "সাপোর্ট", tone: "support" },
  "domain.added": { title: "নতুন ডোমেইন", category: "ডোমেইন", tone: "store" },
  "domain.verified": { title: "ডোমেইন যাচাই সম্পন্ন", category: "ডোমেইন", tone: "store" },
  "domain.removed": { title: "ডোমেইন সরানো", category: "ডোমেইন", tone: "store" },
  "platform.tenant_created": { title: "প্ল্যাটফর্ম থেকে টেন্যান্ট তৈরি", category: "প্ল্যাটফর্ম", tone: "security" },
  "platform.tenant_status_changed": { title: "টেন্যান্ট স্ট্যাটাস পরিবর্তন", category: "প্ল্যাটফর্ম", tone: "security" },
  "platform.theme_status_changed": { title: "থিম ক্যাটালগ স্ট্যাটাস", category: "প্ল্যাটফর্ম", tone: "theme" },
  "platform.theme_catalog_synced": { title: "থিম ক্যাটালগ সিঙ্ক", category: "প্ল্যাটফর্ম", tone: "theme" },
  "super_admin.impersonation.start": { title: "ইম্পারসোনেশন শুরু", category: "সিকিউরিটি", tone: "security" },
  "super_admin.impersonation.end": { title: "ইম্পারসোনেশন শেষ", category: "সিকিউরিটি", tone: "security" },
  "auth.login_succeeded": { title: "সফল লগইন", category: "সিকিউরিটি", tone: "security" },
  "auth.login_failed": { title: "ব্যর্থ লগইন প্রচেষ্টা", category: "সিকিউরিটি", tone: "security" },
  "auth.login_otp": { title: "OTP দিয়ে লগইন", category: "সিকিউরিটি", tone: "security" },
  "auth.login": { title: "লগইন", category: "সিকিউরিটি", tone: "security" },
};

const PREFIX_META: Array<{
  prefix: string;
  category: string;
  tone: PlatformActivityTone;
}> = [
  { prefix: "order.", category: "অর্ডার", tone: "order" },
  { prefix: "payment.", category: "পেমেন্ট", tone: "order" },
  { prefix: "product.", category: "ক্যাটালগ", tone: "catalog" },
  { prefix: "category.", category: "ক্যাটালগ", tone: "catalog" },
  { prefix: "store.", category: "স্টোর", tone: "store" },
  { prefix: "staff.", category: "টিম", tone: "staff" },
  { prefix: "theme.", category: "থিম", tone: "theme" },
  { prefix: "subscription.", category: "বিলিং", tone: "billing" },
  { prefix: "invoice.", category: "বিলিং", tone: "billing" },
  { prefix: "support.", category: "সাপোর্ট", tone: "support" },
  { prefix: "domain.", category: "ডোমেইন", tone: "store" },
  { prefix: "platform.", category: "প্ল্যাটফর্ম", tone: "security" },
  { prefix: "super_admin.", category: "সিকিউরিটি", tone: "security" },
  { prefix: "account.", category: "অ্যাকাউন্ট", tone: "neutral" },
  { prefix: "auth.", category: "অ্যাকাউন্ট", tone: "neutral" },
];

const DETAIL_KEYS: Record<string, string> = {
  name: "নাম",
  title: "শিরোনাম",
  subject: "বিষয়",
  code: "কোড",
  themeCode: "থিম",
  planCode: "প্ল্যান",
  status: "স্ট্যাটাস",
  from: "আগে",
  to: "এখন",
  note: "নোট",
  reason: "কারণ",
  reference: "রেফারেন্স",
  percent: "ছাড়",
  variants: "ভ্যারিয়েন্ট",
  role: "role",
  roleCode: "role",
  channel: "চ্যানেল",
  amount: "পরিমাণ",
  total: "মোট",
  orderNo: "অর্ডার",
  provider: "প্রোভাইডার",
  paymentProvider: "পেমেন্ট",
  itemCount: "আইটেম",
  customerName: "ক্রেতা",
  storeName: "স্টোর",
  host: "হোস্ট",
  statusFrom: "আগের স্ট্যাটাস",
  statusTo: "নতুন স্ট্যাটাস",
  method: "মাধ্যম",
  via: "মাধ্যম",
  twoFactor: "2FA",
};

function metaString(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function valueLabel(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function orderStatusLabel(value: unknown): string | null {
  const raw = valueLabel(value);
  if (!raw) return null;
  return ORDER_STATUS_LABELS[raw as OrderStatusValue] ?? raw;
}

function push(bits: string[], label: string, value: unknown): void {
  const text = valueLabel(value);
  if (text) bits.push(`${label}: ${text}`);
}

function detailFor(
  action: string,
  metadata: Record<string, unknown>,
  tenantName: string | null,
  actorName: string,
): string {
  const bits: string[] = [];

  switch (action) {
    case "order.created": {
      push(bits, "অর্ডার", metadata.orderNo);
      if (metadata.total) {
        try {
          bits.push(`মোট: ${formatBdt(String(metadata.total))}`);
        } catch {
          push(bits, "মোট", metadata.total);
        }
      }
      push(bits, "পেমেন্ট", metadata.paymentProvider);
      push(bits, "আইটেম", metadata.itemCount);
      push(bits, "ক্রেতা", metadata.customerName);
      push(bits, "স্টোর", metadata.storeName);
      break;
    }
    case "order.status_changed": {
      const from = orderStatusLabel(metadata.from);
      const to = orderStatusLabel(metadata.to);
      if (from || to) bits.push(`স্ট্যাটাস: ${from ?? "—"} → ${to ?? "—"}`);
      push(bits, "নোট", metadata.note);
      break;
    }
    case "order.return_requested":
      push(bits, "কারণ", metadata.reason);
      break;
    case "payment.cod_collected":
      push(bits, "পরিমাণ", metadata.amount ?? metadata.total);
      break;
    case "payment.refunded":
      push(bits, "পরিমাণ", metadata.amount ?? metadata.total);
      push(bits, "কারণ", metadata.reason);
      break;
    case "product.created":
    case "product.updated":
    case "product.archived":
    case "product.discount_applied":
    case "product.discount_removed":
      push(bits, "পণ্য", metadata.name);
      push(bits, "ডিসকাউন্ট", metadata.percent ? `${metadata.percent}%` : null);
      push(bits, "ভ্যারিয়েন্ট", metadata.variants);
      break;
    case "staff.invited":
      push(bits, "সদস্য", metadata.phone);
      push(bits, "role", metadata.roleCode);
      break;
    case "staff.removed":
      push(bits, "role", metadata.roleCode ?? metadata.role);
      break;
    case "inventory.adjusted": {
      const delta = Number(metadata.delta);
      if (Number.isFinite(delta)) {
        bits.push(`পরিবর্তন: ${delta > 0 ? "+" : ""}${delta}`);
      }
      push(bits, "কারণ", metadata.reason);
      push(bits, "বর্তমান স্টক", metadata.stockQty);
      break;
    }
    case "staff.role_changed":
      if (metadata.from || metadata.to) bits.push(`role: ${valueLabel(metadata.from) ?? "—"} → ${valueLabel(metadata.to) ?? "—"}`);
      break;
    case "staff.role_created":
    case "staff.role_updated":
      push(bits, "role", metadata.name ?? metadata.code);
      if (Array.isArray(metadata.permissions)) {
        bits.push(`অনুমতি: ${metadata.permissions.length}টি`);
      }
      break;
    case "staff.role_deleted":
      push(bits, "role", metadata.name ?? metadata.code);
      break;
    case "theme.selected":
      bits.push(`থিম: ${valueLabel(metadata.from) ?? "—"} → ${valueLabel(metadata.to) ?? "—"}`);
      if (metadata.draftOnly === true) bits.push("শুধু draft-এ সেভ হয়েছে");
      break;
    case "theme.draft_saved":
    case "theme.published":
      push(bits, "থিম", metadata.themeCode);
      break;
    case "platform.tenant_created":
      push(bits, "টেন্যান্ট", metadata.tenantName);
      push(bits, "মালিক", metadata.ownerPhone);
      push(bits, "প্ল্যান", metadata.planCode);
      break;
    case "platform.tenant_status_changed":
    case "platform.theme_status_changed":
      bits.push(`স্ট্যাটাস: ${valueLabel(metadata.from) ?? "—"} → ${valueLabel(metadata.to) ?? "—"}`);
      push(bits, "কোড", metadata.code);
      break;
    case "support.ticket_created":
    case "support.ticket_closed":
    case "platform.ticket_updated":
      push(bits, "বিষয়", metadata.subject);
      push(bits, "স্ট্যাটাস", metadata.status);
      break;
    case "subscription.plan_changed":
    case "subscription.trial_started":
    case "subscription.cancelled":
      push(bits, "প্ল্যান", metadata.planCode ?? metadata.to);
      break;
    case "invoice.paid":
      push(bits, "ইনভয়েস", metadata.invoiceNo);
      push(bits, "পরিমাণ", metadata.amount ?? metadata.total);
      break;
    default: {
      // Every action still gets useful detail: show the non-empty primitive
      // metadata fields with readable labels.
      for (const [key, value] of Object.entries(metadata)) {
        if (key === "storeId" || key === "tenantId" || key === "userId" || key === "actorId") continue;
        push(bits, DETAIL_KEYS[key] ?? key, value);
        if (bits.length >= 4) break;
      }
    }
  }

  if (bits.length === 0) {
    bits.push(tenantName ? `টেন্যান্ট: ${tenantName}` : actorName ? `অ্যাক্টর: ${actorName}` : "বিস্তারিত metadata নেই");
  }
  return bits.join(" · ");
}

function actionMeta(action: string): { title: string; category: string; tone: PlatformActivityTone } {
  const exact = ACTION_META[action];
  if (exact) return exact;
  const prefix = PREFIX_META.find((entry) => action.startsWith(entry.prefix));
  return {
    title: action.replace(/[._]/g, " "),
    category: prefix?.category ?? "অন্যান্য",
    tone: prefix?.tone ?? "neutral",
  };
}

function hrefFor(action: string, metadata: Record<string, unknown>, tenantId: string | null): string {
  if (action.startsWith("platform.theme_") || action.startsWith("theme.")) {
    const code = valueLabel(metadata.code) ?? valueLabel(metadata.themeCode);
    if (code) return `/super-admin/themes/${encodeURIComponent(code)}`;
  }
  if (action.startsWith("platform.tenant_") || action.startsWith("super_admin.") || action.startsWith("store.")) {
    return tenantId ? `/super-admin/tenants?tenantId=${encodeURIComponent(tenantId)}` : "/super-admin/tenants";
  }
  if (action.startsWith("support.")) return "/super-admin/tickets";
  if (action.startsWith("subscription.") || action.startsWith("invoice.")) return "/super-admin/billing";

  const params = new URLSearchParams({ action });
  if (tenantId) params.set("tenantId", tenantId);
  return `/super-admin/audit?${params.toString()}`;
}

type AuditRow = {
  id: string;
  action: string;
  tenantId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  metadataJson: unknown;
  createdAt: Date;
  actor: { name: string | null; phone: string } | null;
  tenant: { name: string } | null;
};

function serialize(row: AuditRow): PlatformActivityItem {
  const metadata = metaString(row.metadataJson);
  const meta = actionMeta(row.action);
  const actorName = row.actor?.name ?? row.actor?.phone ?? "সিস্টেম";

  return {
    id: row.id,
    action: row.action,
    title: meta.title,
    detail: detailFor(row.action, metadata, row.tenant?.name ?? null, actorName),
    category: meta.category,
    tone: meta.tone,
    actorName,
    actorPhone: row.actor?.phone ?? null,
    tenantName: row.tenant?.name ?? null,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    href: hrefFor(row.action, metadata, row.tenantId),
    createdAt: row.createdAt.toISOString(),
  };
}

const AUDIT_INCLUDE = {
  actor: { select: { name: true, phone: true } },
  tenant: { select: { name: true } },
} as const;

export async function listPlatformActivity(options: {
  limit?: number;
  since?: Date | null;
} = {}): Promise<PlatformActivityItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 200);
  const rows = await prisma.auditLog.findMany({
    where: options.since ? { createdAt: { gt: options.since } } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: AUDIT_INCLUDE,
  });
  return rows.map(serialize);
}

export async function platformActivitySnapshot(options: {
  limit?: number;
  since?: Date | null;
} = {}): Promise<PlatformActivitySnapshot> {
  const since = options.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 200);

  const [rows, unread, latest] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: AUDIT_INCLUDE,
    }),
    prisma.auditLog.count({ where: { createdAt: { gt: since } } }),
    prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    items: rows.map(serialize),
    unread,
    latestAt: latest?.createdAt.toISOString() ?? null,
    serverTime: new Date().toISOString(),
  };
}
