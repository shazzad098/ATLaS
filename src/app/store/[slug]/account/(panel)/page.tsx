import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Heart, Package, ShoppingBag, Star } from "lucide-react";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { formatBdt } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  getBuyerAccount,
  getBuyerOrderStats,
  listBuyerOrders,
  listBuyerReviews,
  listWishlist,
} from "@/lib/services/customer-account";
import { ORDER_STATUS_LABEL, orderStatusTone } from "../_components/status";
import { Surface } from "@/app/store/[slug]/_components/storefront-ui";

export const metadata = { title: "আমার অ্যাকাউন্ট", robots: { index: false, follow: false } };

const TONE_CLASS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
  neutral: "bg-black/5 text-black/60",
};

export default async function BuyerDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) redirect(storePath(slug, "/account/login"));

  const [account, stats, orders, reviews, wishlist] = await Promise.all([
    getBuyerAccount(context.store.id, buyer.id),
    getBuyerOrderStats(context.store.id, buyer.id),
    listBuyerOrders(context.store.id, buyer.id, 3),
    listBuyerReviews(context.store.id, buyer.id),
    listWishlist(context.store.id, buyer.id),
  ]);

  const statsCards = [
    { label: "মোট অর্ডার", value: String(stats.totalOrders), icon: Package },
    { label: "চলমান অর্ডার", value: String(stats.openOrders), icon: ShoppingBag },
    { label: "মোট খরচ", value: formatBdt(stats.totalSpent), icon: Star },
    { label: "উইশলিস্ট", value: String(wishlist.length), icon: Heart },
  ];

  return (
    <div className="space-y-6">
      <header>
        <p
          className="text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "var(--store-primary)" }}
        >
          ড্যাশবোর্ড
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
          স্বাগতম, {buyer.name.split(" ")[0]}
        </h1>
        <p className="muted mt-1 text-sm">
          {context.store.name}-এ আপনার অর্ডার, মন্তব্য ও সেভ করা পণ্য এক জায়গায়।
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statsCards.map((card) => (
          <Surface key={card.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="muted text-[11px]">{card.label}</p>
              <span
                className="grid h-7 w-7 place-items-center rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--store-primary) 10%, white)",
                  color: "var(--store-primary)",
                }}
              >
                <card.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
            </div>
            <p className="mt-2 text-xl font-semibold tracking-tight">{card.value}</p>
          </Surface>
        ))}
      </div>

      {!account.address.line1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">
            ডেলিভারি ঠিকানা যোগ করলে পরের অর্ডার আরও দ্রুত হবে।
          </p>
          <Link
            href={storePath(slug, "/account/profile")}
            className="text-xs font-semibold text-amber-900 hover:underline"
          >
            ঠিকানা যোগ করুন →
          </Link>
        </div>
      ) : null}

      <Surface>
        <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
          <h2 className="text-sm font-semibold">সাম্প্রতিক অর্ডার</h2>
          <Link
            href={storePath(slug, "/account/orders")}
            className="text-[11px] font-medium text-[var(--store-primary)] hover:underline"
          >
            সব দেখুন
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">এখনো কোনো অর্ডার নেই</p>
            <p className="muted mt-1 text-xs">প্রথম অর্ডার করলে এখানেই ইতিহাস দেখতে পাবেন।</p>
            <Link
              href={storePath(slug, "/shop")}
              className="store-btn mt-4 inline-flex bg-[var(--store-primary)] px-4 py-2 text-xs font-semibold text-white"
            >
              কেনাকাটা শুরু করুন
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold">{order.orderNo}</p>
                  <p className="muted mt-0.5 text-[11px]">
                    {formatDate(order.placedAt)} · {order.itemCount}টি পণ্য · {formatBdt(order.total)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_CLASS[orderStatusTone(order.status)]}`}
                  >
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  <Link
                    href={`${storePath(slug, `/order/${order.orderNo}`)}?t=${encodeURIComponent(order.accessToken)}`}
                    className="text-[11px] font-medium text-[var(--store-primary)] hover:underline"
                  >
                    বিস্তারিত
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <div className="grid gap-4 sm:grid-cols-2">
        <Surface className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">আমার রিভিউ</h2>
            <Link
              href={storePath(slug, "/account/reviews")}
              className="text-[11px] font-medium text-[var(--store-primary)] hover:underline"
            >
              সব দেখুন
            </Link>
          </div>
          {reviews.length === 0 ? (
            <p className="muted mt-3 text-xs">
              পণ্য কিনে রিভিউ দিলে অন্য ক্রেতাদের সিদ্ধান্ত নিতে সাহায্য হবে।
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reviews.slice(0, 2).map((review) => (
                <li key={review.id} className="text-xs">
                  <p className="font-medium">{review.productName}</p>
                  <p className="muted mt-0.5">
                    {"★".repeat(review.rating)} · {review.body.slice(0, 60)}
                    {review.body.length > 60 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface className="p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">অ্যাকাউন্ট</h2>
            <Link
              href={storePath(slug, "/account/profile")}
              className="text-[11px] font-medium text-[var(--store-primary)] hover:underline"
            >
              সম্পাদনা
            </Link>
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex gap-2">
              <dt className="muted w-20 shrink-0">নাম</dt>
              <dd className="font-medium">{account.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="muted w-20 shrink-0">মোবাইল</dt>
              <dd className="font-medium">{account.phone}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="muted w-20 shrink-0">Email</dt>
              <dd className="truncate font-medium">{account.email ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="muted w-20 shrink-0">ঠিকানা</dt>
              <dd className="font-medium">{account.address.line1 || "যোগ করা হয়নি"}</dd>
            </div>
          </dl>
        </Surface>
      </div>
    </div>
  );
}
