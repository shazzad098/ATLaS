import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireActiveStore } from "@/lib/tenant";
import { monthBounds } from "@/lib/dates";
import { formatDate } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { publishReadiness, listStores } from "@/lib/services/store-service";
import { countsByStatus, orderMetrics, recentOrders, ORDER_STATUS_LABELS } from "@/lib/services/order-service";
import { feeSummary } from "@/lib/services/fee-service";
import { Badge, Card, CardBody, CardHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { publishStoreAction, unpublishStoreAction } from "@/app/admin/actions";
import { storePath } from "@/lib/storefront";

/** Merchant dashboard (FR-10): KPIs, publish checklist, recent activity. */

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  CONFIRMED: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "neutral",
  RETURNED: "neutral",
};

export default async function AdminDashboard() {
  const { workspace, store } = await requireActiveStore();
  const { start, end } = monthBounds();

  const [checks, metrics, counts, recent, fees, stores, lowStock] = await Promise.all([
    publishReadiness(store.id),
    orderMetrics(store.id, { from: start, to: end }),
    countsByStatus(store.id),
    recentOrders(store.id, 8),
    feeSummary(workspace.activeTenant.tenantId),
    listStores(workspace.activeTenant.tenantId),
    prisma.productVariant.findMany({
      where: { status: "ACTIVE", product: { storeId: store.id, deletedAt: null } },
      select: { id: true, sku: true, stockQty: true, reservedQty: true, product: { select: { name: true, slug: true, lowStockThreshold: true } } },
      take: 400,
    }),
  ]);

  const ready = checks.filter((check) => check.ok).length;
  const allReady = ready === checks.length;
  const lowStockItems = lowStock
    .filter((variant) => variant.stockQty - variant.reservedQty <= variant.product.lowStockThreshold)
    .sort((a, b) => a.stockQty - a.reservedQty - (b.stockQty - b.reservedQty))
    .slice(0, 8);

  const pendingOrders = counts
    .filter((row) => ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(row.status))
    .reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{store.name}</h1>
          <p className="text-sm text-ink-500">
            {store.status === "PUBLISHED" ? (
              <>
                Live —{" "}
                <Link href={storePath(store.slug)} target="_blank" className="font-medium text-brand-700 hover:underline">
                  /store/{store.slug}
                </Link>
              </>
            ) : (
              "Draft — publish করলে ক্রেতারা দেখতে পাবেন।"
            )}
          </p>
        </div>

        {store.status === "PUBLISHED" ? (
          <FormButton action={unpublishStoreAction} fields={{ storeId: store.id }} variant="outline">
            Unpublish
          </FormButton>
        ) : (
          <FormButton
            action={publishStoreAction}
            fields={{ storeId: store.id, slug: store.slug }}
            disabled={!allReady}
            title={allReady ? undefined : "চেকলিস্ট সম্পূর্ণ করুন"}
          >
            Publish করুন
          </FormButton>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="এই মাসের আয়" value={formatBdt(metrics.revenue)} hint={`${metrics.orderCount}টি অর্ডার`} />
        <Stat label="গড় অর্ডার" value={formatBdt(metrics.averageOrderValue)} hint="মাসিক গড়" />
        <Stat label="প্রক্রিয়াধীন অর্ডার" value={pendingOrders} hint="চলমান" tone="warning" />
        <Stat
          label="বকেয়া প্ল্যাটফর্ম ফি"
          value={formatBdt(fees.pending)}
          hint={fees.pending === "0.00" ? "পরিশোধিত" : "ইনভয়েস হবে"}
          tone={fees.pending === "0.00" ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="Publish চেকলিস্ট"
            description={`${ready} / ${checks.length} সম্পন্ন`}
            action={allReady ? <Badge tone="success">প্রস্তুত</Badge> : null}
          />
          <CardBody className="space-y-2">
            {checks.map((check) => (
              <div key={check.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="flex items-start gap-2">
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
                  )}
                  <span className={check.ok ? "text-ink-600" : "font-medium text-ink-900"}>{check.label}</span>
                </span>
                {!check.ok ? (
                  <Link href={check.href} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">
                    ঠিক করুন
                  </Link>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="সাম্প্রতিক অর্ডার"
            action={
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
              >
                সব দেখুন <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {recent.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এখনো কোনো অর্ডার আসেনি। দোকান publish করে শেয়ার করুন।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>অর্ডার</Th>
                  <Th>ক্রেতা</Th>
                  <Th>স্ট্যাটাস</Th>
                  <Th className="text-right">মোট</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id}>
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium whitespace-nowrap text-brand-700 hover:underline"
                      >
                        {order.orderNo}
                      </Link>
                      <span className="block text-xs text-ink-400">{formatDate(order.placedAt)}</span>
                    </Td>
                    <Td>
                      {order.customerName}
                      <span className="block text-xs text-ink-400">{order.paymentProvider}</span>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>
                        {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium">{formatBdt(order.grandTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="কম স্টক সতর্কতা"
            description="low-stock threshold-এর নিচে"
            action={
              lowStockItems.length > 0 ? (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" /> {lowStockItems.length}
                </Badge>
              ) : null
            }
          />
          {lowStockItems.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">সব পণ্যের স্টক পর্যাপ্ত আছে।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>পণ্য</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">উপলব্ধ</Th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((variant) => (
                  <tr key={variant.id}>
                    <Td>
                      <Link
                        href={`/admin/products?q=${encodeURIComponent(variant.product.name)}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {variant.product.name}
                      </Link>
                    </Td>
                    <Td className="text-xs text-ink-500">{variant.sku}</Td>
                    <Td className="text-right">
                      <Badge tone={variant.stockQty - variant.reservedQty <= 0 ? "danger" : "warning"}>
                        {variant.stockQty - variant.reservedQty}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="ফি সারসংক্ষেপ" description="প্ল্যাটফর্ম চার্জ ও কুরিয়ার ফি" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-500">বকেয়া</p>
                <p className="font-semibold">{formatBdt(fees.pending)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">ইনভয়েসড</p>
                <p className="font-semibold">{formatBdt(fees.invoiced)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500">ফেরত</p>
                <p className="font-semibold">{formatBdt(fees.reversed)}</p>
              </div>
            </div>

            {fees.byType.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {fees.byType.map((row) => (
                  <li key={row.feeType} className="flex justify-between">
                    <span className="text-ink-500">
                      {row.feeType} · {row.count}টি
                    </span>
                    <span className="font-medium">{formatBdt(row.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">এই মাসে কোনো ফি নেই।</p>
            )}

            <Link href="/admin/billing" className="inline-block text-xs font-semibold text-brand-700 hover:underline">
              বিলিং ও ইনভয়েস দেখুন →
            </Link>
          </CardBody>
        </Card>
      </div>

      {stores.length > 1 ? (
        <Card>
          <CardHeader title="আপনার দোকানসমূহ" description={`${stores.length}টি store`} />
          <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((item) => (
              <div key={item.id} className="rounded-lg border border-ink-200 p-3">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-ink-500">/store/{item.slug}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                  <Badge tone={item.status === "PUBLISHED" ? "success" : "warning"}>{item.status}</Badge>
                  <span>{item._count.products} পণ্য</span>
                  <span>·</span>
                  <span>{item._count.orders} অর্ডার</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
