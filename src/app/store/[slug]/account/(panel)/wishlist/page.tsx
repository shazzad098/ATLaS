import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HeartOff } from "lucide-react";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { formatBdt } from "@/lib/money";
import { listWishlist } from "@/lib/services/customer-account";
import { toggleWishlistAction } from "@/app/store/[slug]/account/actions";
import { ProductImage } from "@/components/product-image";
import { BuyerActionButton } from "../../_components/buyer-action-button";
import { EmptyState, PrimaryLink, Surface } from "@/app/store/[slug]/_components/storefront-ui";

export const metadata = { title: "উইশলিস্ট", robots: { index: false, follow: false } };

export default async function BuyerWishlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) redirect(storePath(slug, "/account/login"));

  const items = await listWishlist(context.store.id, buyer.id);

  return (
    <div className="space-y-5">
      <header>
        <p
          className="text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "var(--store-primary)" }}
        >
          সংরক্ষিত
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">উইশলিস্ট</h1>
        <p className="muted mt-1 text-sm">পছন্দের পণ্য সেভ করে রাখুন, পরে কিনুন।</p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={HeartOff}
          title="উইশলিস্ট খালি"
          description="পণ্যের পাতায় হার্ট আইকনে চাপ দিয়ে পছন্দের পণ্য সেভ করুন।"
          action={<PrimaryLink href={storePath(slug, "/shop")}>পণ্য দেখুন</PrimaryLink>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.productId}>
              <Surface className="flex gap-3 p-3">
              <Link
                href={storePath(slug, `/product/${item.slug}`)}
                className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-black/5"
              >
                {item.imageUrl ? (
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={storePath(slug, `/product/${item.slug}`)}
                  className="line-clamp-2 text-sm font-medium hover:underline"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-xs font-semibold">
                  {formatBdt(item.price)}
                  {item.comparePrice ? (
                    <span className="muted ml-1.5 text-[11px] line-through">
                      {formatBdt(item.comparePrice)}
                    </span>
                  ) : null}
                </p>
                <p className={`mt-0.5 text-[11px] ${item.inStock ? "text-emerald-600" : "text-red-500"}`}>
                  {item.inStock ? "স্টকে আছে" : "স্টক শেষ"}
                </p>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Link
                    href={storePath(slug, `/product/${item.slug}`)}
                    className="store-btn border border-black/10 px-2.5 py-1 text-[11px] font-semibold hover:border-black/25"
                  >
                    দেখুন
                  </Link>
                  <BuyerActionButton
                    action={toggleWishlistAction}
                    fields={{ slug, productId: item.productId, productSlug: item.slug }}
                    showMessage={false}
                  >
                    সরান
                  </BuyerActionButton>
                </div>
              </div>
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
