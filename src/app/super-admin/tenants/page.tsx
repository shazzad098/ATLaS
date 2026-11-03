import Link from "next/link";
import {
  Banknote,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Layers,
  Store,
} from "lucide-react";
import {
  listPlanOptions,
  listTenantsForAdmin,
  tenantDirectoryStats,
} from "@/lib/services/platform-service";
import { formatBdt } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { TenantStatusForm } from "@/app/super-admin/_components/tenant-status-form";
import { ImpersonateForm } from "@/app/super-admin/_components/impersonate-form";
import { GrowthBadge, TenantKpi } from "./_components/tenant-kpi";
import { NewTenantDialog } from "./_components/new-tenant-dialog";
import { TenantFilters } from "./_components/tenant-filters";

/** Every tenant with its plan, volume and outstanding platform fees (PRD §4.5). */

export const metadata = { title: "টেন্যান্ট" };

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["ACTIVE", "READ_ONLY", "SUSPENDED", "CANCELLED"] as const;
const SORT_OPTIONS = ["recent", "name", "gmv", "orders", "fees"] as const;

const PLAN_STYLE: Record<string, string> = {
  free: "border-slate-200 bg-slate-50 text-slate-600",
  basic: "border-emerald-200 bg-emerald-50 text-emerald-700",
  standard: "border-indigo-200 bg-indigo-50 text-indigo-600",
  pro: "border-violet-200 bg-violet-50 text-violet-600",
};

const SUBSCRIPTION_LABEL: Record<string, string> = {
  TRIALING: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST DUE",
  GRACE_PERIOD: "GRACE",
  GRACE: "GRACE",
  READ_ONLY: "READ-ONLY",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
};

const AVATAR_TONES = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
];

const numberFormat = new Intl.NumberFormat("bn-BD");
const moneyFormat = new Intl.NumberFormat("bn-BD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function bn(value: number): string {
  return numberFormat.format(value);
}

function bnMoney(value: string): string {
  return `৳${moneyFormat.format(Number(value || 0))}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0)).join("").toUpperCase() || "T";
}

function avatarTone(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const set = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  const sorted = [...set].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("…");
    result.push(page);
    previous = page;
  }
  return result;
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string; sort?: string; page?: string }>;
}) {
  const raw = await searchParams;
  const q = (raw.q ?? "").trim();
  const status = STATUS_OPTIONS.includes(raw.status as (typeof STATUS_OPTIONS)[number])
    ? (raw.status as string)
    : "";
  const plan = raw.plan ?? "";
  const sort = SORT_OPTIONS.includes(raw.sort as (typeof SORT_OPTIONS)[number])
    ? (raw.sort as string)
    : "recent";
  const requestedPage = Number.parseInt(raw.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [stats, directory, plans] = await Promise.all([
    tenantDirectoryStats(),
    listTenantsForAdmin({ q, status, plan, sort, page, perPage: 10 }),
    listPlanOptions(),
  ]);

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (status) exportParams.set("status", status);
  if (plan) exportParams.set("plan", plan);
  if (sort !== "recent") exportParams.set("sort", sort);
  const exportHref = `/super-admin/tenants/export${exportParams.size ? `?${exportParams}` : ""}`;

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    if (sort !== "recent") params.set("sort", sort);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return `/super-admin/tenants${query ? `?${query}` : ""}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] leading-tight font-bold tracking-tight text-slate-900">
              টেন্যান্ট
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              লাইভ ডেটা
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            প্রতিটি workspace-এর প্ল্যান, দোকান, অর্ডার, GMV ও বকেয়া প্ল্যাটফর্ম ফি পরিসংখ্যান করুন।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={exportHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            এক্সপোর্ট CSV
          </a>
          <NewTenantDialog plans={plans.map((row) => ({ code: row.code, name: row.name }))} />
        </div>
      </div>

      {/* KPIs */}
      <section aria-label="টেন্যান্ট সারসংক্ষেপ" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TenantKpi
          label="মোট টেন্যান্ট"
          value={bn(stats.tenants.total)}
          badge={<GrowthBadge value={stats.tenants.growth} />}
          hint={`গত ৩০ দিনে ${bn(stats.tenants.newThisMonth)}টি নতুন যোগদান`}
          icon={Building2}
          tone="sky"
        />
        <TenantKpi
          label="মোট দোকান"
          value={bn(stats.stores.total)}
          badge={<GrowthBadge value={stats.stores.growth} />}
          hint={`সর্বোচ্চ ${bn(stats.stores.maxPerTenant)}টি দোকান প্রতিটি টেন্যান্ট`}
          icon={Store}
          tone="emerald"
        />
        <TenantKpi
          label="মোট প্ল্যাটফর্ম GMV"
          value={bnMoney(stats.gmv.total)}
          badge={<GrowthBadge value={stats.gmv.growth} />}
          hint={`${bn(stats.gmv.orders)}টি অর্ডারের বিপরীতে`}
          icon={Banknote}
          tone="amber"
        />
        <TenantKpi
          label="সক্রিয় সাবস্ক্রিপশন"
          value={
            <>
              {bn(stats.subscriptions.active)}{" "}
              <span className="text-sm font-semibold text-slate-400">টি</span>
            </>
          }
          badge={
            <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">
              {bn(stats.subscriptions.activePercent)}% সক্রিয়
            </span>
          }
          hint={`মোট ${bn(stats.subscriptions.plans)}টি প্ল্যান থেকে নির্বাচিত`}
          icon={Layers}
          tone="violet"
        />
      </section>

      {/* Filters */}
      <div className="mt-4">
        <TenantFilters
          key={`${q}|${status}|${plan}|${sort}`}
          plans={plans.map((row) => ({ code: row.code, name: row.name }))}
          initial={{ q, status, plan, sort }}
        />
      </div>

      {/* Directory */}
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[47rem] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc] text-[10px] text-slate-500">
                <th className="w-[22%] px-2.5 py-3 font-semibold">টেন্যান্ট</th>
                <th className="w-[14%] px-2.5 py-3 font-semibold">মালিক</th>
                <th className="w-[9%] px-2.5 py-3 font-semibold">প্ল্যান</th>
                <th className="w-[5.5%] px-2.5 py-3 font-semibold">দোকান</th>
                <th className="w-[5.5%] px-2.5 py-3 font-semibold">অর্ডার</th>
                <th className="w-[9.5%] px-2.5 py-3 font-semibold">GMV</th>
                <th className="w-[9.5%] px-2.5 py-3 font-semibold">বকেয়া ফি</th>
                <th className="w-[17%] px-2.5 py-3 font-semibold">স্ট্যাটাস</th>
                <th className="w-[8%] px-2.5 py-3">
                  <span className="sr-only">Impersonate</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {directory.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-slate-700">কোনো টেন্যান্ট পাওয়া যায়নি</p>
                    <p className="mt-1 text-xs text-slate-400">
                      ফিল্টার বদলে দেখুন, অথবা নতুন একটি workspace যোগ করুন।
                    </p>
                    <Link
                      href="/super-admin/tenants"
                      className="mt-3 inline-flex rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      ফিল্টার পরিষ্কার করুন
                    </Link>
                  </td>
                </tr>
              ) : (
                directory.rows.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-2.5 py-4 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarTone(tenant.name)}`}
                        >
                          {initials(tenant.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12px] leading-snug font-semibold break-words text-slate-900">
                            {tenant.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            যোগদান {formatDate(tenant.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-2.5 py-4 align-middle">
                      <p className="text-[11px] leading-snug break-words text-slate-700">
                        {tenant.owner.name ?? "—"}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                        {tenant.owner.phone}
                      </p>
                    </td>

                    <td className="px-2.5 py-4 align-middle">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${
                          PLAN_STYLE[tenant.planCode] ?? PLAN_STYLE.free
                        }`}
                      >
                        {tenant.planName}
                      </span>
                      <span className="mt-1 block text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
                        {SUBSCRIPTION_LABEL[tenant.subscriptionStatus] ?? tenant.subscriptionStatus}
                      </span>
                    </td>

                    <td className="px-2.5 py-4 align-middle text-[12.5px] text-slate-700 tabular-nums">
                      {tenant.storeCount}
                    </td>
                    <td className="px-2.5 py-4 align-middle text-[12.5px] text-slate-700 tabular-nums">
                      {tenant.orderCount}
                    </td>
                    <td className="px-2.5 py-4 align-middle text-[12px] whitespace-nowrap text-slate-700 tabular-nums">
                      {formatBdt(tenant.gmv)}
                    </td>
                    <td
                      className={`px-2.5 py-4 align-middle text-[12px] font-medium whitespace-nowrap tabular-nums ${
                        Number(tenant.pendingFees) > 0 ? "text-amber-600" : "text-slate-700"
                      }`}
                    >
                      {formatBdt(tenant.pendingFees)}
                    </td>

                    <td className="px-2.5 py-4 align-middle">
                      <TenantStatusForm tenantId={tenant.id} status={tenant.status} />
                    </td>

                    <td className="px-2.5 py-4 align-middle">
                      <ImpersonateForm
                        tenantId={tenant.id}
                        tenantName={tenant.name}
                        variant="icon"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer: count + pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5 text-[10px] text-slate-500">
          <p>
            মোট <span className="font-semibold text-slate-700">{bn(directory.total)}</span> টি
            টেন্যান্ট দেখানো হচ্ছে
          </p>

          {directory.pageCount > 1 ? (
            <nav aria-label="পেজিনেশন" className="flex items-center gap-1">
              <PageLink
                href={pageHref(directory.page - 1)}
                disabled={directory.page <= 1}
                label="পূর্ববর্তী"
                icon="prev"
              />
              {pageNumbers(directory.page, directory.pageCount).map((item, index) =>
                item === "…" ? (
                  <span key={`gap-${index}`} className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={pageHref(item)}
                    aria-current={item === directory.page ? "page" : undefined}
                    className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[10px] font-medium transition ${
                      item === directory.page
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </Link>
                ),
              )}
              <PageLink
                href={pageHref(directory.page + 1)}
                disabled={directory.page >= directory.pageCount}
                label="পরবর্তী"
                icon="next"
              />
            </nav>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50/70 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[11px] text-sky-900">
          <Info className="h-4 w-4 shrink-0 text-sky-500" />
          আপনার ফি বিস্তারিত দেখতে{" "}
          <Link href="/super-admin/fees" className="font-semibold underline underline-offset-2">
            ফি লেজার
          </Link>{" "}
          দেখুন।
        </p>
        <p className="text-[10px] text-sky-700/60">লাইভ ডেটা · প্রতিটি পরিবর্তন audit log-এ থাকে</p>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: "prev" | "next";
}) {
  const content = (
    <>
      {icon === "prev" ? <ChevronLeft className="h-3 w-3" /> : null}
      {label}
      {icon === "next" ? <ChevronRight className="h-3 w-3" /> : null}
    </>
  );

  if (disabled) {
    return (
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-300">
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
    >
      {content}
    </Link>
  );
}
