import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { readBuyerSession } from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { listBuyerOrders } from "@/lib/services/customer-account";
import { ProductImage } from "@/components/product-image";
import { ORDER_STATUS_LABEL, orderStatusTone } from "../../_components/status";
import { Surface, EmptyState, PrimaryLink } from "@/app/store/[slug]/_components/storefront-ui";

export const metadata = { title: "আমার অর্ডার", robots: { index: false, follow: false } };

const TONE_CLASS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
  neutral: "bg-black/5 text-black/60",
};

export default async function BuyerOrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getStorefrontContext(slug);
  if (!context) notFound();

  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) redirect(storePath(slug, "/account/login"));

  const orders = await listBuyerOrders(context.store.id, buyer.id);

  return (
    <div className="space-y-5">
      <header>
        <p
          className="text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: "var(--store-primary)" }}
        >
          অর্ডার
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">আমার অর্ডার</h1>
        <p className="muted mt-1 text-sm">অর্ডারের অবস্থা, ডেলিভারি ও ইনভয়েস এক জায়গায়।</p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="কোনো অর্ডার নেই"
          description="কেনাকাটা করলে অর্ডার, ট্র্যাকিং ও ইনভয়েস এখানে জমা হবে।"
          action={<PrimaryLink href={storePath(slug, "/shop")}>দোকানে যান</PrimaryLink>}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Surface className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{order.orderNo}</p>
                  <p className="muted mt-0.5 text-[11px]">{formatDateTime(order.placedAt)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${TONE_CLASS[orderStatusTone(order.status)]}`}
                >
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <ul className="mt-3 space-y-2 border-t border-black/5 pt-3">
                {order.items.map((item, index) => (
                  <li key={`${order.id}-${index}`} className="flex items-center gap-3">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-black/5">
                      {item.imageUrl ? (
                        <ProductImage
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      {item.productSlug ? (
                        <Link
                          href={storePath(slug, `/product/${item.productSlug}`)}
                          className="line-clamp-1 text-xs font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <p className="line-clamp-1 text-xs font-medium">{item.name}</p>
                      )}
                      <p className="muted text-[11px]">পরিমাণ: {item.quantity}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3">
                <p className="text-sm font-semibold">{formatBdt(order.total)}</p>
                <div className="flex items-center gap-3">
                  <Link
                    href={`${storePath(slug, `/order/${order.orderNo}`)}?t=${encodeURIComponent(order.accessToken)}`}
                    className="text-xs font-medium text-[var(--store-primary)] hover:underline"
                  >
                    ট্র্যাক করুন
                  </Link>
                  <Link
                    href={`${storePath(slug, `/order/${order.orderNo}/invoice`)}?t=${encodeURIComponent(order.accessToken)}`}
                    className="text-xs font-medium text-[var(--store-primary)] hover:underline"
                  >
                    ইনভয়েস
                  </Link>
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
