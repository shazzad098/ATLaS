import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  Boxes,
  ChevronRight,
  HardDrive,
  LifeBuoy,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { platformDashboard, listAuditTrail } from "@/lib/services/platform-service";
import { platformBillingMetrics } from "@/lib/services/billing-service";
import { formatBdt } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { runBillingSweepAction, syncThemeCatalogAction } from "@/app/super-admin/actions";
import { analyticsOverview } from "@/lib/services/analytics-service";

/** Platform overview: growth, revenue, plan mix, tenant health and the audit trail (PRD §4.5). */

export const metadata = { title: "ওভারভিউ" };

const STATUS_LABEL: Record<string, string> = {
  TRIALING: "ট্রায়াল",
  ACTIVE: "সক্রিয়",
  PAST_DUE: "বকেয়া",
  GRACE: "গ্রেস",
  READ_ONLY: "Read-only",
  SUSPENDED: "স্থগিত",
  CANCELLED: "বাতিল",
};

const PLAN_TONE: Record<string, "neutral" | "success" | "info" | "brand"> = {
  free: "neutral",
  basic: "success",
  standard: "info",
  pro: "brand",
};

const KPI_TONES = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
} as const;

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: keyof typeof KPI_TONES;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium text-ink-500">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ${KPI_TONES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2.5 text-[23px] leading-none font-semibold tracking-tight text-ink-900 tabular-nums">
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

export default async function SuperAdminPage() {
  const [dashboard, billing, audit, analytics] = await Promise.all([
    platformDashboard(),
    platformBillingMetrics(),
    listAuditTrail(12),
    analyticsOverview(30),
  ]);

  const totalPlanTenants = dashboard.plans.reduce((sum, plan) => sum + plan.tenantCount, 0) || 1;
  const funnel = [
    ["Signup", analytics.funnel.signup_completed],
    ["Store", analytics.funnel.store_created],
    ["First product", analytics.funnel.first_product_created],
    ["Published", analytics.funnel.store_published],
    ["Checkout", analytics.funnel.checkout_started],
    ["Paid", analytics.funnel.payment_succeeded],
  ] as const;
  const funnelTop = Math.max(...funnel.map(([, value]) => value), 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="প্ল্যাটফর্ম ওভারভিউ"
        description="টেন্যান্ট, প্ল্যান, ইউসেজ, GMV ও প্ল্যাটফর্ম ফি — এক নজরে (BDT / Asia/Dhaka)।"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FormButton action={runBillingSweepAction} fields={{ source: "super-admin" }} size="sm">
              Billing sweep
            </FormButton>
            <FormButton
              action={syncThemeCatalogAction}
              fields={{ source: "super-admin" }}
              variant="outline"
              size="sm"
            >
              থিম sync
            </FormButton>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Store}
          label="মোট টেন্যান্ট"
          value={dashboard.tenants.total}
          hint={`${dashboard.tenants.active} সক্রিয় · ${dashboard.tenants.trialing} ট্রায়াল · ${dashboard.tenants.newThisMonth} নতুন`}
        />
        <Kpi
          icon={ShoppingBag}
          label="মোট দোকান"
          value={dashboard.stores.total}
          hint={`${dashboard.stores.published}টি publish করা`}
          tone="emerald"
        />
        <Kpi
          icon={Banknote}
          label="মোট GMV"
          value={formatBdt(dashboard.orders.gmv)}
          hint={`পরিশোধিত ${formatBdt(dashboard.orders.paidGmv)}`}
          tone="amber"
        />
        <Kpi
          icon={TrendingUp}
          label="MRR"
          value={billing.formatted.mrr}
          hint={`ARR ${billing.formatted.arr} · ${billing.paidStoreCount} paid`}
          tone="violet"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi icon={Package} label="পণ্য" value={dashboard.catalog.products.toLocaleString("en-US")} />
        <Kpi icon={Users} label="কাস্টমার" value={dashboard.catalog.customers.toLocaleString("en-US")} />
        <Kpi icon={Boxes} label="সফল অর্ডার" value={dashboard.orders.total.toLocaleString("en-US")} tone="emerald" />
        <Kpi icon={HardDrive} label="স্টোরেজ" value={storageLabel(dashboard.usage.storageMb)} tone="sky" />
        <Kpi
          icon={LifeBuoy}
          label="খোলা টিকেট"
          value={dashboard.openTickets}
          hint={dashboard.openTickets > 0 ? "সাপোর্ট ইনবক্স দেখুন" : "সব ক্লিয়ার"}
          tone={dashboard.openTickets > 0 ? "rose" : "emerald"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader
            title="প্ল্যান বিতরণ"
            description="কোন প্ল্যানে কতজন মার্চেন্ট ও কত MRR"
            action={
              <Link href="/super-admin/plans" className="text-[11.5px] font-semibold text-brand-700 hover:underline">
                প্ল্যান কনফিগার →
              </Link>
            }
          />
          <CardBody className="space-y-3.5">
            {dashboard.plans.map((plan) => {
              const percent = Math.round((plan.tenantCount / totalPlanTenants) * 100);
              return (
                <div key={plan.code}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-2">
                      <Badge tone={PLAN_TONE[plan.code] ?? "neutral"}>{plan.name}</Badge>
                      <span className="text-ink-400">
                        {plan.monthlyPrice === null
                          ? "কাস্টম কোট"
                          : plan.monthlyPrice === 0
                            ? "ফ্রি"
                            : `${formatBdt(plan.monthlyPrice)}/মাস`}
                      </span>
                    </span>
                    <span className="font-semibold text-ink-800 tabular-nums">
                      {plan.tenantCount} টেন্যান্ট
                      <span className="ml-1.5 font-normal text-ink-400">({percent}%)</span>
                      <span className="ml-2 font-normal text-ink-400">· {formatBdt(plan.mrr)} MRR</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{ width: `${Math.max(percent, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {dashboard.plans.length === 0 ? (
              <p className="text-sm text-ink-500">এখনো কোনো সাবস্ক্রিপশন নেই।</p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="সাবস্ক্রিপশন অবস্থা"
            description="সব tenant-এর subscription status"
          />
          <CardBody className="space-y-2">
            {billing.byStatus.length === 0 ? (
              <p className="text-sm text-ink-500">এখনো কোনো সাবস্ক্রিপশন নেই।</p>
            ) : (
              billing.byStatus.map((row) => (
                <div key={row.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-ink-700">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        row.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : row.status === "TRIALING"
                            ? "bg-sky-500"
                            : row.status === "SUSPENDED" || row.status === "CANCELLED"
                              ? "bg-red-500"
                              : "bg-amber-500"
                      }`}
                    />
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                  <span className="font-semibold text-ink-900 tabular-nums">{row.count}</span>
                </div>
              ))
            )}
            <div className="mt-2 border-t border-ink-100 pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">অপরিশোধিত প্ল্যাটফর্ম ফি</span>
                <span className="font-semibold text-amber-700">{formatBdt(billing.gmvAndFees.platformFees)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader
            title="শীর্ষ টেন্যান্ট"
            description="GMV অনুযায়ী সাজানো — ব্যবহার ও বকেয়া ফি সহ"
            action={
              <Link href="/super-admin/tenants" className="text-[11.5px] font-semibold text-brand-700 hover:underline">
                সব টেন্যান্ট →
              </Link>
            }
          />
          {dashboard.topTenants.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এখনো কোনো টেন্যান্ট নেই।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>টেন্যান্ট</Th>
                  <Th>প্ল্যান</Th>
                  <Th className="text-right">পণ্য</Th>
                  <Th className="text-right">অর্ডার</Th>
                  <Th className="text-right">GMV</Th>
                  <Th className="text-right">স্টোরেজ</Th>
                  <Th className="text-right">বকেয়া</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {dashboard.topTenants.map((tenant) => (
                  <tr key={tenant.id} className="transition hover:bg-ink-50/60">
                    <Td>
                      <Link href={`/super-admin/tenants/${tenant.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {tenant.name}
                      </Link>
                      <span className="mt-0.5 block text-[11px] text-ink-400">{tenant.storeCount} দোকান</span>
                    </Td>
                    <Td>
                      <Badge tone={PLAN_TONE[tenant.planCode] ?? "neutral"}>{tenant.planName}</Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{tenant.productCount}</Td>
                    <Td className="text-right tabular-nums">{tenant.orderCount}</Td>
                    <Td className="text-right font-medium tabular-nums">{formatBdt(tenant.gmv)}</Td>
                    <Td className="text-right text-xs text-ink-500 tabular-nums">{storageLabel(tenant.storageMb)}</Td>
                    <Td className="text-right tabular-nums">
                      <span className={tenant.pendingFees === "0.00" ? "text-ink-400" : "font-medium text-amber-700"}>
                        {formatBdt(tenant.pendingFees)}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/super-admin/tenants/${tenant.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                      >
                        বিস্তারিত <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="নজর দরকার" description={`${dashboard.attention.length}টি টেন্যান্ট`} />
            <CardBody className="space-y-2">
              {dashboard.attention.length === 0 ? (
                <p className="text-sm text-ink-500">সব টেন্যান্ট স্বাভাবিক অবস্থায় আছে।</p>
              ) : (
                dashboard.attention.map((row) => (
                  <Link
                    key={row.id}
                    href={`/super-admin/tenants/${row.id}`}
                    className="flex items-center gap-2.5 rounded-lg border border-ink-100 px-3 py-2 transition hover:border-ink-200 hover:bg-ink-50"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        row.tone === "danger" ? "bg-red-500" : "bg-amber-500"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink-800">{row.name}</span>
                      <span className="block text-[10.5px] text-ink-500">{row.reason}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                  </Link>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="নতুন টেন্যান্ট" description="সাম্প্রতিক যোগদান" />
            <CardBody className="space-y-2.5">
              {dashboard.recentTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/super-admin/tenants/${tenant.id}`}
                  className="flex items-center gap-2.5 text-sm transition hover:text-brand-700"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-[10px] font-bold text-ink-600">
                    {tenant.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ink-800">{tenant.name}</span>
                    <span className="block text-[10.5px] text-ink-400">
                      {tenant.planName} · {tenant.storeCount} দোকান · {formatDate(tenant.createdAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader
            title="৩০ দিনের funnel"
            description={`${analytics.total}টি event · ${analytics.activeTenants}টি active tenant`}
          />
          <CardBody className="space-y-2.5">
            {funnel.map(([label, value]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                  <span className="font-medium text-ink-600">{label}</span>
                  <span className="font-semibold text-ink-900 tabular-nums">{value}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.max(Math.round((value / funnelTop) * 100), 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="রক্ষণাবেক্ষণ" description="ম্যানুয়ালি চালানোর অপারেশন" />
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <FormButton action={runBillingSweepAction} fields={{ source: "super-admin" }}>
                Billing sweep চালান
              </FormButton>
              <p className="text-[11px] leading-5 text-ink-500">
                trial শেষ হওয়া downgrade, ইনভয়েস তৈরি, reminder, read-only ও suspend — সব একসাথে।
              </p>
            </div>
            <div className="space-y-1 border-t border-ink-100 pt-4">
              <FormButton action={syncThemeCatalogAction} fields={{ source: "super-admin" }} variant="outline">
                থিম ক্যাটালগ sync করুন
              </FormButton>
              <p className="text-[11px] leading-5 text-ink-500">
                শিপ করা থিম থেকে Theme/ThemeVersion row তৈরি বা হালনাগাদ করে।
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="সাম্প্রতিক audit log"
          description="সব privileged ও আর্থিক পরিবর্তন"
          action={
            <Link href="/super-admin/audit" className="text-[11.5px] font-semibold text-brand-700 hover:underline">
              পূর্ণ লগ →
            </Link>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>সময়</Th>
              <Th>অ্যাকশন</Th>
              <Th>টেন্যান্ট</Th>
              <Th>অ্যাক্টর</Th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={row.id}>
                <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(row.createdAt)}</Td>
                <Td>
                  <Badge tone="neutral">{row.action}</Badge>
                </Td>
                <Td className="text-xs text-ink-500">{row.tenant?.name ?? "—"}</Td>
                <Td className="text-xs text-ink-500">{row.actor?.name ?? row.actor?.phone ?? "system"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
