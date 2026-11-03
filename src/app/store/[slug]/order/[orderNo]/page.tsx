import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Download,
  HelpCircle,
  Lock,
  MapPin,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import { findPublicOrder } from "@/lib/services/order-service";
import { formatBdt } from "@/lib/money";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import {
  OutlineLink,
  StoreBreadcrumb,
  Surface,
} from "@/app/store/[slug]/_components/storefront-ui";

/** Order confirmation / tracking (FR-05, US-06). */

export const metadata = { title: "অর্ডার", robots: { index: false, follow: false } };

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

const STATUS_RANK: Record<string, number> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  CONFIRMED: 1,
  PROCESSING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};

const TRACK_STEPS = [
  { label: "অর্ডার দেওয়া", icon: Package },
  { label: "নিশ্চিত", icon: CheckCircle2 },
  { label: "প্রস্তুত", icon: Package },
  { label: "পাঠানো", icon: Truck },
  { label: "ডেলিভারি", icon: CheckCircle2 },
];

function statusTone(status: string): string {
  if (status === "DELIVERED" || status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED" || status === "REFUNDED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "PENDING_PAYMENT") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderNo: string }>;
  searchParams: Promise<{ phone?: string; t?: string }>;
}) {
  const { slug, orderNo } = await params;
  const { phone, t } = await searchParams;

  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const order = await findPublicOrder(context.store.id, orderNo, { phone, token: t });
  if (!order) {
    // Deliberately render the same verification prompt whether the order is
    // missing or the supplied phone is wrong: neither the customer's details
    // nor the order's existence may leak from this page.
    return (
      <div className="atlas-shell py-8 sm:py-10">
        <StoreBreadcrumb
          slug={slug}
          items={[{ label: "হোম", href: "/" }, { label: "অর্ডার ট্র্যাক" }]}
        />
        <div className="mt-10">
          <Surface className="mx-auto max-w-md p-6 sm:p-7">
            <span
              className="grid h-11 w-11 place-items-center rounded-2xl"
              style={{
                background: "color-mix(in srgb, var(--store-primary) 10%, white)",
                color: "var(--store-primary)",
              }}
            >
              <Lock className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h1 className="mt-4 text-xl font-semibold">অর্ডার ট্র্যাক করুন</h1>
            <p className="muted mt-1.5 text-sm leading-relaxed">
              নিরাপত্তার জন্য অর্ডারটি দেখতে যে মোবাইল নম্বর দিয়ে অর্ডার করা হয়েছে সেটি দিন।
            </p>
            {phone ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                এই নম্বরের সঙ্গে কোনো অর্ডার মেলেনি। আবার চেষ্টা করুন।
              </p>
            ) : null}
            <form method="get" className="mt-5 space-y-3">
              <label className="block text-xs font-medium" htmlFor="order-phone">
                মোবাইল নম্বর
              </label>
              <input
                id="order-phone"
                name="phone"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                className="h-11 w-full rounded-xl border border-black/10 px-3 text-sm outline-none transition focus:border-[var(--store-primary)] focus:ring-2 focus:ring-black/5"
              />
              <button
                type="submit"
                className="store-btn w-full px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: "var(--store-primary)" }}
              >
                অর্ডার দেখুন
              </button>
            </form>
          </Surface>
        </div>
      </div>
    );
  }

  // `?print=1` opens the browser's print dialog so the invoice can be saved as
  // a PDF; the invoice route renders a standalone, layout-free A4 document.
  // The signed token (or the verified phone) is forwarded so the invoice route
  // applies the same access check.
  const invoiceHref = `${storePath(slug, `/order/${orderNo}/invoice`)}?print=1${
    t ? `&t=${encodeURIComponent(t)}` : phone ? `&phone=${encodeURIComponent(phone)}` : ""
  }`;

  const address = order.addressSnapshotJson as {
    line1?: string;
    line2?: string;
    area?: string;
    city?: string;
    district?: string;
    postcode?: string;
  };

  const cancelled = order.status === "CANCELLED" || order.status === "REFUNDED";
  const reached = cancelled ? 0 : (STATUS_RANK[order.status] ?? 0);

  return (
    <div className="atlas-shell py-8 sm:py-10">
      <StoreBreadcrumb
        slug={slug}
        items={[{ label: "হোম", href: "/" }, { label: order.orderNo }]}
      />

      <Surface className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: "var(--store-primary)" }}
            >
              {cancelled ? <XCircle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
            </span>
            <div>
              <p className="muted text-[10px] font-semibold tracking-[0.16em] uppercase">
                অর্ডার নম্বর
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{order.orderNo}</h1>
              <p className="muted mt-1 text-xs">
                {new Intl.DateTimeFormat("bn-BD", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(order.placedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone(order.status)}`}
            >
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            <span className="muted text-[11px]">
              পেমেন্ট: {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus} ·{" "}
              {order.paymentProvider}
            </span>
            <a
              href={invoiceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition hover:bg-black/5"
              style={{ color: "var(--store-primary)", borderColor: "var(--store-primary)" }}
            >
              <Download className="h-3.5 w-3.5" />
              ইনভয়েস ডাউনলোড (PDF)
            </a>
          </div>
        </div>

        {!cancelled ? (
          <div className="border-t border-black/[0.06] bg-black/[0.012] px-6 py-5 sm:px-7">
            <ol className="flex items-start justify-between gap-1">
              {TRACK_STEPS.map((step, index) => {
                const done = index <= reached;
                const active = index === reached;
                const Icon = step.icon;
                return (
                  <li key={step.label} className="flex flex-1 flex-col items-center text-center">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full border text-[10px] font-bold"
                      style={
                        done
                          ? {
                              background: "var(--store-primary)",
                              borderColor: "var(--store-primary)",
                              color: "#fff",
                            }
                          : { borderColor: "rgba(0,0,0,0.14)", color: "rgba(0,0,0,0.45)" }
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span
                      className={`mt-1.5 text-[9px] leading-tight sm:text-[10px] ${
                        active ? "font-semibold" : "muted"
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-xs text-red-700 sm:px-7">
            এই অর্ডারটি {order.status === "REFUNDED" ? "রিফান্ড" : "বাতিল"} করা হয়েছে। সহায়তার
            জন্য দোকানের সাথে যোগাযোগ করুন।
          </div>
        )}
      </Surface>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
            <h2 className="text-sm font-semibold">অর্ডারের পণ্য</h2>
            <span className="muted text-[11px]">{order.items.length}টি আইটেম</span>
          </div>
          <ul className="divide-y divide-black/[0.06]">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="muted grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/[0.03]">
                    <Package className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.nameSnapshot}</p>
                    <p className="muted mt-0.5 text-[11px]">
                      {item.skuSnapshot ? `${item.skuSnapshot} · ` : ""}পরিমাণ {item.quantity}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold">{formatBdt(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-black/[0.06] px-5 py-4 text-sm">
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
            {Number(order.taxTotal) > 0 ? (
              <div className="flex justify-between">
                <dt className="muted">ভ্যাট</dt>
                <dd>{formatBdt(order.taxTotal)}</dd>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-black/[0.06] pt-3">
              <dt className="font-semibold">সর্বমোট</dt>
              <dd className="text-xl font-bold" style={{ color: "var(--store-primary)" }}>
                {formatBdt(order.grandTotal)}
              </dd>
            </div>
          </dl>
        </Surface>

        <div className="space-y-4">
          <Surface className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
              ডেলিভারি ঠিকানা
            </h2>
            <p className="muted mt-2 text-xs leading-relaxed">
              {order.customerName}
              <br />
              {order.customerPhone}
              <br />
              {[address.line1, address.line2, address.area, address.city, address.district, address.postcode]
                .filter(Boolean)
                .join(", ")}
            </p>
          </Surface>

          <Surface className="p-5">
            <h2 className="text-sm font-semibold">অর্ডার টাইমলাইন</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: "var(--store-primary)" }}
                  />
                  <span>
                    <span className="text-xs font-medium">
                      {STATUS_LABEL[event.toStatus] ?? event.toStatus}
                    </span>
                    <span className="muted block text-[10px]">
                      {new Intl.DateTimeFormat("bn-BD", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(event.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Surface>

          <Surface className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="h-4 w-4" style={{ color: "var(--store-primary)" }} />
              সহায়তা দরকার?
            </h2>
            <p className="muted mt-1.5 text-xs leading-relaxed">
              অর্ডার নম্বরসহ দোকানের সাথে যোগাযোগ করুন।
            </p>
            <Link
              href={storePath(slug, "/page/contact")}
              className="mt-3 inline-flex text-xs font-semibold hover:underline"
              style={{ color: "var(--store-primary)" }}
            >
              যোগাযোগের তথ্য দেখুন
            </Link>
          </Surface>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href={storePath(slug, "/shop")}
          className="store-btn inline-flex px-6 py-3 text-sm font-semibold text-white"
          style={{ background: "var(--store-primary)" }}
        >
          আরও কেনাকাটা করুন
        </Link>
        <OutlineLink href={storePath(slug, "/account/orders")}>আমার অর্ডার</OutlineLink>
      </div>
    </div>
  );
}
