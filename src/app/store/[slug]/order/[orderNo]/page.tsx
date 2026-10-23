import Link from "next/link";
import { notFound } from "next/navigation";
import { findPublicOrder } from "@/lib/services/order-service";
import { formatBdt } from "@/lib/money";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { Badge, type Tone } from "@/components/ui/shell";

/** Order confirmation / tracking (FR-05, US-06). */

export const metadata = { title: "অর্ডার" };

const STATUS_TONE: Record<string, Tone> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "পেমেন্ট বাকি",
  PAID: "পরিশোধিত",
  CONFIRMED: "নিশ্চিত হয়েছে",
  PROCESSING: "প্রস্তুত হচ্ছে",
  SHIPPED: "পাঠানো হয়েছে",
  DELIVERED: "পৌঁছে দেওয়া হয়েছে",
  CANCELLED: "বাতিল",
  REFUNDED: "ফেরত",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "বাকি",
  AUTHORIZED: "অনুমোদিত",
  PAID: "পরিশোধিত",
  FAILED: "ব্যর্থ",
  REFUNDED: "ফেরত",
  PARTIALLY_REFUNDED: "আংশিক ফেরত",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderNo: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { slug, orderNo } = await params;
  const { phone } = await searchParams;

  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const order = await findPublicOrder(context.store.id, orderNo, phone);
  if (!order) notFound();

  const address = order.addressSnapshotJson as {
    line1?: string;
    line2?: string;
    area?: string;
    city?: string;
    district?: string;
    postcode?: string;
  };

  return (
    <div className="atlas-shell py-10">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-black/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="muted text-xs font-semibold uppercase tracking-wide">অর্ডার নম্বর</p>
              <h1 className="text-2xl font-semibold">{order.orderNo}</h1>
              <p className="muted mt-1 text-sm">
                {new Intl.DateTimeFormat("bn-BD", { dateStyle: "long", timeStyle: "short" }).format(order.placedAt)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                {STATUS_LABEL[order.status] ?? order.status}
              </Badge>
              <span className="muted text-xs">
                পেমেন্ট: {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus} · {order.paymentProvider}
              </span>
            </div>
          </div>

          <ul className="mt-6 divide-y divide-black/10">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{item.nameSnapshot}</p>
                  <p className="muted text-xs">
                    {item.skuSnapshot ? `SKU: ${item.skuSnapshot} · ` : ""}পরিমাণ {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatBdt(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-black/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="muted">সাবটোটাল</dt>
              <dd>{formatBdt(order.subtotal)}</dd>
            </div>
            {Number(order.discountTotal) > 0 ? (
              <div className="flex justify-between">
                <dt className="muted">ছাড়{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                <dd>− {formatBdt(order.discountTotal)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="muted">ডেলিভারি চার্জ</dt>
              <dd>{formatBdt(order.shippingTotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-black/10 pt-3">
              <dt className="font-semibold">সর্বমোট</dt>
              <dd className="text-lg font-bold" style={{ color: "var(--store-primary)" }}>
                {formatBdt(order.grandTotal)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 p-5 text-sm">
            <h2 className="text-sm font-semibold">ডেলিভারি ঠিকানা</h2>
            <p className="muted mt-2 leading-relaxed">
              {order.customerName}
              <br />
              {order.customerPhone}
              <br />
              {[address.line1, address.line2, address.area, address.city, address.district, address.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>

          <div className="rounded-xl border border-black/10 p-5">
            <h2 className="text-sm font-semibold">অর্ডার টাইমলাইন</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: "var(--store-primary)" }}
                  />
                  <span>
                    <span className="font-medium">{STATUS_LABEL[event.toStatus] ?? event.toStatus}</span>
                    <span className="muted block text-xs">
                      {new Intl.DateTimeFormat("bn-BD", { dateStyle: "medium", timeStyle: "short" }).format(
                        event.createdAt,
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href={storePath(slug, "/shop")}
            className="store-btn inline-block px-6 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--store-primary)" }}
          >
            আরও কেনাকাটা করুন
          </Link>
        </div>
      </div>
    </div>
  );
}
