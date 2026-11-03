import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import {
  PLATFORM_TIMEZONE,
  addDays,
  bnDayLabel,
  bnNumber,
  daysRemaining,
  dhakaDateKey,
  formatDate,
  monthBounds,
} from "@/lib/dates";
import { addMoney, formatBdt, subtractMoney } from "@/lib/money";
import { publishReadiness, listStores } from "@/lib/services/store-service";
import {
  countsByStatus,
  orderMetrics,
  recentOrders,
  ORDER_STATUS_LABELS,
} from "@/lib/services/order-service";
import { feeSummary } from "@/lib/services/fee-service";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { Badge, Card, CardBody, CardHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { publishStoreAction, unpublishStoreAction } from "@/app/admin/actions";
import { storePath } from "@/lib/storefront";

/**
 * Merchant dashboard (FR-10), redesigned:
 * setup checklist → KPIs → order volume / hourly web orders →
 * provider & campaign breakdowns → plan usage.
 *
 * All derived series use real ledger/activity data: "কুরিয়ারে পাঠানো" counts
 * SHIPPED transitions (the platform has no courier integration yet), and
 * "মার্কেটিং চ্যানেল" is the coupon-campaign distribution.
 */

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
  RETURNED: "neutral",
};

/** Statuses that count as successful sales (mirrors order-service + fee ledger). */
const REVENUE_STATUSES = ["PAID", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  COD: "ওয়েব চেকআউট · COD",
  BKASH: "ওয়েব চেকআউট · বিকাশ",
  NAGAD: "ওয়েব চেকআউট · নগদ",
  SSLCOMMERZ: "ওয়েব চেকআউট · SSLCOMMERZ",
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  TRIALING: "ট্রায়াল",
  ACTIVE: "সক্রিয়",
  PAST_DUE: "পেমেন্ট বাকি",
  READ_ONLY: "Read-only",
  SUSPENDED: "স্থগিত",
  CANCELLED: "বাতিল",
};

const HOURLY_MODES = [
  { value: "combined", label: "মিলিত (আজ + গতকাল)" },
  { value: "today", label: "আজ" },
  { value: "yesterday", label: "গতকাল" },
] as const;

type HourlyMode = (typeof HOURLY_MODES)[number]["value"];

const SETUP_DETAILS: Record<string, string> = {
  name: "সেটিংসে দোকানের নাম ও ঠিকানা যাচাই করুন।",
  theme: "নোকশি / বাজার / স্টুডিও — ব্র্যান্ডের লুক বেছে নিন।",
  products: "প্রাইস ও স্টক সহ পণ্য যোগ করুন।",
  delivery: "ডেলিভারি zone ও চার্জ ঠিক করুন।",
  payment: "COD বা বিকাশ/নগদ — অন্তত একটি মাধ্যম চালু করুন।",
  contact: "ক্রেতার যোগাযোগের ফোন নম্বর দিন।",
};

// ── Asia/Dhaka helpers (charts bucket by Dhaka-local day/hour) ───────────────

const dhakaHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIMEZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

function dhakaHour(value: Date): number {
  return Number(dhakaHourFormatter.format(value).replace(/[^0-9]/g, ""));
}

// ── Small chart building blocks (server-rendered, no JS) ─────────────────────

function HourlyBars({ counts }: { counts: number[] }) {
  const peak = Math.max(1, ...counts);
  return (
    <>
      <div className="flex h-32 items-end gap-[3px]">
        {counts.map((count, hour) => (
          <div
            key={hour}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${bnNumber(hour)}:00 — ${bnNumber(count)}টি অর্ডার`}
          >
            {count > 0 ? (
              <div
                className="rounded-t-sm bg-brand-500"
                style={{ height: `${Math.max(4, Math.round((count / peak) * 100))}%` }}
              />
            ) : (
              <div className="h-[2px] rounded-t-sm bg-ink-100" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-ink-400">
        {counts.map((_, hour) => (
          <span key={hour} className="flex-1 text-center">
            {hour % 3 === 0 ? bnNumber(hour) : ""}
          </span>
        ))}
      </div>
    </>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct =
    limit !== null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-ink-500">{label}</span>
        <span className="font-medium text-ink-900">
          {used.toLocaleString("en-US")}
          {limit !== null ? ` / ${limit.toLocaleString("en-US")}` : " · Unlimited"}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-brand-500"}`}
          style={{ width: `${Math.max(pct, used > 0 ? 4 : 0)}%` }}
        />
      </div>
    </li>
  );
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ hourly?: string }>;
}) {
  const { workspace, store } = await requireActiveStorePermissionPage("store:read");
  const tenantId = workspace.activeTenant.tenantId;
  const query = await searchParams;
  const hourlyMode: HourlyMode = HOURLY_MODES.some((mode) => mode.value === query.hourly)
    ? (query.hourly as HourlyMode)
    : "combined";

  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthBounds(now);
  const volumeFrom = addDays(now, -30);
  const todayKey = dhakaDateKey(now);
  const yesterdayKey = dhakaDateKey(addDays(now, -1));

  const [
    checks,
    metrics,
    counts,
    recent,
    fees,
    stores,
    lowStock,
    snapshot,
    monthFees,
    volumeOrders,
    shippedEvents,
    hourlyOrders,
    sourceRows,
    channelRows,
  ] = await Promise.all([
    publishReadiness(store.id),
    orderMetrics(store.id, { from: monthStart, to: monthEnd }),
    countsByStatus(store.id),
    recentOrders(store.id, 8),
    feeSummary(tenantId),
    listStores(tenantId),
    prisma.productVariant.findMany({
      where: { status: "ACTIVE", product: { storeId: store.id, deletedAt: null } },
      select: {
        id: true,
        sku: true,
        stockQty: true,
        reservedQty: true,
        product: { select: { name: true, slug: true, lowStockThreshold: true } },
      },
      take: 400,
    }),
    loadEntitlementSnapshot(tenantId),
    feeSummary(tenantId, { from: monthStart, to: monthEnd }),
    prisma.order.findMany({
      where: { storeId: store.id, deletedAt: null, placedAt: { gte: volumeFrom } },
      select: { placedAt: true },
    }),
    prisma.orderEvent.findMany({
      where: { toStatus: "SHIPPED", createdAt: { gte: volumeFrom }, order: { storeId: store.id } },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      where: { storeId: store.id, deletedAt: null, placedAt: { gte: addDays(now, -2) } },
      select: { placedAt: true },
    }),
    prisma.order.groupBy({
      by: ["paymentProvider"],
      where: { storeId: store.id, deletedAt: null, placedAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.order.groupBy({
      by: ["couponCode"],
      where: {
        storeId: store.id,
        deletedAt: null,
        placedAt: { gte: monthStart, lte: monthEnd },
        status: { in: [...REVENUE_STATUSES] },
      },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
  ]);

  // ── Derived figure rows ─────────────────────────────────────────────────────

  const ready = checks.filter((check) => check.ok).length;
  const allReady = ready === checks.length;
  const checkProgress = Math.round((ready / Math.max(1, checks.length)) * 100);

  const totalOrders = counts.reduce((sum, row) => sum + row._count._all, 0);

  const pendingOrders = counts
    .filter((row) => ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);

  const estimatedProfit = subtractMoney(
    metrics.revenue,
    addMoney(monthFees.pending, monthFees.invoiced),
  );

  const lowStockItems = lowStock
    .filter((variant) => variant.stockQty - variant.reservedQty <= variant.product.lowStockThreshold)
    .sort((a, b) => a.stockQty - a.reservedQty - (b.stockQty - b.reservedQty))
    .slice(0, 8);

  // ── Order volume (last 30 days: created vs shipped-to-courier) ──────────────

  const dayKeys = Array.from({ length: 30 }, (_, index) => dhakaDateKey(addDays(now, index - 29)));
  const createdCounts = new Map<string, number>();
  for (const order of volumeOrders) {
    const key = dhakaDateKey(order.placedAt);
    createdCounts.set(key, (createdCounts.get(key) ?? 0) + 1);
  }
  const sentCounts = new Map<string, number>();
  for (const event of shippedEvents) {
    const key = dhakaDateKey(event.createdAt);
    sentCounts.set(key, (sentCounts.get(key) ?? 0) + 1);
  }
  const volumePeak = Math.max(1, ...dayKeys.map((key) => createdCounts.get(key) ?? 0));

  // ── Hourly web orders (Dhaka-local today + yesterday) ───────────────────────

  const hourlyByDay = new Map<string, number[]>();
  for (const order of hourlyOrders) {
    const key = dhakaDateKey(order.placedAt);
    let buckets = hourlyByDay.get(key);
    if (!buckets) {
      buckets = new Array<number>(24).fill(0);
      hourlyByDay.set(key, buckets);
    }
    buckets[dhakaHour(order.placedAt)] += 1;
  }
  const todayBuckets = hourlyByDay.get(todayKey) ?? new Array<number>(24).fill(0);
  const yesterdayBuckets = hourlyByDay.get(yesterdayKey) ?? new Array<number>(24).fill(0);
  const combinedBuckets = new Array<number>(24).fill(0).map(
    (_, hour) => todayBuckets[hour] + yesterdayBuckets[hour],
  );
  const hourlyData =
    hourlyMode === "today" ? todayBuckets : hourlyMode === "yesterday" ? yesterdayBuckets : combinedBuckets;
  const hourlyTotal = hourlyData.reduce((sum, count) => sum + count, 0);

  // ── Source & channel breakdowns (this month) ────────────────────────────────

  const sources = sourceRows
    .filter((row) => row._count._all > 0)
    .sort((a, b) => b._count._all - a._count._all);
  const sourceTotal = sources.reduce((sum, row) => sum + row._count._all, 0);

  const channels = channelRows
    .filter((row) => row._count._all > 0)
    .sort((a, b) => b._count._all - a._count._all);
  const channelPeak = Math.max(1, ...channels.map((row) => row._count._all));

  const reportRows = counts
    .filter((row) => row._count._all > 0)
    .sort((a, b) => b._count._all - a._count._all);

  const subscriptionTone =
    snapshot.subscriptionStatus === "ACTIVE"
      ? "success"
      : snapshot.subscriptionStatus === "TRIALING"
        ? "info"
        : snapshot.suspended
          ? "danger"
          : "warning";

  const periodLeft = daysRemaining(snapshot.currentPeriodEnd);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{store.name}</h1>
          <p className="text-sm text-ink-500">
            {store.status === "PUBLISHED" ? (
              <>
                Live —{" "}
                <Link
                  href={storePath(store.slug)}
                  target="_blank"
                  className="font-medium text-brand-700 hover:underline"
                >
                  /store/{store.slug}
                </Link>
              </>
            ) : (
              "Draft — publish করলে ক্রেতারা দেখতে পাবেন।"
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {store.status === "PUBLISHED" ? (
            <Link
              href={storePath(store.slug)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              ওয়েবসাইট দেখুন
            </Link>
          ) : null}
          {store.status === "PUBLISHED" ? (
            <FormButton action={unpublishStoreAction} fields={{ storeId: store.id }} variant="outline">
              Unpublish
            </FormButton>
          ) : (
            <FormButton
              action={publishStoreAction}
              fields={{ storeId: store.id, slug: store.slug }}
              disabled={!allReady}
              title={allReady ? undefined : "চেকলিস্ট সম্পূর্ণ করুন"}
            >
              Publish করুন
            </FormButton>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="মোট অর্ডার" value={totalOrders} hint="সর্বমোট ওয়েব অর্ডার" />
        <Stat label="মোট বিক্রয়" value={formatBdt(metrics.revenue)} hint={`এই মাসে ${metrics.orderCount}টি অর্ডার`} />
        <Stat
          label="আনুমানিক লাভ"
          value={formatBdt(estimatedProfit)}
          hint="মোট বিক্রয় − প্ল্যাটফর্ম ফি"
          tone={estimatedProfit.startsWith("-") ? "warning" : undefined}
        />
        <Stat label="পেন্ডিং ওয়েব অর্ডার" value={pendingOrders} hint="প্রসেসিং-এ আছে" tone="warning" />
      </div>

      {/* Checklist + order volume */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="সেটআপ চেকলিস্ট"
            description={`${bnNumber(ready)} / ${bnNumber(checks.length)} ধাপ সম্পন্ন`}
            action={
              allReady ? (
                <Badge tone="success">প্রস্তুত</Badge>
              ) : (
                <Badge tone="warning">বাকি {bnNumber(checks.length - ready)}</Badge>
              )
            }
          />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${checkProgress}%` }} />
              </div>
              <span className="text-xs font-medium text-ink-500">{bnNumber(checkProgress)}%</span>
            </div>

            <ol className="space-y-2">
              {checks.map((check, index) => (
                <li
                  key={check.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2.5"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    {check.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink-100 text-[10px] font-semibold text-ink-600">
                        {bnNumber(index + 1)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className={`block text-sm ${check.ok ? "text-ink-500" : "font-medium text-ink-900"}`}>
                        {check.label}
                      </span>
                      {!check.ok ? (
                        <span className="block text-xs text-ink-400">{SETUP_DETAILS[check.key]}</span>
                      ) : null}
                    </span>
                  </span>
                  {!check.ok ? (
                    <Link
                      href={check.href}
                      className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      চালু করুন
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>

            <div className="rounded-lg border border-dashed border-ink-200 px-3 py-2.5">
              {store.status === "PUBLISHED" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> দোকান লাইভ আছে
                  </span>
                  <Link
                    href={storePath(store.slug)}
                    target="_blank"
                    className="text-xs font-semibold text-emerald-800 hover:underline"
                  >
                    স্টোরফ্রন্ট দেখুন
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm ${allReady ? "font-medium text-ink-900" : "text-ink-500"}`}>
                    {allReady ? "সব ধাপ শেষ — এবার publish" : "publish-এর আগে বাকি ধাপ শেষ করুন"}
                  </span>
                  <FormButton
                    action={publishStoreAction}
                    fields={{ storeId: store.id, slug: store.slug }}
                    disabled={!allReady}
                    title={allReady ? undefined : "চেকলিস্ট সম্পূর্ণ করুন"}
                  >
                    Publish করুন
                  </FormButton>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="অর্ডার ভলিউম"
            description="গত ৩০ দিন · তৈরি হয়েছে vs কুরিয়ারে পাঠানো (Asia/Dhaka)"
          />
          <CardBody>
            <div className="flex h-44 items-end gap-[3px]">
              {dayKeys.map((key) => {
                const created = createdCounts.get(key) ?? 0;
                const sent = Math.min(sentCounts.get(key) ?? 0, created);
                const createdPct = (created / volumePeak) * 100;
                const sentPct = (sent / volumePeak) * 100;
                return (
                  <div
                    key={key}
                    className="flex h-full flex-1 flex-col justify-end gap-px"
                    title={`${bnDayLabel(key)} — তৈরি ${bnNumber(created)} · কুরিয়ারে ${bnNumber(sent)}`}
                  >
                    {created === 0 ? (
                      <div className="h-[2px] rounded-sm bg-ink-100" />
                    ) : (
                      <>
                        {created > sent ? (
                          <div className="rounded-sm bg-brand-200" style={{ height: `${createdPct - sentPct}%` }} />
                        ) : null}
                        {sent > 0 ? <div className="rounded-sm bg-brand-600" style={{ height: `${sentPct}%` }} /> : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-[3px] text-[10px] text-ink-400">
              {dayKeys.map((key, index) => (
                <span key={key} className="flex-1 text-center">
                  {index % 7 === 0 ? bnDayLabel(key) : ""}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ink-100 pt-3 text-xs text-ink-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3 rounded-sm bg-brand-200" /> তৈরি হয়েছে
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3 rounded-sm bg-brand-600" /> কুরিয়ারে পাঠানো (Shipped)
              </span>
              <span className="ml-auto text-ink-400">শুরু {formatDate(volumeFrom)} — আজ</span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Hourly web orders + subscription */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="ঘণ্টাভিত্তিক ওয়েব অর্ডার"
            description="কোন সময়ে বেশি অর্ডার পড়ছে (Asia/Dhaka)"
            action={<Badge tone="neutral">{hourlyTotal}টি অর্ডার</Badge>}
          />
          <CardBody>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {HOURLY_MODES.map((mode) => (
                <Link
                  key={mode.value}
                  href={`/admin?hourly=${mode.value}`}
                  className={
                    hourlyMode === mode.value
                      ? "rounded-lg border border-brand-600 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
                      : "rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  }
                >
                  {mode.label}
                </Link>
              ))}
            </div>
            {hourlyTotal === 0 ? (
              <p className="text-sm text-ink-500">আজ ও গতকালে কোনো ওয়েব অর্ডার পড়েনি।</p>
            ) : (
              <HourlyBars counts={hourlyData} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="সাবস্ক্রিপশন ও প্ল্যান"
            description="চালু প্ল্যান, সীমা ও আপগ্রেড"
            action={
              <Link
                href="/admin/billing"
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Upgrade করুন
              </Link>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{snapshot.planName} প্ল্যান</Badge>
              <Badge tone={subscriptionTone}>
                {SUBSCRIPTION_STATUS_LABELS[snapshot.subscriptionStatus] ?? snapshot.subscriptionStatus}
              </Badge>
            </div>

            <p className="text-xs text-ink-500">
              {snapshot.subscriptionStatus === "TRIALING" && periodLeft !== null
                ? `ট্রায়াল শেষ হবে ${formatDate(snapshot.currentPeriodEnd)} — ${periodLeft} দিন বাকি।`
                : `চলতি পিরিয়ড ${formatDate(snapshot.currentPeriodStart)} – ${formatDate(snapshot.currentPeriodEnd)}।`}
            </p>

            <ul className="space-y-3">
              <UsageMeter
                label="পণ্য"
                used={snapshot.usage.products}
                limit={snapshot.limits.products}
              />
              <UsageMeter
                label="এই পিরিয়ডে অর্ডার"
                used={snapshot.usage.ordersThisPeriod}
                limit={snapshot.limits.monthlyOrders}
              />
              <UsageMeter
                label="স্টোরেজ (MB)"
                used={snapshot.usage.storageMb}
                limit={snapshot.limits.storageMb}
              />
            </ul>

            <div className="border-t border-ink-100 pt-3 text-xs text-ink-500">
              <p>
                সীমা ছাড়ালে প্রতি অর্ডারে ওভাররেজ ফি{" "}
                <span className="font-medium text-ink-900">{(snapshot.overageRate * 100).toFixed(2)}%</span> যোগ হয়।
              </p>
              <Link href="/admin/billing" className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                বিলিং বিস্তারিত <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Products, web order report, source & channels */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="সর্বাধিক বিক্রীত পণ্য"
            description="এই মাসে"
            action={
              <Link href="/admin/reports" className="text-xs font-semibold text-brand-700 hover:underline">
                রিপোর্ট
              </Link>
            }
          />
          {metrics.topProducts.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এই মাসে কোনো বিক্রি হয়নি।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>পণ্য</Th>
                  <Th className="text-right">পরিমাণ</Th>
                  <Th className="text-right">আয়</Th>
                </tr>
              </thead>
              <tbody>
                {metrics.topProducts.slice(0, 5).map((row) => (
                  <tr key={row.name}>
                    <Td className="max-w-[12rem] truncate font-medium">{row.name}</Td>
                    <Td className="text-right">{row.qty}</Td>
                    <Td className="text-right font-medium">{formatBdt(row.revenue)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="ওয়েব অর্ডার রিপোর্ট" description="স্ট্যাটাস অনুযায়ী সব সময়ের হিসাব" />
          {reportRows.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">কোনো অর্ডার নেই।</p>
            </CardBody>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>স্ট্যাটাস</Th>
                    <Th className="text-right">অর্ডার</Th>
                    <Th className="text-right">মূল্য</Th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row) => (
                    <tr key={row.status}>
                      <Td>
                        <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
                          {ORDER_STATUS_LABELS[row.status as keyof typeof ORDER_STATUS_LABELS] ?? row.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">{row._count._all}</Td>
                      <Td className="text-right font-medium">
                        {row._sum.grandTotal ? formatBdt(row._sum.grandTotal) : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <CardBody className="border-t border-ink-100 py-3">
                <Link
                  href="/admin/orders"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  সব অর্ডার দেখুন <ArrowRight className="h-3 w-3" />
                </Link>
              </CardBody>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="অর্ডারের উৎস" description="ওয়েব চেকআউট — পেমেন্ট মাধ্যম অনুযায়ী (এই মাস)" />
          {sources.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এই মাসে কোনো অর্ডার নেই।</p>
            </CardBody>
          ) : (
            <CardBody className="space-y-3">
              {sources.map((row) => (
                <div key={row.paymentProvider}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-ink-800">
                      {PROVIDER_LABELS[row.paymentProvider] ?? row.paymentProvider}
                    </span>
                    <span className="text-ink-500">
                      {row._count._all}টি · {row._sum.grandTotal ? formatBdt(row._sum.grandTotal) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${Math.max(4, Math.round((row._count._all / sourceTotal) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-ink-400">সব অর্ডার স্টোরফ্রন্টের ওয়েব চেকআউট থেকে আসে।</p>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader title="মার্কেটিং চ্যানেল অনুযায়ী বিক্রয়" description="কুপন ক্যাম্পেইন অনুযায়ী (এই মাস)" />
          {channels.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এই মাসে বিক্রি হয়নি।</p>
            </CardBody>
          ) : (
            <CardBody className="space-y-3">
              {channels.map((row) => (
                <div key={row.couponCode ?? "direct"}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-ink-800">
                      {row.couponCode ? `কুপন · ${row.couponCode}` : "ডাইরেক্ট / অর্গানিক"}
                    </span>
                    <span className="text-ink-500">
                      {row._count._all}টি · {row._sum.grandTotal ? formatBdt(row._sum.grandTotal) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(4, Math.round((row._count._all / channelPeak) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-ink-400">
                {`কুপন-ব্যবহার করা অর্ডার ক্যাম্পেইন চ্যানেল হিসেবে দেখানো হয়েছে; বাকি সব "ডাইরেক্ট"।`}
              </p>
            </CardBody>
          )}
        </Card>
      </div>

      {/* Recent orders + fees */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="সাম্প্রতিক অর্ডার"
            action={
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
              >
                সব দেখুন <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এখনো কোনো অর্ডার আসেনি। দোকান publish করে শেয়ার করুন।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>অর্ডার</Th>
                  <Th>ক্রেতা</Th>
                  <Th>স্ট্যাটাস</Th>
                  <Th className="text-right">মোট</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-brand-700 hover:underline">
                        {order.orderNo}
                      </Link>
                      <span className="block text-xs text-ink-400">{formatDate(order.placedAt)}</span>
                    </Td>
                    <Td>
                      {order.customerName}
                      <span className="block text-xs text-ink-400">{order.paymentProvider}</span>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                        {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium">{formatBdt(order.grandTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="ফি সারসংক্ষেপ" description="প্ল্যাটফর্ম চার্জ ও কুরিয়ার ফি" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-500">বকেয়া</p>
                <p className="font-semibold">{formatBdt(fees.pending)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">ইনভয়েসড</p>
                <p className="font-semibold">{formatBdt(fees.invoiced)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">ফেরত</p>
                <p className="font-semibold">{formatBdt(fees.reversed)}</p>
              </div>
            </div>

            {fees.byType.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {fees.byType.map((row) => (
                  <li key={row.feeType} className="flex justify-between">
                    <span className="text-ink-500">
                      {row.feeType} · {row.count}টি
                    </span>
                    <span className="font-medium">{formatBdt(row.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">এই মাসে কোনো ফি নেই।</p>
            )}

            <Link href="/admin/billing" className="inline-block text-xs font-semibold text-brand-700 hover:underline">
              বিলিং ও ইনভয়েস দেখুন →
            </Link>
          </CardBody>
        </Card>
      </div>

      {/* Low stock + stores */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="কম স্টক সতর্কতা"
            description="low-stock threshold-এর নিচে"
            action={
              lowStockItems.length > 0 ? (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" /> {lowStockItems.length}
                </Badge>
              ) : null
            }
          />
          {lowStockItems.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">সব পণ্যের স্টক পর্যাপ্ত আছে।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>পণ্য</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">উপলব্ধ</Th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((variant) => (
                  <tr key={variant.id}>
                    <Td>
                      <Link
                        href={`/admin/products?q=${encodeURIComponent(variant.product.name)}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {variant.product.name}
                      </Link>
                    </Td>
                    <Td className="text-xs text-ink-500">{variant.sku}</Td>
                    <Td className="text-right">
                      <Badge tone={variant.stockQty - variant.reservedQty <= 0 ? "danger" : "warning"}>
                        {variant.stockQty - variant.reservedQty}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {stores.length > 1 ? (
          <Card>
            <CardHeader title="আপনার দোকানসমূহ" description={`${stores.length}টি store`} />
            <CardBody className="space-y-2">
              {stores.map((item) => (
                <div key={item.id} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <Badge tone={item.status === "PUBLISHED" ? "success" : "warning"}>{item.status}</Badge>
                  </div>
                  <p className="text-xs text-ink-400">
                    /store/{item.slug} · {item._count.products} পণ্য · {item._count.orders} অর্ডার
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
