import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { formatDateTime } from "@/lib/dates";
import {
  listBuyerReviews,
  listReviewableProducts,
} from "@/lib/services/customer-account";
import { ProductImage } from "@/components/product-image";
import { DeleteReviewForm } from "../../_components/review-forms";
import { Surface, RatingStars } from "@/app/store/[slug]/_components/storefront-ui";

export const metadata = { title: "রিভিউ ও মন্তব্য", robots: { index: false, follow: false } };

export default async function BuyerReviewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) redirect(storePath(slug, "/account/login"));

  const [reviews, reviewable] = await Promise.all([
    listBuyerReviews(context.store.id, buyer.id),
    listReviewableProducts(context.store.id, buyer.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p
          className="text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "var(--store-primary)" }}
        >
          কমিউনিটি
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">রিভিউ ও মন্তব্য</h1>
        <p className="muted mt-1 text-sm">
          আপনার দেওয়া মন্তব্য, দোকানের উত্তর ও কেনা পণ্যের তালিকা।
        </p>
      </header>

      <section>
        <Surface>
        <div className="border-b border-black/5 px-4 py-3">
          <h2 className="text-sm font-semibold">আপনার মন্তব্য</h2>
          <p className="muted mt-0.5 text-[11px]">
            {reviews.length ? `${reviews.length}টি মন্তব্য করেছেন` : "এখনো কোনো মন্তব্য করেননি"}
          </p>
        </div>

        {reviews.length === 0 ? (
          <p className="muted px-4 py-6 text-xs">
            পণ্য কেনার পর নিচের তালিকা থেকে মন্তব্য করতে পারবেন।
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {reviews.map((review) => (
              <li key={review.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={storePath(slug, `/product/${review.productSlug}`)}
                      className="text-sm font-semibold hover:underline"
                    >
                      {review.productName}
                    </Link>
                    <p className="mt-1 flex items-center gap-1">
                      <RatingStars rating={review.rating} size={13} />
                      {review.verifiedPurchase ? (
                        <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                          verified purchase
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`${storePath(slug, `/product/${review.productSlug}`)}#review-form`}
                      className="text-[11px] font-medium text-[var(--store-primary)] hover:underline"
                    >
                      নতুন মন্তব্য
                    </Link>
                    <DeleteReviewForm
                      slug={slug}
                      productSlug={review.productSlug}
                      reviewId={review.id}
                    />
                  </div>
                </div>

                {review.title ? <p className="mt-2 text-xs font-semibold">{review.title}</p> : null}
                <p className="muted mt-1 text-xs leading-relaxed whitespace-pre-line">{review.body}</p>
                <p className="muted mt-1.5 text-[10px]">{formatDateTime(review.createdAt)}</p>

                {review.comments.length ? (
                  <ul className="mt-3 space-y-1.5 border-l-2 border-black/5 pl-3">
                    {review.comments.map((comment) => (
                      <li key={comment.id} className="text-[11px]">
                        <span className="font-medium">{comment.authorName}</span>{" "}
                        <span className="muted">{comment.body}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        </Surface>
      </section>

      <section>
        <Surface>
        <div className="border-b border-black/5 px-4 py-3">
          <h2 className="text-sm font-semibold">কেনা পণ্যে মন্তব্য করুন</h2>
          <p className="muted mt-0.5 text-[11px]">
            একই পণ্যে একাধিকবার মন্তব্য করতে পারবেন — আগের মন্তব্য মুছে যাবে না।
          </p>
        </div>

        {reviewable.length === 0 ? (
          <p className="muted px-4 py-6 text-xs">
            রিভিউ দেওয়ার জন্য আগে কোনো পণ্য কিনতে হবে।{" "}
            <Link href={storePath(slug, "/shop")} className="font-medium text-[var(--store-primary)] hover:underline">
              দোকানে যান
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {reviewable.map((product) => (
              <li key={product.productId} className="flex items-center gap-3 px-4 py-3">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-black/5">
                  {product.imageUrl ? (
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{product.name}</p>
                  <p className="muted text-[11px]">
                    {product.reviewCount > 0
                      ? `${product.reviewCount}টি মন্তব্য · সর্বশেষ ${product.existingRating}★`
                      : "এখনো মন্তব্য করেননি"}
                  </p>
                </div>
                <Link
                  href={`${storePath(slug, `/product/${product.slug}`)}#review-form`}
                  className="store-btn shrink-0 border border-black/10 px-3 py-1.5 text-[11px] font-semibold hover:border-black/25"
                >
                  মন্তব্য দিন
                </Link>
              </li>
            ))}
          </ul>
        )}
        </Surface>
      </section>
    </div>
  );
}
