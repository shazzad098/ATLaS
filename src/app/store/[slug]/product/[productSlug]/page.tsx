import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getStorefrontContext, storePath, themeContextFrom } from "@/lib/storefront";
import { getStorefrontProduct } from "@/lib/storefront-data";
import { formatBdt, toNumber } from "@/lib/money";
import { getTheme } from "@/themes";
import type { StorefrontProduct } from "@/themes/types";
import { AddToCart, type VariantOption } from "@/app/store/[slug]/_components/add-to-cart";

/** Product detail (FR-04). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) return { title: "পণ্য" };

  const detail = await getStorefrontProduct(context.store.id, productSlug);
  if (!detail) return { title: "পণ্য পাওয়া যায়নি" };

  const seo = detail.product.seoJson as { title?: string; description?: string };
  return {
    title: seo.title ?? detail.product.name,
    description: seo.description ?? undefined,
  };
}

function variantLabel(optionValues: Record<string, unknown>): string {
  const parts = Object.entries(optionValues)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([, value]) => `${String(value)}`);
  return parts.length ? parts.join(" / ") : "ডিফল্ট";
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const detail = await getStorefrontProduct(context.store.id, productSlug);
  if (!detail) notFound();

  const { product, related } = detail;
  const theme = getTheme(context.theme.code);
  const ctx = themeContextFrom(context);

  const description = (product.descriptionJson as { html?: string }).html ?? "";

  const prices = product.variants.map((variant) => toNumber(variant.price));
  const priceFrom = prices.length ? Math.min(...prices) : 0;
  const compareCandidates = product.variants
    .filter((variant) => variant.comparePrice !== null && toNumber(variant.comparePrice) > toNumber(variant.price))
    .map((variant) => toNumber(variant.comparePrice));
  const comparePrice = compareCandidates.length ? Math.max(...compareCandidates) : null;

  const options: VariantOption[] = product.variants.map((variant) => ({
    id: variant.id,
    label: variantLabel((variant.optionValuesJson ?? {}) as Record<string, unknown>),
    priceLabel: formatBdt(variant.price),
    available: variant.stockQty - variant.reservedQty,
  }));

  const relatedProducts: StorefrontProduct[] = related.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    priceFrom: row.variants.length ? toNumber(row.variants[0].price) : 0,
    comparePriceFrom: null,
    imageUrl: row.images[0]?.url ?? null,
    inStock: row.variants.some((variant) => variant.stockQty - variant.reservedQty > 0),
    categoryName: null,
  }));

  const gallery = product.images.length
    ? product.images
    : [{ id: "placeholder", url: null, altText: product.name }];

  return (
    <div className="atlas-shell py-8">
      <nav className="muted flex items-center gap-1.5 text-xs">
        <Link href={storePath(slug)} className="hover:underline">
          হোম
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={storePath(slug, "/shop")} className="hover:underline">
          দোকান
        </Link>
        {product.category ? (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={storePath(slug, `/shop?category=${product.category.slug}`)} className="hover:underline">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-xl tone-surface">
            {gallery[0]?.url ? (
              <img
                src={gallery[0].url}
                alt={gallery[0].altText ?? product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="muted grid h-full place-items-center text-sm">ছবি নেই</div>
            )}
          </div>
          {gallery.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {gallery.slice(1, 9).map((image) => (
                <div key={image.id} className="aspect-square overflow-hidden rounded-lg tone-surface">
                  {image.url ? (
                    <img src={image.url} alt={image.altText ?? product.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          {product.category ? (
            <Link
              href={storePath(slug, `/shop?category=${product.category.slug}`)}
              className="muted text-xs font-semibold uppercase tracking-wide hover:underline"
            >
              {product.category.name}
            </Link>
          ) : null}

          <h1 className="text-2xl font-semibold sm:text-3xl">{product.name}</h1>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold" style={{ color: "var(--store-primary)" }}>
              {formatBdt(priceFrom)}
            </span>
            {comparePrice ? <span className="muted text-base line-through">{formatBdt(comparePrice)}</span> : null}
          </div>

          {product.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span key={tag} className="muted rounded-full border border-black/10 px-2.5 py-0.5 text-[11px]">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <AddToCart storeId={context.store.id} slug={slug} options={options} />

          {description ? (
            <div className="border-t border-black/10 pt-5">
              <h2 className="text-sm font-semibold">পণ্যের বিবরণ</h2>
              <p className="muted mt-2 whitespace-pre-line text-sm leading-relaxed">{description}</p>
            </div>
          ) : null}
        </div>
      </div>

      {relatedProducts.length ? (
        <section className="mt-16">
          <h2 className="mb-5 text-xl font-semibold sm:text-2xl">এগুলোও দেখতে পারেন</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <theme.ProductCard key={item.id} ctx={ctx} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
