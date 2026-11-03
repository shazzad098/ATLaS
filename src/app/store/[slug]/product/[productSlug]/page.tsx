import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getStorefrontContext,
  storefrontAvailability,
  storefrontOrigin,
  storefrontUrl,
  storePath,
  themeContextFrom,
} from "@/lib/storefront";
import { getStorefrontProduct } from "@/lib/storefront-data";
import { ProductGallery } from "@/components/product-gallery";
import { formatBdt, toNumber } from "@/lib/money";
import { bnNumber, formatDate } from "@/lib/dates";
import { getTheme } from "@/themes";
import type { StorefrontProduct } from "@/themes/types";
import { AddToCart, type VariantOption } from "@/app/store/[slug]/_components/add-to-cart";
import { trackEvent } from "@/lib/services/analytics-service";
import { readBuyerSession } from "@/lib/auth/customer-session";
import {
  getReviewSummary,
  isWishlisted,
  listProductReviews,
} from "@/lib/services/customer-account";
import { WishlistButton } from "@/app/store/[slug]/account/_components/wishlist-button";
import { CommentForm, ReviewForm } from "@/app/store/[slug]/account/_components/review-forms";
import {
  RatingStars,
  SectionHeading,
  StoreBreadcrumb,
  Surface,
  TrustStrip,
} from "@/app/store/[slug]/_components/storefront-ui";

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

  const seo = detail.product.seoJson as {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  const title = seo.title ?? detail.product.name;
  const description =
    seo.description ??
    (detail.product.descriptionJson as { text?: string }).text ??
    context.store.description ??
    undefined;
  const canonical = storefrontUrl(context, `/product/${detail.product.slug}`);
  const productImage = detail.product.images[0]?.url;
  const image = productImage
    ? new URL(productImage, `${storefrontOrigin(context)}/`).toString()
    : storefrontUrl(context, "/opengraph-image");

  return {
    title,
    description,
    keywords: seo.keywords,
    alternates: { canonical },
    robots: storefrontAvailability(context).visible
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "bn_BD",
      siteName: context.store.name,
      title,
      description,
      url: canonical,
      images: [{ url: image, alt: detail.product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function variantLabel(optionValues: Record<string, unknown>): string {
  const parts = Object.entries(optionValues)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    // Show the option name too ("সাইজ: 128GB", "রং: কালো"); generic keys used
    // for a plain variant name are just noise, so only the value is shown.
    .map(([key, value]) =>
      key === "ডিফল্ট" || key === "ভ্যারিয়েন্ট" ? String(value) : `${key}: ${String(value)}`,
    );
  return parts.length ? parts.join(" · ") : "ডিফল্ট";
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

  await trackEvent({
    tenantId: context.tenant.id,
    storeId: context.store.id,
    name: "product.view",
    path: `/product/${productSlug}`,
    metadata: { productId: detail.product.id },
  });

  const { product, related } = detail;
  const theme = getTheme(context.theme.code);
  const ctx = themeContextFrom(context);
  const buyer = await readBuyerSession(context.store.id);

  const [reviewSummary, reviews, wishlisted] = await Promise.all([
    getReviewSummary(context.store.id, product.id),
    listProductReviews(context.store.id, product.id, buyer?.id ?? null),
    buyer ? isWishlisted(context.store.id, buyer.id, product.id) : Promise.resolve(false),
  ]);

  const description = (product.descriptionJson as { html?: string }).html ?? "";

  const prices = product.variants.map((variant) => toNumber(variant.price));
  const priceFrom = prices.length ? Math.min(...prices) : 0;
  const compareCandidates = product.variants
    .filter((variant) => variant.comparePrice !== null && toNumber(variant.comparePrice) > toNumber(variant.price))
    .map((variant) => toNumber(variant.comparePrice));

  const options: VariantOption[] = product.variants.map((variant, index) => {
    const rawLabel = variantLabel((variant.optionValuesJson ?? {}) as Record<string, unknown>);
    return {
      id: variant.id,
      // Legacy rows saved before plain names were supported only carry the
      // default placeholder; number them instead of repeating "স্ট্যান্ডার্ড".
      label:
        rawLabel === "স্ট্যান্ডার্ড" || rawLabel === "ডিফল্ট"
          ? `ভ্যারিয়েন্ট ${bnNumber(index + 1)}`
          : rawLabel,
      priceLabel: formatBdt(variant.price),
      comparePriceLabel:
        variant.comparePrice !== null && toNumber(variant.comparePrice) > toNumber(variant.price)
          ? formatBdt(variant.comparePrice)
          : null,
      available: variant.stockQty - variant.reservedQty,
    };
  });

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

  const plainDescription = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const absoluteImages = product.images
    .map((image) => image.url)
    .filter((url): url is string => Boolean(url))
    .map((url) => new URL(url, `${storefrontOrigin(context)}/`).toString());
  const inStock = product.variants.some((variant) => variant.stockQty - variant.reservedQty > 0);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: plainDescription || undefined,
    image: absoluteImages.length ? absoluteImages : undefined,
    sku: product.variants[0]?.sku ?? product.id,
    category: product.category?.name,
    brand: { "@type": "Brand", name: context.store.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BDT",
      lowPrice: priceFrom,
      highPrice: compareCandidates.length ? Math.max(...prices) : priceFrom,
      offerCount: Math.max(1, product.variants.length),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: storefrontUrl(context, `/product/${product.slug}`),
    },
  };

  return (
    <div className="atlas-shell py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, "\\u003c") }}
      />
      <StoreBreadcrumb
        slug={slug}
        items={[
          { label: "হোম", href: "/" },
          { label: "দোকান", href: "/shop" },
          ...(product.category
            ? [
                {
                  label: product.category.name,
                  href: `/shop?category=${product.category.slug}`,
                },
              ]
            : []),
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Surface className="p-2.5 sm:p-3">
            <ProductGallery images={gallery} productName={product.name} />
          </Surface>
        </div>

        <div className="min-w-0">
          {product.category ? (
            <Link
              href={storePath(slug, `/shop?category=${product.category.slug}`)}
              className="text-[10px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: "var(--store-primary)" }}
            >
              {product.category.name}
            </Link>
          ) : null}

          <h1 className="mt-2 text-[1.85rem] leading-[1.15] font-semibold tracking-tight sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RatingStars rating={reviewSummary.average} size={16} />
            <a href="#reviews" className="muted text-xs hover:underline">
              {reviewSummary.count
                ? `${bnNumber(reviewSummary.count)}টি মন্তব্য · ${reviewSummary.average}/৫`
                : "প্রথম মন্তব্যটি আপনিই করুন"}
            </a>
            <span className="muted text-[10px]">·</span>
            <span
              className={`text-[11px] font-medium ${inStock ? "text-emerald-700" : "text-red-600"}`}
            >
              {inStock ? "স্টকে আছে" : "স্টক শেষ"}
            </span>
          </div>

          <Surface className="mt-5 p-5 sm:p-6">
            <AddToCart storeId={context.store.id} slug={slug} options={options} />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4">
              {buyer ? (
                <WishlistButton
                  slug={slug}
                  productId={product.id}
                  productSlug={product.slug}
                  saved={wishlisted}
                />
              ) : (
                <Link
                  href={`${storePath(slug, "/account/login")}?next=${encodeURIComponent(storePath(slug, `/product/${product.slug}`))}`}
                  className="store-btn inline-flex items-center gap-1.5 border border-black/10 px-3 py-2 text-xs font-medium transition hover:border-black/25"
                >
                  উইশলিস্টে রাখতে লগইন করুন
                </Link>
              )}
              <span className="muted text-[10px]">নিরাপদ চেকআউট · ক্যাশ অন ডেলিভারি</span>
            </div>
          </Surface>

          <div className="mt-4">
            <TrustStrip items={ctx.config.trust.items} />
          </div>

          {product.tags.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="muted rounded-full border border-black/10 px-2.5 py-0.5 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-black/[0.06] bg-black/[0.015] p-4 text-[11px]">
            <div>
              <dt className="muted">ক্যাটাগরি</dt>
              <dd className="mt-0.5 font-medium">{product.category?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="muted">SKU</dt>
              <dd className="mt-0.5 font-mono">{product.variants[0]?.sku ?? "—"}</dd>
            </div>
            <div>
              <dt className="muted">ভ্যারিয়েন্ট</dt>
              <dd className="mt-0.5 font-medium">{options.length}টি</dd>
            </div>
            <div>
              <dt className="muted">ডেলিভারি</dt>
              <dd className="mt-0.5 font-medium">চেকআউটে চার্জ দেখুন</dd>
            </div>
          </dl>
        </div>
      </div>

      {description ? (
        <Surface className="mt-8 p-6 sm:p-8">
          <SectionHeading eyebrow="বিস্তারিত" title="পণ্যের বিবরণ" />
          <p className="muted mt-4 whitespace-pre-line text-sm leading-relaxed">{description}</p>
        </Surface>
      ) : null}

      <section id="reviews" className="mt-14 scroll-mt-24">
        <SectionHeading
          eyebrow="রিভিউ ও মন্তব্য"
          title="ক্রেতাদের মতামত"
          description={
            reviewSummary.count
              ? `${bnNumber(reviewSummary.count)}টি মন্তব্য · গড় ${reviewSummary.average}/৫`
              : "এখনো কোনো মন্তব্য নেই — প্রথমটি আপনিই দিন।"
          }
          action={
            <a
              href="#review-form"
              className="store-btn border border-black/10 px-4 py-2 text-xs font-semibold transition hover:bg-black/[0.03]"
            >
              মন্তব্য লিখুন
            </a>
          }
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_1fr]">
          <Surface className="h-fit p-5 lg:sticky lg:top-24">
            <p className="muted text-[10px] font-semibold tracking-[0.16em] uppercase">
              রেটিং সারসংক্ষেপ
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[2.6rem] leading-none font-bold">
                {reviewSummary.count ? reviewSummary.average : "—"}
              </span>
              <span className="muted pb-1 text-[11px]">/ ৫</span>
            </div>
            <RatingStars rating={reviewSummary.average} size={15} className="mt-2" />
            <p className="muted mt-1 text-[11px]">{bnNumber(reviewSummary.count)}টি রেটিং</p>

            <ul className="mt-4 space-y-1.5">
              {reviewSummary.distribution.map((row) => (
                <li key={row.rating} className="flex items-center gap-2 text-[11px]">
                  <span className="muted w-6 shrink-0">{bnNumber(row.rating)}★</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{
                        width: `${reviewSummary.count ? (row.count / reviewSummary.count) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="muted w-6 shrink-0 text-right">{bnNumber(row.count)}</span>
                </li>
              ))}
            </ul>

            <p className="muted mt-4 border-t border-black/[0.06] pt-3 text-[10px] leading-relaxed">
              verified ব্যাজ মানে এই ক্রেতা পণ্যটি কিনেছেন। মন্তব্য মডারেশনের পর প্রকাশিত হয়।
            </p>
          </Surface>

          <div className="space-y-4">
            <div id="review-form" className="scroll-mt-24">
              <Surface className="p-5">
                <h3 className="text-sm font-semibold">মন্তব্য ও রেটিং লিখুন</h3>
                <p className="muted mt-0.5 mb-3 text-[11px]">
                  একই পণ্যে একাধিকবার মন্তব্য করতে পারেন — আগের মন্তব্য মুছে যাবে না।
                </p>
                {buyer ? (
                  <ReviewForm slug={slug} productId={product.id} productSlug={product.slug} />
                ) : (
                  <Link
                    href={`${storePath(slug, "/account/login")}?next=${encodeURIComponent(storePath(slug, `/product/${product.slug}`))}`}
                    className="store-btn inline-flex bg-[var(--store-primary)] px-4 py-2 text-xs font-semibold text-white"
                  >
                    লগইন করে মন্তব্য দিন
                  </Link>
                )}
              </Surface>
            </div>

            {reviews.length === 0 ? (
              <Surface className="border-dashed px-4 py-10 text-center">
                <p className="text-sm font-medium">এখনো কোনো মন্তব্য নেই</p>
                <p className="muted mt-1 text-xs">প্রথম মন্তব্যটি আপনিই করুন।</p>
              </Surface>
            ) : (
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <Surface className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold text-white"
                            style={{ background: "var(--store-primary)" }}
                          >
                            {review.authorName.trim().charAt(0) || "B"}
                          </span>
                          <div>
                            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                              {review.authorName}
                              {review.verifiedPurchase ? (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-medium text-emerald-700">
                                  verified
                                </span>
                              ) : null}
                              {review.isMine ? (
                                <span className="rounded-full border border-black/10 bg-black/[0.03] px-1.5 py-0.5 text-[8px] font-medium text-black/60">
                                  আপনার মন্তব্য
                                </span>
                              ) : null}
                            </p>
                            <p className="muted mt-0.5 text-[10px]">{formatDate(review.createdAt)}</p>
                          </div>
                        </div>
                        <RatingStars rating={review.rating} size={13} />
                      </div>

                      {review.title ? (
                        <p className="mt-3 text-sm font-semibold">{review.title}</p>
                      ) : null}
                      <p className="muted mt-1.5 text-sm leading-relaxed whitespace-pre-line">
                        {review.body}
                      </p>

                      {review.comments.length ? (
                        <ul className="mt-3 space-y-2 border-t border-black/[0.06] pt-3">
                          {review.comments.map((comment) => (
                            <li key={comment.id} className="flex gap-2">
                              <span
                                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-semibold text-white"
                                style={{ background: "var(--store-primary)" }}
                              >
                                {comment.authorName.trim().charAt(0) || "B"}
                              </span>
                              <p className="text-[11px] leading-relaxed">
                                <span className="font-medium">{comment.authorName}</span>{" "}
                                <span className="muted">{comment.body}</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {buyer ? (
                        <CommentForm slug={slug} productSlug={product.slug} reviewId={review.id} />
                      ) : null}
                    </Surface>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {relatedProducts.length ? (
        <section className="mt-16">
          <SectionHeading
            eyebrow="আরও পছন্দ"
            title="এগুলোও দেখতে পারেন"
            description="একই দোকানের আরও কিছু নির্বাচিত পণ্য।"
          />
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <theme.ProductCard key={item.id} ctx={ctx} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
