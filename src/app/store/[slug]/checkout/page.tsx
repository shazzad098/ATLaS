import Link from "next/link";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CART_COOKIE, loadCart, listDeliveryZones, priceCart } from "@/lib/services/cart-service";
import { storefrontPaymentOptions } from "@/lib/services/store-service";
import { formatBdt } from "@/lib/money";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { CheckoutForm } from "@/app/store/[slug]/_components/checkout-form";

/** Checkout (FR-05). COD is the default; gateways redirect to a sandbox page. */

export const metadata = { title: "চেকআউট" };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const storeId = context.store.id;
  const sessionKey = (await cookies()).get(CART_COOKIE)?.value;
  const cart = sessionKey ? await loadCart(storeId, sessionKey) : null;

  if (!cart || cart.items.length === 0) redirect(storePath(slug, "/cart"));

  const [pricing, zones, providers] = await Promise.all([
    priceCart(storeId, cart),
    listDeliveryZones(storeId, { activeOnly: true }),
    storefrontPaymentOptions(storeId),
  ]);

  if (providers.length === 0) {
    return (
      <div className="atlas-shell py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-semibold">পেমেন্ট এখনো চালু হয়নি</h1>
          <p className="muted mt-2 text-sm">দোকানদার এখনো কোনো পেমেন্ট পদ্ধতি চালু করেননি।</p>
          <Link href={storePath(slug, "/cart")} className="mt-6 inline-block text-sm font-semibold hover:underline">
            কার্টে ফিরে যান
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-shell py-10">
      <h1 className="text-2xl font-semibold">চেকআউট</h1>
      <p className="muted mt-1 text-sm">
        মোট {pricing.itemCount}টি পণ্য · {formatBdt(pricing.grandTotal)}
      </p>

      <div className="mt-6">
        <CheckoutForm
          slug={slug}
          storeId={storeId}
          subtotal={pricing.subtotal}
          discountTotal={pricing.discountTotal}
          couponCode={pricing.coupon?.code ?? null}
          zones={zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            charge: String(zone.charge),
            freeAbove: zone.freeAbove === null ? null : String(zone.freeAbove),
          }))}
          providers={providers.map((provider) => ({
            value: provider.value,
            label: provider.label,
            note: provider.note,
          }))}
          idempotencyKey={randomUUID()}
        />
      </div>
    </div>
  );
}
