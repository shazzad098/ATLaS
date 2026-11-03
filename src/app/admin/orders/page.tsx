import Link from "next/link";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { formatDateTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { ORDER_STATUS_LABELS, countsByStatus, listOrders } from "@/lib/services/order-service";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/shell";

/** Order list with status filter, search, sortable columns and cursor pagination (FR-05). */

export const metadata = { title: "অর্ডার" };

/** URL sort keys → service whitelisted fields. */
const SORT_FIELDS = {
  orders: "placedAt",
  customer: "customerName",
  status: "status",
  payment: "paymentProvider",
  items: "items",
  total: "grandTotal",
} as const;

const SORT_KEYS = Object.keys(SORT_FIELDS) as Array<keyof typeof SORT_FIELDS>;

/** Columns that read more naturally ascending the first time you click them. */
const SORT_DEFAULT_ASC: Array<(typeof SORT_KEYS)[number]> = ["customer", "status", "payment"];

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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; cursor?: string; sort?: string; dir?: string }>;
}) {
  const { store } = await requireActiveStorePermissionPage("orders:read");
  const query = await searchParams;
  const sort = SORT_KEYS.find((key) => key === query.sort) ?? "orders";
  const dir: "asc" | "desc" = query.dir === "asc" ? "asc" : "desc";

  const [result, counts] = await Promise.all([
    listOrders(store.id, {
      status: query.status,
      q: query.q,
      cursor: query.cursor,
      limit: 20,
      sort: SORT_FIELDS[sort],
      dir,
    }),
    countsByStatus(store.id),
  ]);

  const totalCount = counts.reduce((sum, row) => sum + row._count._all, 0);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = {
      status: query.status,
      q: query.q,
      cursor: query.cursor,
      sort: sort === "orders" ? undefined : sort,
      dir: dir === "desc" ? undefined : dir,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      search.set(key, value);
    }
    const qs = search.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

  /** Clicking a new column uses its natural first order; clicking again flips. */
  const sortHref = (key: (typeof SORT_KEYS)[number]) => {
    const nextDir = sort === key ? (dir === "desc" ? "asc" : "desc") : SORT_DEFAULT_ASC.includes(key) ? "asc" : "desc";
    return buildHref({ sort: key === "orders" ? undefined : key, dir: nextDir === "desc" ? undefined : nextDir, cursor: undefined });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">অর্ডার</h1>
        <p className="text-sm text-ink-500">মোট {totalCount}টি অর্ডার</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href={buildHref({ status: undefined, cursor: undefined })}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            !query.status ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700"
          }`}
        >
          সব
        </Link>
        {counts.map((row) => (
          <Link
            key={row.status}
            href={buildHref({ status: row.status, cursor: undefined })}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              query.status === row.status
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-200 bg-white text-ink-700"
            }`}
          >
            {ORDER_STATUS_LABELS[row.status as keyof typeof ORDER_STATUS_LABELS] ?? row.status} · {row._count._all}
          </Link>
        ))}
      </div>

      <form action="/admin/orders" className="flex flex-wrap gap-2">
        {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="অর্ডার নম্বর, নাম বা মোবাইল দিয়ে খুঁজুন"
          className="w-full max-w-sm rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button type="submit" className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          খুঁজুন
        </button>
        {query.q ? (
          <Link
            href={buildHref({ q: undefined, cursor: undefined })}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700"
          >
            মুছুন
          </Link>
        ) : null}
      </form>

      {result.items.length === 0 ? (
        <EmptyState title="কোনো অর্ডার নেই" description="এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।" />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
              {(
                [
                  { key: "orders", label: "অর্ডার", right: false },
                  { key: "customer", label: "ক্রেতা", right: false },
                  { key: "status", label: "স্ট্যাটাস", right: false },
                  { key: "payment", label: "পেমেন্ট", right: false },
                  { key: "items", label: "আইটেম", right: true },
                  { key: "total", label: "মোট", right: true },
                ] as const
              ).map((column) => (
                  <Th key={column.key} className={column.right ? "text-right" : undefined}>
                    <Link
                      href={sortHref(column.key)}
                      className={`inline-flex items-center gap-1 hover:text-ink-900 ${
                        sort === column.key ? "font-semibold text-ink-900" : ""
                      }`}
                      title="ক্লিক করে সাজান"
                    >
                      {column.label}
                      <span aria-hidden className="text-[10px] text-ink-400">
                        {sort === column.key ? (dir === "asc" ? "▲" : "▼") : "▲▼"}
                      </span>
                    </Link>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((order) => (
                <tr key={order.id} className="hover:bg-ink-50">
                  <Td>
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-brand-700 hover:underline">
                      {order.orderNo}
                    </Link>
                    <span className="block text-xs text-ink-400">{formatDateTime(order.placedAt)}</span>
                  </Td>
                  <Td>
                    {order.customerName}
                    <span className="block text-xs text-ink-400">{order.customerPhone}</span>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-600">{order.paymentProvider}</span>
                    <span className="block text-xs text-ink-400">{order.paymentStatus}</span>
                  </Td>
                  <Td className="text-right">{order._count.items}</Td>
                  <Td className="text-right font-medium">{formatBdt(order.grandTotal)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {result.hasMore ? (
        <div className="flex justify-center">
          <Link
            href={buildHref({ cursor: result.nextCursor ?? undefined })}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            আরও লোড করুন
          </Link>
        </div>
      ) : null}
    </div>
  );
}
