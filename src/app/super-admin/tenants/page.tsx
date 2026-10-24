import Link from "next/link";
import { ArrowUpRight, Search, Store, Users } from "lucide-react";
import { listTenantsForAdmin } from "@/lib/services/platform-service";
import { formatBdt } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Badge, EmptyState, Meter, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { TenantStatusForm } from "@/app/super-admin/_components/tenant-status-form";

/** Every tenant with its plan, usage, theme and outstanding platform fees (PRD §4.5). */

export const metadata = { title: "টেন্যান্ট" };

type TenantsPageProps = {
  searchParams?: Promise<{ page?: string; q?: string }>;
};

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

function storageLabel(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const params = (await searchParams) ?? {};
  const page = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);
  const query = params.q?.trim() ?? "";
  const result = await listTenantsForAdmin({ page, search: query });
  const tenants = result.rows;

  return (
    <div className="space-y-5">
      <PageHeader
        title="টেন্যান্ট"
        description="প্রতিটি workspace-এর প্ল্যান, ইউসেজ, থিম ও বকেয়া প্ল্যাটফর্ম ফি — মার্চেন্ট প্যানেলের সাথে একই ডেটা।"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink-600">
            <Store className="h-3.5 w-3.5" />
            মোট {result.total} টেন্যান্ট
          </span>
        }
      />

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="নাম, ফোন বা ইমেইল দিয়ে খুঁজুন…"
            className="h-10 w-full rounded-lg border border-ink-200 bg-white pr-3 pl-9 text-sm outline-none transition focus:border-brand-400"
          />
        </div>
        <button
          type="submit"
          className="h-10 rounded-lg bg-ink-900 px-5 text-sm font-medium text-white transition hover:bg-ink-700"
        >
          খুঁজুন
        </button>
        {query ? (
          <Link
            href="/super-admin/tenants"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            রিসেট
          </Link>
        ) : null}
      </form>

      {tenants.length === 0 ? (
        <EmptyState
          title="কোনো টেন্যান্ট পাওয়া যায়নি"
          description={query ? `“${query}” এর সাথে মিলে এমন কোনো টেন্যান্ট নেই।` : "এখনো কোনো টেন্যান্ট যোগ দেয়নি।"}
        />
      ) : (
        <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
          <Table>
            <thead>
              <tr>
                <Th>টেন্যান্ট</Th>
                <Th>মালিক</Th>
                <Th>প্ল্যান</Th>
                <Th>দোকান / থিম</Th>
                <Th>ইউসেজ</Th>
                <Th className="text-right">অর্ডার / GMV</Th>
                <Th className="text-right">বকেয়া ফি</Th>
                <Th>স্ট্যাটাস</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="transition hover:bg-ink-50/60">
                  <Td>
                    <Link
                      href={`/super-admin/tenants/${tenant.id}`}
                      className="font-medium whitespace-nowrap text-ink-900 hover:text-brand-700"
                    >
                      {tenant.name}
                    </Link>
                    <span className="mt-0.5 block text-[11px] text-ink-400">
                      যোগদান {formatDate(tenant.createdAt)}
                    </span>
                  </Td>
                  <Td className="text-xs text-ink-600">
                    {tenant.owner.name ?? "—"}
                    <span className="mt-0.5 block text-ink-400">{tenant.owner.phone}</span>
                  </Td>
                  <Td>
                    <Badge tone={PLAN_TONE[tenant.planCode] ?? "neutral"}>{tenant.planName}</Badge>
                    <span className="mt-1 block text-[10.5px] text-ink-500">
                      {SUB_LABEL[tenant.subscriptionStatus] ?? tenant.subscriptionStatus}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700">
                      <Store className="h-3 w-3 text-ink-400" />
                      {tenant.storeCount}
                    </span>
                    <span className="mt-1 block">
                      <Badge tone="neutral">{tenant.themeName ?? "থিম নেই"}</Badge>
                    </span>
                  </Td>
                  <Td>
                    <div className="w-36">
                      <Meter label="পণ্য" used={tenant.productCount} limit={tenant.limits.products} />
                    </div>
                    <span className="mt-1.5 flex items-center gap-2 text-[10.5px] text-ink-400">
                      <span>{storageLabel(tenant.storageMb)}</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="h-3 w-3" />
                        {tenant.customerCount}
                      </span>
                    </span>
                  </Td>
                  <Td className="text-right text-xs tabular-nums">
                    <span className="block font-medium text-ink-800">{tenant.orderCount}</span>
                    <span className="block text-ink-500">{formatBdt(tenant.gmv)}</span>
                  </Td>
                  <Td className="text-right tabular-nums">
                    <span className={tenant.pendingFees === "0.00" ? "text-ink-400" : "font-medium text-amber-700"}>
                      {formatBdt(tenant.pendingFees)}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={TENANT_TONE[tenant.status] ?? "neutral"}>
                      {TENANT_LABEL[tenant.status] ?? tenant.status}
                    </Badge>
                    <div className="mt-1.5">
                      <TenantStatusForm tenantId={tenant.id} status={tenant.status} />
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/super-admin/tenants/${tenant.id}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:underline"
                    >
                      বিস্তারিত <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
        <p>
          বকেয়া ফি বিস্তারিত দেখতে{" "}
          <Link href="/super-admin/fees" className="font-medium text-brand-700 hover:underline">
            ফি লেজার
          </Link>{" "}
          দেখুন।
        </p>
        {result.page > 1 || result.hasMore ? (
          <div className="flex items-center gap-3">
            {result.page > 1 ? (
              <Link
                href={`/super-admin/tenants?page=${result.page - 1}&q=${encodeURIComponent(query)}`}
                className="font-medium text-brand-700 hover:underline"
              >
                ← আগের পৃষ্ঠা
              </Link>
            ) : null}
            <span>
              পৃষ্ঠা {result.page} · মোট {result.total}
            </span>
            {result.hasMore ? (
              <Link
                href={`/super-admin/tenants?page=${result.page + 1}&q=${encodeURIComponent(query)}`}
                className="font-medium text-brand-700 hover:underline"
              >
                পরের পৃষ্ঠা →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
