import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontContext, storePath, themeContextFrom } from "@/lib/storefront";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/storefront-data";
import { getTheme } from "@/themes";

/** Shop listing with search, category filter, sort and pagination (FR-04). */

export const metadata = { title: "দোকান" };

const SORTS = [
  { value: "newest", label: "নতুন আগে" },
  { value: "price-asc", label: "দাম: কম থেকে বেশি" },
  { value: "price-desc", label: "দাম: বেশি থেকে কম" },
  { value: "name", label: "নাম অনুযায়ী" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const theme = getTheme(context.theme.code);
  const ctx = themeContextFrom(context);

  const q = (query.q ?? "").trim();
  const categorySlug = query.category ?? "";
  const sort = (SORTS.find((entry) => entry.value === query.sort)?.value ?? "newest") as Sort;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const [{ products, total, pageCount }, categories] = await Promise.all([
    listStorefrontProducts(context.store.id, {
      q: q || undefined,
      categorySlug: categorySlug || undefined,
      sort,
      page,
      perPage: 12,
    }),
    listStorefrontCategories(context.store.id),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { q, category: categorySlug, sort, page: String(page), ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      if (key === "page" && value === "1") continue;
      if (key === "sort" && value === "newest") continue;
      search.set(key, value);
    }
    const qs = search.toString();
    return storePath(slug, `/shop${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="atlas-shell py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">সব পণ্য</h1>
          <p className="muted mt-1 text-sm">{total}টি পণ্য পাওয়া গেছে</p>
        </div>
      </div>

      <form action={storePath(slug, "/shop")} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="পণ্যের নাম বা ট্যাগ দিয়ে খুঁজুন…"
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <select
          name="category"
          defaultValue={categorySlug}
          className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm"
        >
          <option value="">সব ক্যাটাগরি</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name} ({category.productCount})
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm"
        >
          {SORTS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="store-btn px-5 py-2 text-sm font-semibold text-white sm:col-span-3 lg:col-span-1"
          style={{ background: "var(--store-primary)" }}
        >
          ফিল্টার করুন
        </button>
      </form>

      {categorySlug || q ? (
        <p className="muted mt-3 text-xs">
          {q ? `“${q}”` : ""}
          {q && categorySlug ? " · " : ""}
          {categorySlug ? `ক্যাটাগরি: ${categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug}` : ""}
          {" · "}
          <Link href={storePath(slug, "/shop")} className="font-semibold underline">
            ফিল্টার মুছুন
          </Link>
        </p>
      ) : null}

      {products.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-black/15 py-16 text-center">
          <p className="text-sm font-semibold">কোনো পণ্য পাওয়া যায়নি</p>
          <p className="muted mt-1 text-sm">অন্য কিছু লিখে খুঁজে দেখুন।</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <theme.ProductCard key={product.id} ctx={ctx} product={product} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="mt-10 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link href={buildHref({ page: String(page - 1) })} className="store-btn border border-black/15 px-4 py-2">
              পূর্ববর্তী
            </Link>
          ) : null}
          <span className="muted px-2">
            {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={buildHref({ page: String(page + 1) })} className="store-btn border border-black/15 px-4 py-2">
              পরবর্তী
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
