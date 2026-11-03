import Link from "next/link";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { formatDate } from "@/lib/dates";
import { formatBdt, fromPaisa } from "@/lib/money";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/shell";
import {
  CUSTOMER_SEGMENTS,
  SEGMENT_LABELS,
  listCustomers,
  type CustomerSegment,
} from "@/lib/services/customer-service";

/** Customer directory with derived segments, consent and lifetime value (PRD §4.4). */

export const metadata = { title: "কাস্টমার" };

const SEGMENT_TONE: Record<Exclude<CustomerSegment, "all">, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  new: "info",
  repeat: "success",
  vip: "brand",
  inactive: "warning",
  blacklisted: "danger",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; segment?: string }>;
}) {
  const { store } = await requireActiveStorePermissionPage("customers:read");
  const query = await searchParams;

  const q = (query.q ?? "").trim();
  const segment = CUSTOMER_SEGMENTS.includes((query.segment ?? "") as CustomerSegment)
    ? ((query.segment ?? "all") as CustomerSegment)
    : "all";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const perPage = 20;

  const { rows, total, counts } = await listCustomers(store.id, {
    q,
    segment,
    page,
    perPage,
  });
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const buildHref = (next: { segment?: CustomerSegment; page?: number }) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const nextSegment = next.segment ?? segment;
    if (nextSegment !== "all") params.set("segment", nextSegment);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const suffix = params.toString();
    return `/admin/customers${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">কাস্টমার</h1>
        <p className="text-sm text-ink-500">
          মোট {counts.all}জন ক্রেতা · অর্ডার ইতিহাস থেকে segment স্বয়ংক্রিয়ভাবে হিসাব হয়
        </p>
      </div>

      <form action="/admin/customers" className="flex flex-wrap gap-2">
        {segment !== "all" ? <input type="hidden" name="segment" value={segment} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="নাম, মোবাইল বা ইমেইল"
          className="w-full max-w-sm rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button type="submit" className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          খুঁজুন
        </button>
        {q ? (
          <Link href="/admin/customers" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700">
            রিসেট
          </Link>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-1.5">
        {CUSTOMER_SEGMENTS.map((item) => {
          const active = item === segment;
          return (
            <Link
              key={item}
              href={buildHref({ segment: item, page: 1 })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-ink-900 text-white"
                  : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
              }`}
            >
              {SEGMENT_LABELS[item]} ({counts[item]})
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="কোনো কাস্টমার নেই"
          description={q || segment !== "all" ? "এই ফিল্টারে কোনো ক্রেতা মেলেনি।" : "প্রথম অর্ডার এলে কাস্টমার তালিকা এখানে দেখা যাবে।"}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>ক্রেতা</Th>
                <Th>যোগাযোগ</Th>
                <Th>Segment</Th>
                <Th>Consent</Th>
                <Th className="text-right">অর্ডার</Th>
                <Th className="text-right">মোট খরচ</Th>
                <Th>শেষ অর্ডার</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => {
                const emailOk = customer.consent.marketingEmail?.granted === true;
                const smsOk = customer.consent.marketingSms?.granted === true;
                return (
                  <tr key={customer.id}>
                    <Td>
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {customer.name}
                      </Link>
                      {customer.isBlacklisted ? (
                        <Badge tone="danger" className="ml-2">
                          blacklisted
                        </Badge>
                      ) : null}
                      <span className="block text-xs text-ink-400">যোগ হয়েছেন {formatDate(customer.createdAt)}</span>
                    </Td>
                    <Td className="text-xs text-ink-600">
                      {customer.phone}
                      {customer.email ? <span className="block text-ink-400">{customer.email}</span> : null}
                    </Td>
                    <Td>
                      <Badge tone={SEGMENT_TONE[customer.segment]}>{SEGMENT_LABELS[customer.segment]}</Badge>
                    </Td>
                    <Td className="text-xs">
                      <span className={emailOk ? "text-emerald-700" : "text-ink-400"}>
                        email {emailOk ? "✓" : "—"}
                      </span>
                      <span className={`ml-2 ${smsOk ? "text-emerald-700" : "text-ink-400"}`}>
                        sms {smsOk ? "✓" : "—"}
                      </span>
                    </Td>
                    <Td className="text-right">{customer.orderCount}</Td>
                    <Td className="text-right font-medium">{formatBdt(fromPaisa(customer.lifetimePaisa))}</Td>
                    <Td className="text-xs text-ink-500">
                      {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {pageCount > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={buildHref({ page: page - 1 })} className="rounded-lg border border-ink-200 bg-white px-4 py-2">
              পূর্ববর্তী
            </Link>
          ) : null}
          <span className="text-ink-500">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={buildHref({ page: page + 1 })} className="rounded-lg border border-ink-200 bg-white px-4 py-2">
              পরবর্তী
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
