import Link from "next/link";
import { requireActiveStore } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { toPaisa, fromPaisa } from "@/lib/money";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/shell";

/** Customer directory with lifetime value (FR-09). */

export const metadata = { title: "কাস্টমার" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { store } = await requireActiveStore();
  const query = await searchParams;

  const q = (query.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const perPage = 20;

  const where = {
    storeId: store.id,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        orders: {
          where: { deletedAt: null },
          select: { grandTotal: true, status: true, placedAt: true },
        },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">কাস্টমার</h1>
        <p className="text-sm text-ink-500">মোট {total}জন ক্রেতা</p>
      </div>

      <form action="/admin/customers" className="flex flex-wrap gap-2">
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

      {customers.length === 0 ? (
        <EmptyState title="কোনো কাস্টমার নেই" description="প্রথম অর্ডার এলে কাস্টমার তালিকা এখানে দেখা যাবে।" />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>ক্রেতা</Th>
                <Th>যোগাযোগ</Th>
                <Th className="text-right">অর্ডার</Th>
                <Th className="text-right">মোট খরচ</Th>
                <Th>শেষ অর্ডার</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const valid = customer.orders.filter((order) => order.status !== "CANCELLED");
                const spend = valid.reduce((sum, order) => sum + toPaisa(order.grandTotal), 0n);
                const last = valid
                  .map((order) => order.placedAt)
                  .sort((a, b) => b.getTime() - a.getTime())[0];
                return (
                  <tr key={customer.id}>
                    <Td>
                      <span className="font-medium text-ink-900">{customer.name}</span>
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
                    <Td className="text-right">{valid.length}</Td>
                    <Td className="text-right font-medium">{formatBdt(fromPaisa(spend))}</Td>
                    <Td className="text-xs text-ink-500">{last ? formatDate(last) : "—"}</Td>
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
            <Link href={`/admin/customers?page=${page - 1}${q ? `&q=${q}` : ""}`} className="rounded-lg border border-ink-200 bg-white px-4 py-2">
              পূর্ববর্তী
            </Link>
          ) : null}
          <span className="text-ink-500">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={`/admin/customers?page=${page + 1}${q ? `&q=${q}` : ""}`} className="rounded-lg border border-ink-200 bg-white px-4 py-2">
              পরবর্তী
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
