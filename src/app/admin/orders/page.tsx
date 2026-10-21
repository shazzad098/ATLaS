import Link from "next/link";
import { requireActiveStore } from "@/lib/tenant";
import { formatDateTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { ORDER_STATUS_LABELS, countsByStatus, listOrders } from "@/lib/services/order-service";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/shell";

/** Order list with status filter, search and cursor pagination (FR-05). */

export const metadata = { title: "অর্ডার" };

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
  searchParams: Promise<{ status?: string; q?: string; cursor?: string }>;
}) {
  const { store } = await requireActiveStore();
  const query = await searchParams;

  const [result, counts] = await Promise.all([
    listOrders(store.id, { status: query.status, q: query.q, cursor: query.cursor, limit: 20 }),
    countsByStatus(store.id),
  ]);

  const totalCount = counts.reduce((sum, row) => sum + row._count._all, 0);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { status: query.status, q: query.q, cursor: query.cursor, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      search.set(key, value);
    }
    const qs = search.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
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
                <Th>অর্ডার</Th>
                <Th>ক্রেতা</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>পেমেন্ট</Th>
                <Th className="text-right">আইটেম</Th>
                <Th className="text-right">মোট</Th>
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
