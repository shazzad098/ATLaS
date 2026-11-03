import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";
import { CART_COOKIE, loadCart, priceCart } from "@/lib/services/cart-service";
import { formatBdt } from "@/lib/money";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { ProductImage } from "@/components/product-image";
import { CartLineControls } from "@/app/store/[slug]/_components/cart-line-controls";
import {
  applyCouponFormAction,
  removeLineFormAction,
} from "@/app/store/[slug]/actions";
import {
  CheckoutSteps,
  EmptyState,
  OutlineLink,
  PageIntro,
  StoreBreadcrumb,
  Surface,
} from "@/app/store/[slug]/_components/storefront-ui";

/** Cart page (FR-04). Prices are recomputed from the database on every render. */

export const metadata = { title: "কার্ট", robots: { index: false, follow: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const storeId = context.store.id;
  const sessionKey = (await cookies()).get(CART_COOKIE)?.value;
  const cart = sessionKey ? await loadCart(storeId, sessionKey) : null;
  const pricing = cart ? await priceCart(storeId, cart) : null;

  if (!pricing || pricing.lines.length === 0) {
    return (
      <div className="atlas-shell py-8 sm:py-10">
        <StoreBreadcrumb
          slug={slug}
          items={[{ label: "হোম", href: "/" }, { label: "কার্ট" }]}
        />
        <div className="mt-10">
          <EmptyState
            icon={ShoppingBag}
            title="আপনার কার্ট খালি"
            description="পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন।"
            action={
              <OutlineLink href={storePath(slug, "/shop")}>পণ্য দেখুন</OutlineLink>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-shell py-8 sm:py-10">
      <StoreBreadcrumb
        slug={slug}
        items={[{ label: "হোম", href: "/" }, { label: "কার্ট" }]}
      />

      <PageIntro
        eyebrow="আপনার কার্ট"
        title="কার্ট"
        subtitle={`${pricing.itemCount}টি পণ্য · ডেলিভারি চার্জ চেকআউটে নিশ্চিত হবে।`}
        actions={<OutlineLink href={storePath(slug, "/shop")}>আরও কিনুন</OutlineLink>}
      />
      <CheckoutSteps current={1} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
            <h2 className="text-sm font-semibold">পণ্যসমূহ</h2>
            <span className="muted text-[11px]">{pricing.itemCount}টি আইটেম</span>
          </div>

          <ul className="divide-y divide-black/[0.06]">
            {pricing.lines.map((line) => {
              const variantLabel = Object.values(line.optionValues).filter(Boolean).join(" / ");
              return (
                <li key={line.itemId} className="flex gap-4 p-4 sm:p-5">
                  <Link
                    href={storePath(slug, `/product/${line.productSlug}`)}
                    className="h-24 w-20 shrink-0 overflow-hidden rounded-xl tone-surface ring-1 ring-black/[0.04]"
                  >
                    {line.imageUrl ? (
                      <ProductImage
                        src={line.imageUrl}
                        alt={line.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={storePath(slug, `/product/${line.productSlug}`)}
                          className="line-clamp-2 text-sm font-semibold hover:underline"
                        >
                          {line.productName}
                        </Link>
                        <p className="muted mt-0.5 text-[11px]">
                          {variantLabel ? `${variantLabel} · ` : ""}
                          {line.sku}
                        </p>
                        <p className="muted mt-0.5 text-[11px]">
                          একক দাম {formatBdt(line.unitPrice)}
                        </p>
                      </div>
                      <p
                        className="text-sm font-bold whitespace-nowrap"
                        style={{ color: "var(--store-primary)" }}
                      >
                        {formatBdt(line.lineTotal)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <CartLineControls
                        slug={slug}
                        storeId={storeId}
                        itemId={line.itemId}
                        quantity={line.quantity}
                        available={line.available}
                      />

                      <form action={removeLineFormAction}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="storeId" value={storeId} />
                        <input type="hidden" name="itemId" value={line.itemId} />
                        <button
                          type="submit"
                          className="muted inline-flex items-center gap-1 text-[11px] font-medium transition hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          সরান
                        </button>
                      </form>
                    </div>

                    {line.available < line.quantity ? (
                      <p className="text-[11px] font-medium text-red-600">
                        স্টকে মাত্র {line.available}টি আছে।
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Surface>

        <Surface className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold">অর্ডার সারসংক্ষেপ</h2>
          <p className="muted mt-0.5 text-[11px]">চেকআউটে ঠিকানা ও পেমেন্ট নিশ্চিত করুন।</p>

          <form action={applyCouponFormAction} className="mt-4">
            <label htmlFor="couponCode" className="muted mb-1.5 block text-[11px] font-medium">
              কুপন কোড
            </label>
            <div className="flex gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="storeId" value={storeId} />
              <div className="relative min-w-0 flex-1">
                <Tag className="muted pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  id="couponCode"
                  name="couponCode"
                  defaultValue={pricing.coupon?.code ?? ""}
                  placeholder="কুপন কোড লিখুন"
                  className="h-10 w-full rounded-lg border border-black/10 bg-white pr-3 pl-9 text-xs outline-none transition focus:border-[var(--store-primary)] focus:ring-2 focus:ring-black/5"
                />
              </div>
              <button
                type="submit"
                className="store-btn h-10 shrink-0 border border-black/10 px-3 text-xs font-semibold transition hover:bg-black/[0.03]"
              >
                প্রয়োগ
              </button>
            </div>
          </form>

          {pricing.couponError ? (
            <p className="mt-2 text-[11px] text-red-600">{pricing.couponError}</p>
          ) : null}
          {pricing.coupon ? (
            <p className="mt-2 text-[11px] text-emerald-700">
              কুপন প্রয়োগ হয়েছে — {formatBdt(pricing.coupon.amount)} ছাড়।
            </p>
          ) : null}

          <dl className="mt-5 space-y-2.5 border-t border-black/[0.06] pt-4 text-sm">
            <Row label="সাবটোটাল" value={formatBdt(pricing.subtotal)} />
            {pricing.coupon ? (
              <Row
                label={`ছাড় (${pricing.coupon.code})`}
                value={`− ${formatBdt(pricing.coupon.amount)}`}
              />
            ) : null}
            <Row
              label={pricing.zone ? `ডেলিভারি (${pricing.zone.name})` : "ডেলিভারি চার্জ"}
              value={pricing.shippingTotal === "0" ? "ফ্রি" : formatBdt(pricing.shippingTotal)}
            />
            {pricing.taxTotal !== "0.00" ? (
              <Row
                label={`ভ্যাট (${pricing.taxRatePercent}%${pricing.taxMode === "INCLUSIVE" ? ", অন্তর্ভুক্ত" : ""})`}
                value={formatBdt(pricing.taxTotal)}
              />
            ) : null}
            <div
              className="mt-2 flex items-baseline justify-between border-t border-black/[0.06] pt-3"
            >
              <dt className="text-sm font-semibold">সর্বমোট</dt>
              <dd className="text-xl font-bold" style={{ color: "var(--store-primary)" }}>
                {formatBdt(pricing.grandTotal)}
              </dd>
            </div>
          </dl>

          <Link
            href={storePath(slug, "/checkout")}
            className="store-btn mt-5 flex w-full items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            style={{ background: "var(--store-primary)" }}
          >
            চেকআউটে যান
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="muted mt-4 space-y-2 border-t border-black/[0.06] pt-4 text-[11px]">
            <span className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5" style={{ color: "var(--store-primary)" }} />
              ডেলিভারি চার্জ চেকআউটে দেখানো হবে
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--store-primary)" }} />
              নিরাপদ অর্ডার ও ক্যাশ অন ডেলিভারি
            </span>
            <span className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" style={{ color: "var(--store-primary)" }} />
              রিটার্ন নীতিতে ৭ দিনের সুযোগ
            </span>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
