import Link from "next/link";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CreditCard } from "lucide-react";
import { CART_COOKIE, loadCart, listDeliveryZones, priceCart } from "@/lib/services/cart-service";
import { storefrontPaymentOptions } from "@/lib/services/store-service";
import { formatBdt } from "@/lib/money";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { getBuyerAccount } from "@/lib/services/customer-account";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { CheckoutForm } from "@/app/store/[slug]/_components/checkout-form";
import {
  CheckoutSteps,
  EmptyState,
  OutlineLink,
  PageIntro,
  StoreBreadcrumb,
  Surface,
} from "@/app/store/[slug]/_components/storefront-ui";

/** Checkout (FR-05). COD is the default; gateways redirect to a sandbox page. */

export const metadata = { title: "চেকআউট", robots: { index: false, follow: false } };

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

  // Signed-in buyers get their saved contact/address prefilled and the order is
  // attached to their account history.
  const buyer = await readBuyerSession(storeId);
  const account = buyer ? await getBuyerAccount(storeId, buyer.id).catch(() => null) : null;

  if (providers.length === 0) {
    return (
      <div className="atlas-shell py-8 sm:py-10">
        <StoreBreadcrumb
          slug={slug}
          items={[{ label: "হোম", href: "/" }, { label: "চেকআউট" }]}
        />
        <div className="mt-10">
          <EmptyState
            icon={CreditCard}
            title="পেমেন্ট এখনো চালু হয়নি"
            description="দোকানদার এখনো কোনো পেমেন্ট পদ্ধতি চালু করেননি। পরে আবার চেষ্টা করুন।"
            action={<OutlineLink href={storePath(slug, "/cart")}>কার্টে ফিরে যান</OutlineLink>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-shell py-8 sm:py-10">
      <StoreBreadcrumb
        slug={slug}
        items={[
          { label: "হোম", href: "/" },
          { label: "কার্ট", href: "/cart" },
          { label: "চেকআউট" },
        ]}
      />
      <PageIntro
        eyebrow="চেকআউট"
        title="অর্ডার নিশ্চিত করুন"
        subtitle={`মোট ${pricing.itemCount}টি পণ্য · ${formatBdt(pricing.grandTotal)}`}
      />
      <CheckoutSteps current={2} />

      <div className="mt-6">
        <Surface className="mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
          {account ? (
            <>
              <p>
                <strong>{account.name}</strong> হিসেবে লগইন আছেন — অর্ডার আপনার
                অ্যাকাউন্টে জমা হবে।
              </p>
              <Link href={storePath(slug, "/account/orders")} className="font-medium text-[var(--store-primary)] hover:underline">
                আমার অর্ডার
              </Link>
            </>
          ) : (
            <>
              <p className="muted">গেস্ট হিসেবে চেকআউট করছেন — অর্ডার ইতিহাস রাখতে অ্যাকাউন্ট খুলুন।</p>
              <Link
                href={`${storePath(slug, "/account/login")}?next=${encodeURIComponent(storePath(slug, "/checkout"))}`}
                className="font-medium text-[var(--store-primary)] hover:underline"
              >
                লগইন / অ্যাকাউন্ট
              </Link>
            </>
          )}
        </Surface>

        <CheckoutForm
          slug={slug}
          storeId={storeId}
          subtotal={pricing.subtotal}
          discountTotal={pricing.discountTotal}
          taxTotal={pricing.taxTotal}
          taxMode={pricing.taxMode}
          taxRatePercent={pricing.taxRatePercent}
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
          defaults={
            account
              ? {
                  name: account.name,
                  phone: account.phone,
                  email: account.email ?? "",
                  address: account.address,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
