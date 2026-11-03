import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, PackageSearch, Search } from "lucide-react";
import {
  getStorefrontContext,
  storePath,
  storefrontUrl,
  themeContextFrom,
} from "@/lib/storefront";
import { listStorefrontCategories, listStorefrontProducts } from "@/lib/storefront-data";
import { getTheme } from "@/themes";
import {
  EmptyState,
  OutlineLink,
  PageIntro,
  StoreBreadcrumb,
  Surface,
} from "@/app/store/[slug]/_components/storefront-ui";

/** Shop listing with search, category filter, sort and pagination (FR-04). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) return { title: "দোকান" };
  const canonical = storefrontUrl(context, "/shop");
  return {
    title: "দোকান",
    description: `${context.store.name}-এর সব পণ্য এক জায়গায়।`,
    alternates: { canonical },
    openGraph: { url: canonical, title: `দোকান · ${context.store.name}` },
  };
}

const SORTS = [
  { value: "newest", label: "নতুন আগে" },
  { value: "price-asc", label: "দাম: কম থেকে বেশি" },
  { value: "price-desc", label: "দাম: বেশি থেকে কম" },
  { value: "name", label: "নাম অনুযায়ী" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const set = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  const pages = [...set].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  let previous = 0;
  for (const item of pages) {
    if (previous && item - previous > 1) result.push("…");
    result.push(item);
    previous = item;
  }
  return result;
}

const inputClass =
  "h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[var(--store-primary)] focus:ring-2 focus:ring-black/5";

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

  const activeCategory = categories.find((category) => category.slug === categorySlug);

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
    <div className="atlas-shell py-8 sm:py-10">
      <StoreBreadcrumb
        slug={slug}
        items={[{ label: "হোম", href: "/" }, { label: "সব পণ্য" }]}
      />

      <PageIntro
        eyebrow="ক্যাটালগ"
        title={q ? `“${q}” এর ফলাফল` : activeCategory ? activeCategory.name : "সব পণ্য"}
        subtitle={
          total > 0
            ? `${total}টি পণ্য পাওয়া গেছে${activeCategory ? ` · ${activeCategory.name}` : ""}`
            : "এই ফিল্টারে কোনো পণ্য পাওয়া যায়নি।"
        }
      />

      <Surface className="mt-6 p-3 sm:p-4">
        <form
          action={storePath(slug, "/shop")}
          className="flex flex-col gap-2 lg:flex-row lg:items-center"
          role="search"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="muted pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="পণ্যের নাম বা ট্যাগ দিয়ে খুঁজুন…"
              aria-label="পণ্য খুঁজুন"
              className={`${inputClass} pl-10`}
            />
          </div>
          <select
            name="category"
            defaultValue={categorySlug}
            aria-label="ক্যাটাগরি"
            className={`${inputClass} lg:w-44`}
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
            aria-label="সাজানোর ক্রম"
            className={`${inputClass} lg:w-48`}
          >
            {SORTS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="store-btn h-11 shrink-0 px-5 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: "var(--store-primary)" }}
          >
            ফিল্টার করুন
          </button>
        </form>

        {q || categorySlug ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
            <span className="muted text-[10px] font-semibold tracking-[0.14em] uppercase">
              ফিল্টার
            </span>
            {q ? (
              <Link
                href={buildHref({ q: undefined, page: undefined })}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.02] px-2.5 py-1 text-[10px] font-medium"
              >
                “{q}”
                <span aria-hidden="true" className="opacity-50">
                  ×
                </span>
              </Link>
            ) : null}
            {categorySlug ? (
              <Link
                href={buildHref({ category: undefined, page: undefined })}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.02] px-2.5 py-1 text-[10px] font-medium"
              >
                {activeCategory?.name ?? categorySlug}
                <span aria-hidden="true" className="opacity-50">
                  ×
                </span>
              </Link>
            ) : null}
            <Link
              href={storePath(slug, "/shop")}
              className="ml-auto text-[10px] font-semibold hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              সব ফিল্টার মুছুন
            </Link>
          </div>
        ) : null}
      </Surface>

      {products.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={PackageSearch}
            title="কোনো পণ্য পাওয়া যায়নি"
            description={
              q
                ? "অন্য নাম বা ট্যাগ দিয়ে খুঁজে দেখুন, অথবা ফিল্টার পরিষ্কার করুন।"
                : "এই ক্যাটাগরিতে এখনো পণ্য যোগ করা হয়নি।"
            }
            action={
              <OutlineLink href={storePath(slug, "/shop")}>সব পণ্য দেখুন</OutlineLink>
            }
          />
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
          {products.map((product) => (
            <theme.ProductCard key={product.id} ctx={ctx} product={product} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav aria-label="পেজিনেশন" className="mt-12 flex items-center justify-center gap-1.5">
          <Link
            href={buildHref({ page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
            className={`store-btn grid h-9 w-9 place-items-center border border-black/10 ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-black/[0.03]"
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">পূর্ববর্তী</span>
          </Link>
          {pageWindow(page, pageCount).map((item, index) =>
            item === "…" ? (
              <span key={`gap-${index}`} className="muted px-1 text-xs">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={buildHref({ page: String(item) })}
                aria-current={item === page ? "page" : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-xs font-semibold transition ${
                  item === page
                    ? "text-white"
                    : "border border-black/10 bg-white hover:bg-black/[0.03]"
                }`}
                style={item === page ? { background: "var(--store-primary)" } : undefined}
              >
                {item}
              </Link>
            ),
          )}
          <Link
            href={buildHref({ page: String(Math.min(pageCount, page + 1)) })}
            aria-disabled={page >= pageCount}
            className={`store-btn grid h-9 w-9 place-items-center border border-black/10 ${
              page >= pageCount ? "pointer-events-none opacity-40" : "hover:bg-black/[0.03]"
            }`}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">পরবর্তী</span>
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
