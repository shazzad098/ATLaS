import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CART_COOKIE, loadCart, priceCart } from "@/lib/services/cart-service";
import { formatBdt } from "@/lib/money";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import {
  applyCouponFormAction,
  removeLineFormAction,
  setLineQuantityFormAction,
} from "@/app/store/[slug]/actions";

/** Cart page (FR-04). Prices are recomputed from the database on every render. */

export const metadata = { title: "কার্ট" };

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
      <div className="atlas-shell py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold">আপনার কার্ট খালি</h1>
          <p className="muted mt-2 text-sm">পছন্দের পণ্য যোগ করে কেনাকাটা শুরু করুন।</p>
          <Link
            href={storePath(slug, "/shop")}
            className="store-btn mt-6 inline-block px-6 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            পণ্য দেখুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-shell py-10">
      <h1 className="text-2xl font-semibold">আপনার কার্ট</h1>
      <p className="muted mt-1 text-sm">{pricing.itemCount}টি পণ্য</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <ul className="divide-y divide-black/10">
          {pricing.lines.map((line) => {
            const variantLabel = Object.values(line.optionValues).filter(Boolean).join(" / ");
            return (
              <li key={line.itemId} className="flex gap-4 py-4">
                <Link
                  href={storePath(slug, `/product/${line.productSlug}`)}
                  className="h-24 w-20 shrink-0 overflow-hidden rounded-lg tone-surface"
                >
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt={line.productName} className="h-full w-full object-cover" />
                  ) : null}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={storePath(slug, `/product/${line.productSlug}`)}
                        className="line-clamp-2 text-sm font-medium hover:underline"
                      >
                        {line.productName}
                      </Link>
                      {variantLabel ? <p className="muted mt-0.5 text-xs">{variantLabel}</p> : null}
                      <p className="muted text-xs">SKU: {line.sku}</p>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--store-primary)" }}>
                      {formatBdt(line.lineTotal)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <form action={setLineQuantityFormAction} className="flex items-center rounded-full border border-black/15">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="storeId" value={storeId} />
                      <input type="hidden" name="itemId" value={line.itemId} />
                      <button
                        type="submit"
                        name="quantity"
                        value={Math.max(1, line.quantity - 1)}
                        className="grid h-8 w-8 place-items-center text-base leading-none"
                        aria-label="কমান"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-sm font-semibold">{line.quantity}</span>
                      <button
                        type="submit"
                        name="quantity"
                        value={Math.min(line.available > 0 ? line.available : line.quantity + 1, line.quantity + 1)}
                        className="grid h-8 w-8 place-items-center text-base leading-none"
                        aria-label="বাড়ান"
                      >
                        +
                      </button>
                    </form>

                    <form action={removeLineFormAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="storeId" value={storeId} />
                      <input type="hidden" name="itemId" value={line.itemId} />
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        সরান
                      </button>
                    </form>
                  </div>

                  {line.available < line.quantity ? (
                    <p className="text-xs font-medium text-red-600">স্টকে মাত্র {line.available}টি আছে।</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit rounded-xl border border-black/10 p-5">
          <h2 className="text-base font-semibold">অর্ডার সারসংক্ষেপ</h2>

          <form action={applyCouponFormAction} className="mt-4 flex gap-2">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="storeId" value={storeId} />
            <input
              name="couponCode"
              defaultValue={pricing.coupon?.code ?? ""}
              placeholder="কুপন কোড"
              className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="store-btn shrink-0 border border-black/15 px-3 py-2 text-xs font-semibold"
            >
              প্রয়োগ
            </button>
          </form>

          {pricing.couponError ? <p className="mt-2 text-xs text-red-600">{pricing.couponError}</p> : null}

          <dl className="mt-5 space-y-2 text-sm">
            <Row label="সাবটোটাল" value={formatBdt(pricing.subtotal)} />
            {pricing.coupon ? (
              <Row label={`ছাড় (${pricing.coupon.code})`} value={`− ${formatBdt(pricing.coupon.amount)}`} />
            ) : null}
            <Row
              label={pricing.zone ? `ডেলিভারি চার্জ (${pricing.zone.name})` : "ডেলিভারি চার্জ"}
              value={pricing.shippingTotal === "0" ? "ফ্রি" : formatBdt(pricing.shippingTotal)}
            />
            <div className="flex items-baseline justify-between border-t border-black/10 pt-3">
              <dt className="text-sm font-semibold">সর্বমোট</dt>
              <dd className="text-lg font-bold" style={{ color: "var(--store-primary)" }}>
                {formatBdt(pricing.grandTotal)}
              </dd>
            </div>
          </dl>

          <Link
            href={storePath(slug, "/checkout")}
            className="store-btn mt-5 block px-6 py-3 text-center text-sm font-semibold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            চেকআউটে যান
          </Link>
          <Link
            href={storePath(slug, "/shop")}
            className="mt-3 block text-center text-xs font-medium hover:underline"
          >
            আরও কেনাকাটা করুন
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
