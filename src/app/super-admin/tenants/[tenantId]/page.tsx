import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  ExternalLink,
  HardDrive,
  LifeBuoy,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { tenantDetailForAdmin } from "@/lib/services/platform-service";
import { formatBdt } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ORDER_STATUS_LABELS } from "@/lib/services/order-service";
import type { OrderStatusValue } from "@/lib/services/order-service";
import { storePath } from "@/lib/storefront";
import { Badge, Card, CardBody, CardHeader, Meter, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { TenantStatusForm } from "@/app/super-admin/_components/tenant-status-form";

/** Full tenant dossier: owner, plan, usage, stores, orders, fees, tickets and audit (PRD §4.5). */

export const metadata = { title: "টেন্যান্ট বিস্তারিত" };

const PLAN_TONE: Record<string, "neutral" | "success" | "info" | "brand"> = {
  free: "neutral",
  basic: "success",
  standard: "info",
  pro: "brand",
};

const TENANT_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  READ_ONLY: "warning",
  SUSPENDED: "danger",
  CANCELLED: "neutral",
};

const TENANT_LABEL: Record<string, string> = {
  ACTIVE: "সক্রিয়",
  READ_ONLY: "Read-only",
  SUSPENDED: "স্থগিত",
  CANCELLED: "বাতিল",
};

const SUB_LABEL: Record<string, string> = {
  TRIALING: "ট্রায়াল",
  ACTIVE: "সক্রিয়",
  PAST_DUE: "বকেয়া",
  GRACE: "গ্রেস",
  READ_ONLY: "Read-only",
  SUSPENDED: "স্থগিত",
  CANCELLED: "বাতিল",
};

const ORDER_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "neutral",
  REFUNDED: "danger",
  RETURN_REQUESTED: "warning",
  RETURNED: "danger",
};

const FEATURE_LABELS: Array<[string, string]> = [
  ["publishStore", "Storefront publish"],
  ["discountCampaigns", "ডিসকাউন্ট ক্যাম্পেইন"],
  ["scheduledExport", "Scheduled export"],
  ["prioritySupport", "Priority support"],
  ["onboardingAssistance", "Onboarding সহায়তা"],
  ["thirdPartyCouriers", "Third-party courier"],
];

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium text-ink-500">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2.5 text-[22px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-2 text-[11px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

function storageLabel(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await tenantDetailForAdmin(tenantId);
  if (!detail) notFound();

  const { tenant, owner, subscription, limits, features, usage, memberships, stores } = detail;

  const totalGmv = stores.reduce((sum, store) => sum + Number(store.gmv), 0);
  const totalOrders = stores.reduce((sum, store) => sum + store.orderCount, 0);
  const pendingFees = detail.fees.summary.find((row) => row.status === "PENDING")?.amount ?? "0.00";
  const publishedStore = stores.find((store) => store.status === "PUBLISHED");
  const activeFeatures = FEATURE_LABELS.filter(
    ([key]) => features[key as keyof typeof features],
  ).map(([, label]) => label);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={
          <Link
            href="/super-admin/tenants"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-3 w-3" /> সব টেন্যান্ট
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            {tenant.name}
            <Badge tone={TENANT_TONE[tenant.status] ?? "neutral"}>
              {TENANT_LABEL[tenant.status] ?? tenant.status}
            </Badge>
            <Badge tone={PLAN_TONE[subscription.planCode] ?? "neutral"}>{subscription.planName}</Badge>
          </span>
        }
        description={`যোগদান ${formatDate(tenant.createdAt)} · ${stores.length} দোকান · ${memberships.length} সদস্য · ${tenant.timezone}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {publishedStore ? (
              <Link
                href={storePath(publishedStore.slug)}
                target="_blank"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                স্টোরফ্রন্ট
              </Link>
            ) : null}
            <TenantStatusForm tenantId={tenant.id} status={tenant.status} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CreditCard}
          label="প্ল্যান"
          value={subscription.planName}
          hint={`${SUB_LABEL[subscription.status] ?? subscription.status} · ${
            subscription.monthlyPrice > 0 ? `${formatBdt(subscription.monthlyPrice)}/মাস` : "ফ্রি / কোট"
          }`}
        />
        <Metric
          icon={Banknote}
          label="মোট GMV"
          value={formatBdt(totalGmv)}
          hint={`${totalOrders} সফল অর্ডার`}
        />
        <Metric
          icon={ShoppingBag}
          label="সফল অর্ডার"
          value={totalOrders.toLocaleString("en-US")}
          hint={`এই মাসে ${usage.orders.toLocaleString("en-US")}`}
        />
        <Metric
          icon={Receipt}
          label="বকেয়া প্ল্যাটফর্ম ফি"
          value={formatBdt(pendingFees)}
          hint={`${detail.fees.summary.find((row) => row.status === "PENDING")?.count ?? 0}টি এন্ট্রি`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="মালিক ও যোগাযোগ" description="Tenant owner ও টিম সদস্য" />
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                {(owner.name ?? owner.phone).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{owner.name ?? "নাম নেই"}</p>
                <p className="text-xs text-ink-500">{owner.phone}</p>
                {owner.email ? <p className="truncate text-xs text-ink-500">{owner.email}</p> : null}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-ink-400">অ্যাকাউন্ট তৈরি</dt>
                <dd className="mt-0.5 font-medium text-ink-800">{formatDate(owner.joinedAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-400">টেন্যান্ট আইডি</dt>
                <dd className="mt-0.5 font-mono text-[10.5px] text-ink-600">{tenant.id.slice(0, 12)}…</dd>
              </div>
              <div>
                <dt className="text-ink-400">কারেন্সি</dt>
                <dd className="mt-0.5 font-medium text-ink-800">{tenant.currency}</dd>
              </div>
              <div>
                <dt className="text-ink-400">টাইমজোন</dt>
                <dd className="mt-0.5 font-medium text-ink-800">{tenant.timezone}</dd>
              </div>
            </dl>

            <div className="border-t border-ink-100 pt-3">
              <p className="mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
                টিম মেম্বার
              </p>
              <ul className="space-y-2">
                {memberships.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-800">
                        {member.name ?? member.phone}
                      </span>
                      <span className="block text-[10.5px] text-ink-400">{member.phone}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="neutral">{member.role}</Badge>
                      <Badge tone={member.status === "ACTIVE" ? "success" : "warning"}>{member.status}</Badge>
                    </span>
                  </li>
                ))}
                {memberships.length === 0 ? (
                  <li className="text-xs text-ink-500">কোনো membership নেই।</li>
                ) : null}
              </ul>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="সাবস্ক্রিপশন ও প্ল্যান"
            description="মার্চেন্টের বিলিং প্যানেলের সাথে একই সাবস্ক্রিপশন"
            action={
              <Badge
                tone={
                  subscription.status === "ACTIVE"
                    ? "success"
                    : subscription.status === "TRIALING"
                      ? "info"
                      : subscription.status === "SUSPENDED" || subscription.status === "CANCELLED"
                        ? "danger"
                        : "warning"
                }
              >
                {SUB_LABEL[subscription.status] ?? subscription.status}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xl font-semibold tracking-tight text-ink-900">{subscription.planName}</p>
                <p className="text-xs text-ink-500">
                  {subscription.monthlyPrice > 0
                    ? `${formatBdt(subscription.monthlyPrice)} / মাস`
                    : "কাস্টম কোট / ফ্রি"}
                </p>
              </div>
              <Link href="/super-admin/plans" className="text-[11.5px] font-semibold text-brand-700 hover:underline">
                লিমিট এডিট →
              </Link>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-ink-400">বিলিং সাইকেল</dt>
                <dd className="mt-0.5 font-medium text-ink-800">
                  {subscription.billingPeriod === "YEARLY" ? "বার্ষিক" : "মাসিক"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">পরবর্তী নবায়ন</dt>
                <dd className="mt-0.5 font-medium text-ink-800">
                  {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-400">পিরিয়ড শুরু</dt>
                <dd className="mt-0.5 font-medium text-ink-800">{formatDate(subscription.currentPeriodStart)}</dd>
              </div>
              <div>
                <dt className="text-ink-400">ট্রায়াল শেষ</dt>
                <dd className="mt-0.5 font-medium text-ink-800">
                  {subscription.trialEnd ? formatDate(subscription.trialEnd) : "—"}
                </dd>
              </div>
            </dl>

            <div className="border-t border-ink-100 pt-3">
              <p className="mb-2 text-[10.5px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
                সক্রিয় ফিচার
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeFeatures.map((label) => (
                  <Badge key={label} tone="brand">
                    {label}
                  </Badge>
                ))}
                {activeFeatures.length === 0 ? (
                  <span className="text-xs text-ink-500">কোনো অতিরিক্ত ফিচার নেই।</span>
                ) : null}
              </div>
            </div>

            {subscription.cancelAtPeriodEnd ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                এই সাবস্ক্রিপশন পিরিয়ড শেষে বাতিল হবে।
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="রিসোর্স ব্যবহার"
          description="মার্চেন্ট তার নিজের প্যানেলে যে হিসাব দেখে, ঠিক সেই ডেটা"
          action={<Badge tone="brand">{subscription.planName} লিমিট</Badge>}
        />
        <CardBody className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Meter label="পণ্য" used={usage.products} limit={limits.products} />
          <Meter label="এই মাসের অর্ডার" used={usage.orders} limit={limits.monthlyOrders} />
          <Meter label="স্টোরেজ" used={usage.storageMb} limit={limits.storageMb} unit=" MB" />
          <Meter label="স্টাফ সিট" used={usage.staffSeats} limit={limits.staffSeats} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="দোকান"
          description="প্রতিটি স্টোরফ্রন্ট, তার থিম ও ভলিউম"
          action={
            <span className="text-[11.5px] text-ink-500">
              {stores.filter((store) => store.status === "PUBLISHED").length}টি publish করা
            </span>
          }
        />
        {stores.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">এই টেন্যান্টের কোনো দোকান নেই।</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>দোকান</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>থিম</Th>
                <Th className="text-right">পণ্য</Th>
                <Th className="text-right">কাস্টমার</Th>
                <Th className="text-right">অর্ডার</Th>
                <Th className="text-right">GMV</Th>
                <Th className="text-right">স্টোরেজ</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="transition hover:bg-ink-50/60">
                  <Td>
                    <span className="flex items-center gap-1.5 font-medium text-ink-900">
                      <Store className="h-3.5 w-3.5 text-ink-400" />
                      {store.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10.5px] text-ink-400">/{store.slug}</span>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        store.status === "PUBLISHED"
                          ? "success"
                          : store.status === "DRAFT"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {store.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone="neutral">{store.themeName ?? "—"}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{store.productCount}</Td>
                  <Td className="text-right tabular-nums">{store.customerCount}</Td>
                  <Td className="text-right tabular-nums">{store.orderCount}</Td>
                  <Td className="text-right font-medium tabular-nums">{formatBdt(store.gmv)}</Td>
                  <Td className="text-right text-xs text-ink-500 tabular-nums">{storageLabel(store.storageMb)}</Td>
                  <Td className="text-right">
                    {store.status === "PUBLISHED" ? (
                      <Link
                        href={storePath(store.slug)}
                        target="_blank"
                        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:underline"
                      >
                        দেখুন <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader title="সাম্প্রতিক অর্ডার" description="সর্বশেষ ৮টি অর্ডার (সব স্ট্যাটাস)" />
          {detail.recentOrders.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এখনো কোনো অর্ডার নেই।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>অর্ডার</Th>
                  <Th>কাস্টমার</Th>
                  <Th>দোকান</Th>
                  <Th>স্ট্যাটাস</Th>
                  <Th className="text-right">টোটাল</Th>
                  <Th>সময়</Th>
                </tr>
              </thead>
              <tbody>
                {detail.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <Td className="font-mono text-[11px] text-ink-700">{order.orderNo}</Td>
                    <Td className="text-xs">{order.customerName}</Td>
                    <Td className="text-xs text-ink-500">{order.storeName}</Td>
                    <Td>
                      <Badge tone={ORDER_TONE[order.status] ?? "neutral"}>
                        {ORDER_STATUS_LABELS[order.status as OrderStatusValue] ?? order.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium tabular-nums">{formatBdt(order.grandTotal)}</Td>
                    <Td className="whitespace-nowrap text-[11px] text-ink-500">{formatDateTime(order.placedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="প্ল্যাটফর্ম ফি" description="কমিশন, গেটওয়ে ও কুরিয়ার" />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2 text-center">
              {detail.fees.summary.map((row) => (
                <div key={row.status} className="min-w-[5.5rem] flex-1 rounded-lg border border-ink-100 px-2 py-2">
                  <p className="text-[10px] font-medium text-ink-400">{row.status}</p>
                  <p className="mt-0.5 text-xs font-semibold whitespace-nowrap text-ink-800 tabular-nums">
                    {formatBdt(row.amount)}
                  </p>
                  <p className="text-[10px] text-ink-400">{row.count} এন্ট্রি</p>
                </div>
              ))}
              {detail.fees.summary.length === 0 ? (
                <p className="text-xs text-ink-500">কোনো ফি এন্ট্রি নেই।</p>
              ) : null}
            </div>

            <ul className="divide-y divide-ink-100">
              {detail.fees.entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-800">
                      {entry.orderNo ?? entry.feeType}
                    </span>
                    <span className="block text-[10.5px] text-ink-400">
                      {entry.storeName} · {formatDate(entry.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-ink-800 tabular-nums">{formatBdt(entry.feeAmount)}</span>
                    <span className="block text-[10px] text-ink-400">{entry.status}</span>
                  </span>
                </li>
              ))}
              {detail.fees.entries.length === 0 ? (
                <li className="py-2 text-xs text-ink-500">কোনো লেজার এন্ট্রি নেই।</li>
              ) : null}
            </ul>

            <Link
              href="/super-admin/fees"
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:underline"
            >
              ফি লেজার <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="সাপোর্ট টিকেট"
            description="এই টেন্যান্টের সর্বশেষ টিকেট"
            action={<LifeBuoy className="h-4 w-4 text-ink-300" />}
          />
          <CardBody className="space-y-2">
            {detail.tickets.length === 0 ? (
              <p className="text-sm text-ink-500">কোনো টিকেট নেই।</p>
            ) : (
              detail.tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink-800">{ticket.subject}</p>
                    <p className="text-[10.5px] text-ink-400">{formatDateTime(ticket.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge tone={ticket.priority === "URGENT" ? "danger" : ticket.priority === "HIGH" ? "warning" : "neutral"}>
                      {ticket.priority}
                    </Badge>
                    <Badge tone={ticket.status === "OPEN" ? "warning" : ticket.status === "RESOLVED" ? "success" : "neutral"}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="অডিট ট্রেইল"
            description="এই টেন্যান্টের সর্বশেষ পরিবর্তন"
            action={<ShieldCheck className="h-4 w-4 text-ink-300" />}
          />
          <CardBody className="space-y-2">
            {detail.audit.length === 0 ? (
              <p className="text-sm text-ink-500">কোনো অডিট এন্ট্রি নেই।</p>
            ) : (
              detail.audit.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11px] text-ink-700">{row.action}</span>
                    <span className="block text-[10.5px] text-ink-400">
                      {row.actor ?? "system"}
                      {row.resourceType ? ` · ${row.resourceType}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[10.5px] text-ink-400">
                    {formatDateTime(row.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {detail.invoices.length > 0 ? (
        <Card>
          <CardHeader title="ইনভয়েস" description="সর্বশেষ প্ল্যাটফর্ম ইনভয়েস" action={<Receipt className="h-4 w-4 text-ink-300" />} />
          <Table>
            <thead>
              <tr>
                <Th>নম্বর</Th>
                <Th>স্ট্যাটাস</Th>
                <Th className="text-right">টোটাল</Th>
                <Th>ডিউ</Th>
                <Th>পরিশোধ</Th>
              </tr>
            </thead>
            <tbody>
              {detail.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td className="font-mono text-[11px]">{invoice.number}</Td>
                  <Td>
                    <Badge
                      tone={
                        invoice.status === "PAID"
                          ? "success"
                          : invoice.status === "UNCOLLECTIBLE" || invoice.status === "VOID"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium tabular-nums">{formatBdt(invoice.total)}</Td>
                  <Td className="text-xs text-ink-500">{invoice.dueAt ? formatDate(invoice.dueAt) : "—"}</Td>
                  <Td className="text-xs text-ink-500">{invoice.paidAt ? formatDate(invoice.paidAt) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-400">
        <span className="inline-flex items-center gap-1">
          <Package className="h-3.5 w-3.5" /> {usage.products} পণ্য
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {usage.staffSeats} সদস্য
        </span>
        <span className="inline-flex items-center gap-1">
          <HardDrive className="h-3.5 w-3.5" /> {storageLabel(usage.storageMb)}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" /> শেষ আপডেট {formatDate(tenant.createdAt)}
        </span>
      </div>
    </div>
  );
}
