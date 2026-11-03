import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Boxes, PackageCheck } from "lucide-react";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { addDays, bnDayLabel, bnNumber, dhakaDateKey, formatDateTime } from "@/lib/dates";
import {
  inventoryTotals,
  listMovements,
  lowStockVariants,
} from "@/lib/services/inventory-service";
import { formatBdt } from "@/lib/money";
import { prisma } from "@/lib/db";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { ButtonLink } from "@/components/ui/button";
import { StockAdjustForm } from "@/app/admin/_components/stock-adjust-form";

/**
 * Inventory ledger (FR-03, PRD §10.3).
 *
 * Stock is never overwritten: every change writes an `InventoryMovement` with a
 * reason, and checkout reservations are visible as `reservedQty`. This page is
 * the audit view of that ledger plus the low-stock worklist.
 *
 * Charts are server-rendered with CSS (no JS library): stock health donut,
 * per-product stock bars and a 14-day stock-flow chart, all Asia/Dhaka based.
 */

export const metadata: Metadata = { title: "ইনভেন্টরি" };

const MOVEMENT_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  INITIAL: "info",
  RESTOCK: "success",
  IMPORT: "info",
  RETURN: "success",
  ADJUSTMENT: "warning",
  SALE: "neutral",
  RESERVATION: "warning",
  RESERVATION_RELEASE: "neutral",
};

export default async function InventoryPage() {
  const { store } = await requireActiveStorePermissionPage("catalog:read");
  const now = new Date();
  const flowFrom = addDays(now, -13);
  const flowKeys = Array.from({ length: 14 }, (_, index) => dhakaDateKey(addDays(now, index - 13)));

  const [totals, movements, low, variants, flowRows] = await Promise.all([
    inventoryTotals(store.id),
    listMovements(store.id, { limit: 40 }),
    lowStockVariants(store.id, 5, 12),
    prisma.productVariant.findMany({
      where: { product: { storeId: store.id, deletedAt: null }, status: "ACTIVE" },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      take: 400,
      select: {
        id: true,
        sku: true,
        stockQty: true,
        reservedQty: true,
        price: true,
        product: { select: { name: true, lowStockThreshold: true } },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: { storeId: store.id, createdAt: { gte: flowFrom } },
      select: { createdAt: true, quantityDelta: true },
    }),
  ]);

  const stockValue = variants.reduce(
    (sum, variant) => sum + Number(variant.price) * Math.max(0, variant.stockQty - variant.reservedQty),
    0,
  );

  // ── Stock health (out / low / healthy variants) ──────────────────────────────

  let outCount = 0;
  let lowCount = 0;
  for (const variant of variants) {
    const available = variant.stockQty - variant.reservedQty;
    const threshold = variant.product.lowStockThreshold ?? 5;
    if (available <= 0) outCount += 1;
    else if (available <= threshold) lowCount += 1;
  }
  const activeSku = variants.length;
  const healthyCount = Math.max(0, activeSku - outCount - lowCount);

  // conic-gradient stops; a slice of 0 is skipped in the style string.
  const healthSlices = [
    { key: "healthy", count: healthyCount, color: "#0d9488", label: "স্বাভাবিক" },
    { key: "low", count: lowCount, color: "#f59e0b", label: "কম স্টক" },
    { key: "out", count: outCount, color: "#dc2626", label: "শেষ" },
  ].filter((slice) => slice.count > 0);
  const healthTotal = healthSlices.reduce((sum, slice) => sum + slice.count, 0);
  let healthCursor = 0;
  const conicStops = healthSlices
    .map((slice) => {
      const start = (healthCursor / Math.max(1, healthTotal)) * 360;
      healthCursor += slice.count;
      const end = (healthCursor / Math.max(1, healthTotal)) * 360;
      return `${slice.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
    })
    .join(", ");

  // ── Stock by product (top products by units in stock) ────────────────────────

  const byProduct = new Map<string, { name: string; available: number; reserved: number; value: number }>();
  for (const variant of variants) {
    const available = Math.max(0, variant.stockQty - variant.reservedQty);
    const entry = byProduct.get(variant.product.name) ?? {
      name: variant.product.name,
      available: 0,
      reserved: 0,
      value: 0,
    };
    entry.available += available;
    entry.reserved += variant.reservedQty;
    entry.value += Number(variant.price) * available;
    byProduct.set(variant.product.name, entry);
  }
  const productBars = [...byProduct.values()]
    .sort((a, b) => b.available + b.reserved - (a.available + a.reserved))
    .slice(0, 8);
  const productPeak = Math.max(1, ...productBars.map((row) => row.available + row.reserved));

  // ── Stock flow (last 14 days: units in vs units out) ─────────────────────────

  const flowByDay = new Map<string, { inUnits: number; outUnits: number }>();
  for (const row of flowRows) {
    const key = dhakaDateKey(row.createdAt);
    const bucket = flowByDay.get(key) ?? { inUnits: 0, outUnits: 0 };
    if (row.quantityDelta > 0) bucket.inUnits += row.quantityDelta;
    else if (row.quantityDelta < 0) bucket.outUnits += Math.abs(row.quantityDelta);
    flowByDay.set(key, bucket);
  }
  const flowPeak = Math.max(
    1,
    ...flowKeys.map((key) => {
      const bucket = flowByDay.get(key);
      return Math.max(bucket?.inUnits ?? 0, bucket?.outUnits ?? 0);
    }),
  );
  const flowTotalIn = flowRows.filter((row) => row.quantityDelta > 0).reduce((sum, row) => sum + row.quantityDelta, 0);
  const flowTotalOut = flowRows
    .filter((row) => row.quantityDelta < 0)
    .reduce((sum, row) => sum + Math.abs(row.quantityDelta), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="ইনভেন্টরি"
        description="প্রতিটি স্টক পরিবর্তন লেজারে থাকে — সরাসরি overwrite হয় না।"
        action={
          <ButtonLink href="/admin/products/import" variant="outline" size="sm">
            CSV import
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="মোট SKU" value={totals.skuCount} hint={<Badge tone="neutral"><Boxes className="h-3 w-3" /> active</Badge>} />
        <Stat label="মোট স্টক" value={totals.totalStock} hint="সব variant" />
        <Stat label="রিজার্ভড" value={totals.totalReserved} hint="চেকআউট চলছে" tone="warning" />
        <Stat label="স্টক মূল্য" value={formatBdt(stockValue)} hint="বিক্রয়মূল্যে" />
      </div>

      {/* Health donut + per-product stock chart */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="স্টক অবস্থা" description={`active ${bnNumber(activeSku)}টি variant`} />
          <CardBody className="flex items-center gap-5">
            {activeSku === 0 ? (
              <p className="text-sm text-ink-500">কোনো active variant নেই।</p>
            ) : (
              <>
                <div
                  className="relative h-32 w-32 shrink-0 rounded-full"
                  style={{ background: `conic-gradient(${conicStops})` }}
                >
                  <div className="absolute inset-[14%] grid place-items-center rounded-full bg-white shadow-inner">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-ink-900">{bnNumber(activeSku)}</p>
                      <p className="text-[10px] text-ink-400">variant</p>
                    </div>
                  </div>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#0d9488]" />
                    <span className="text-ink-600">স্বাভাবিক</span>
                    <span className="ml-auto font-semibold">{bnNumber(healthyCount)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />
                    <span className="text-ink-600">কম স্টক</span>
                    <span className="ml-auto font-semibold">{bnNumber(lowCount)}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#dc2626]" />
                    <span className="text-ink-600">স্টক শেষ</span>
                    <span className="ml-auto font-semibold">{bnNumber(outCount)}</span>
                  </li>
                </ul>
              </>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="পণ্যভিত্তিক স্টক"
            description="সর্বোচ্চ ৮টি পণ্য — উপলব্ধ ও রিজার্ভড ইউনিট"
          />
          {productBars.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">কোনো active product নেই।</p>
            </CardBody>
          ) : (
            <CardBody className="space-y-3">
              {productBars.map((row) => {
                return (
                  <div key={row.name} title={`${row.name} — উপলব্ধ ${bnNumber(row.available)} · রিজার্ভড ${bnNumber(row.reserved)} · মূল্য ${formatBdt(row.value)}`}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="max-w-[60%] truncate font-medium text-ink-800">{row.name}</span>
                      <span className="text-ink-500">
                        {bnNumber(row.available)} ইউনিট · {formatBdt(row.value)}
                      </span>
                    </div>
                    <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${(row.available / productPeak) * 100}%` }}
                      />
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${(row.reserved / productPeak) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 pt-3 text-xs text-ink-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3 rounded-sm bg-brand-500" /> উপলব্ধ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-3 rounded-sm bg-amber-400" /> রিজার্ভড (চেকআউট)
                </span>
                <span className="ml-auto text-ink-400">দৈর্ঘ্য = মোট স্টক স্কেল</span>
              </div>
            </CardBody>
          )}
        </Card>
      </div>

      {/* Stock flow + low stock */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="স্টক চলাচল"
            description="গত ১৪ দিন · কোন দিনে কত পণ্ন ঢুকেছে বা বিক্রি হয়েছে (Asia/Dhaka)"
            action={<Badge tone="neutral">+{bnNumber(flowTotalIn)} / −{bnNumber(flowTotalOut)}</Badge>}
          />
          <CardBody>
            {flowTotalIn === 0 && flowTotalOut === 0 ? (
              <p className="text-sm text-ink-500">এই ১৪ দিনে কোনো স্টক চলাচল হয়নি।</p>
            ) : (
              <>
                <div className="flex h-36 items-end gap-1">
                  {flowKeys.map((key) => {
                    const bucket = flowByDay.get(key);
                    const inUnits = bucket?.inUnits ?? 0;
                    const outUnits = bucket?.outUnits ?? 0;
                    return (
                      <div
                        key={key}
                        className="flex h-full flex-1 flex-col justify-end gap-px"
                        title={`${bnDayLabel(key)} — ঢুকেছে ${bnNumber(inUnits)} · বেরিয়েছে (বিক্রি) ${bnNumber(outUnits)}`}
                      >
                        {inUnits === 0 && outUnits === 0 ? (
                          <div className="h-[2px] rounded-sm bg-ink-100" />
                        ) : (
                          <>
                            {inUnits > 0 ? (
                              <div
                                className="rounded-sm bg-emerald-500"
                                style={{ height: `${(inUnits / flowPeak) * 100}%` }}
                              />
                            ) : null}
                            {outUnits > 0 ? (
                              <div
                                className="rounded-sm bg-rose-400"
                                style={{ height: `${(outUnits / flowPeak) * 100}%` }}
                              />
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex gap-1 text-[10px] text-ink-400">
                  {flowKeys.map((key, index) => (
                    <span key={key} className="flex-1 text-center">
                      {index % 3 === 0 ? bnDayLabel(key) : ""}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-ink-100 pt-3 text-xs text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-3 rounded-sm bg-emerald-500" /> স্টক ইন (কেনা / ফেরত)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-3 rounded-sm bg-rose-400" /> স্টক আউট (বিক্রি / অ্যাডজাস্ট)
                  </span>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="কম স্টক"
            description="low-stock threshold-এর নিচে বা সমান"
            action={
              low.length > 0 ? (
                <Badge tone="warning">
                  <AlertTriangle className="h-3 w-3" /> {low.length}
                </Badge>
              ) : (
                <Badge tone="success">
                  <PackageCheck className="h-3 w-3" /> ঠিক আছে
                </Badge>
              )
            }
          />
          {low.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">সব variant-এ পর্যাপ্ত স্টক আছে।</p>
            </CardBody>
          ) : (
            <ul className="space-y-2 px-5 py-4">
              {low.map((variant) => (
                <li key={variant.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/products/${variant.product.id}`}
                    className="min-w-0 truncate text-sm font-medium text-brand-700 hover:underline"
                  >
                    {variant.product.name}
                  </Link>
                  <Badge tone={variant.stockQty - variant.reservedQty <= 0 ? "danger" : "warning"}>
                    {variant.stockQty - variant.reservedQty}
                  </Badge>
                </li>
              ))}
              <li className="pt-1">
                <Link href="/admin/products" className="text-xs text-ink-500 hover:underline">
                  সব পণ্য দেখুন →
                </Link>
              </li>
            </ul>
          )}
        </Card>
      </div>

      {/* Adjust form + ledger */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="স্টক অ্যাডজাস্ট"
            description="কারণ লিখে স্টক বাড়ান বা কমান"
          />
          <CardBody>
            <StockAdjustForm
              storeId={store.id}
              variants={variants.slice(0, 150).map((variant) => ({
                id: variant.id,
                label: `${variant.product.name} · ${variant.sku} (${variant.stockQty - variant.reservedQty})`,
              }))}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="স্টক মুভমেন্ট লেজার" description="সর্বশেষ ৪০টি এন্ট্রি" />
          {movements.length === 0 ? (
            <CardBody>
              <EmptyState
                title="এখনো কোনো মুভমেন্ট নেই"
                description="প্রথম অর্ডার বা স্টক অ্যাডজাস্ট করলে লেজার শুরু হবে।"
              />
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>সময়</Th>
                  <Th>পণ্য</Th>
                  <Th>ধরন</Th>
                  <Th className="text-right">পরিবর্তন</Th>
                  <Th className="text-right">বর্তমান</Th>
                  <Th>কারণ</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(movement.createdAt)}</Td>
                    <Td>
                      <Link
                        href={`/admin/products/${movement.variant.product.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {movement.variant.product.name}
                      </Link>
                      <span className="block text-xs text-ink-400">{movement.variant.sku}</span>
                    </Td>
                    <Td>
                      <Badge tone={MOVEMENT_TONE[movement.type] ?? "neutral"}>{movement.type}</Badge>
                    </Td>
                    <Td className={`text-right font-medium ${movement.quantityDelta < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {movement.quantityDelta}
                    </Td>
                    <Td className="text-right text-ink-600">
                      {movement.variant.stockQty - movement.variant.reservedQty}
                    </Td>
                    <Td className="text-xs text-ink-500">{movement.reason}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
