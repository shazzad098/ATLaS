import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveStore } from "@/lib/tenant";
import { formatBdt } from "@/lib/money";
import { listCategories, listProducts } from "@/lib/services/catalog-service";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui/shell";
import { ButtonLink } from "@/components/ui/button";

/** Product list with search and status filter (FR-03). */

export const metadata = { title: "পণ্য" };

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  ACTIVE: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; categoryId?: string; cursor?: string }>;
}) {
  const { store } = await requireActiveStore();
  const query = await searchParams;

  const status = (["ACTIVE", "DRAFT", "ARCHIVED"] as const).find((value) => value === query.status);

  const [result, categories] = await Promise.all([
    listProducts(store.id, { q: query.q, status, categoryId: query.categoryId, cursor: query.cursor, limit: 20 }),
    listCategories(store.id),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { q: query.q, status: query.status, categoryId: query.categoryId, cursor: query.cursor, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      search.set(key, value);
    }
    const qs = search.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">পণ্য</h1>
          <p className="text-sm text-ink-500">{result.items.length}টি দেখানো হচ্ছে</p>
        </div>
        <ButtonLink href="/admin/products/new">
          <Plus className="h-4 w-4" /> নতুন পণ্য
        </ButtonLink>
      </div>

      <form action="/admin/products" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query.q ?? ""}
          placeholder="নাম, ট্যাগ বা SKU"
          className="w-full max-w-sm rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <select
          name="categoryId"
          defaultValue={query.categoryId ?? ""}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={query.status ?? ""} className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm">
          <option value="">সব স্ট্যাটাস</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="submit" className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          ফিল্টার
        </button>
        {query.q || query.status || query.categoryId ? (
          <Link href="/admin/products" className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700">
            রিসেট
          </Link>
        ) : null}
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="কোনো পণ্য নেই"
          description="প্রথম পণ্য যোগ করে আপনার ক্যাটালগ শুরু করুন।"
          action={<ButtonLink href="/admin/products/new">পণ্য যোগ করুন</ButtonLink>}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>পণ্য</Th>
                <Th>ক্যাটাগরি</Th>
                <Th>স্ট্যাটাস</Th>
                <Th className="text-right">ভ্যারিয়েন্ট</Th>
                <Th className="text-right">স্টক</Th>
                <Th className="text-right">দাম থেকে</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((product) => {
                const stock = product.variants.reduce((sum, variant) => sum + (variant.stockQty - variant.reservedQty), 0);
                const prices = product.variants.map((variant) => Number(variant.price));
                const priceFrom = prices.length ? Math.min(...prices) : 0;
                return (
                  <tr key={product.id} className="hover:bg-ink-50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                          {product.images[0]?.url ? (
                            <img src={product.images[0].url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span>
                          <Link href={`/admin/products/${product.id}`} className="font-medium text-brand-700 hover:underline">
                            {product.name}
                          </Link>
                          <span className="block text-xs text-ink-400">/{product.slug}</span>
                        </span>
                      </div>
                    </Td>
                    <Td className="text-ink-600">{product.category?.name ?? "—"}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[product.status] ?? "neutral"}>{product.status}</Badge>
                    </Td>
                    <Td className="text-right">{product._count.variants}</Td>
                    <Td className="text-right">
                      <Badge tone={stock <= 0 ? "danger" : "neutral"}>{stock}</Badge>
                    </Td>
                    <Td className="text-right font-medium">{formatBdt(priceFrom)}</Td>
                  </tr>
                );
              })}
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
