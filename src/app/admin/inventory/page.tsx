import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Boxes, PackageCheck } from "lucide-react";
import { requireActiveStorePage } from "@/lib/tenant";
import { formatDateTime } from "@/lib/dates";
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
 */

export const metadata: Metadata = { title: "ইনভেন্টরি" };

const MOVEMENT_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  PURCHASE: "success",
  RETURN: "success",
  RELEASE: "info",
  ADJUSTMENT: "info",
  SALE: "neutral",
  RESERVATION: "warning",
  DAMAGE: "danger",
};

export default async function InventoryPage() {
  const { store } = await requireActiveStorePage();

  const [totals, movements, low, variants] = await Promise.all([
    inventoryTotals(store.id),
    listMovements(store.id, { limit: 40 }),
    lowStockVariants(store.id, 5, 12),
    prisma.productVariant.findMany({
      where: { product: { storeId: store.id, deletedAt: null }, status: "ACTIVE" },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      take: 200,
      select: {
        id: true,
        sku: true,
        stockQty: true,
        reservedQty: true,
        price: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  const stockValue = variants.reduce(
    (sum, variant) => sum + Number(variant.price) * Math.max(0, variant.stockQty - variant.reservedQty),
    0,
  );

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

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader
            title="স্টক অ্যাডজাস্ট"
            description="কারণ লিখে স্টক বাড়ান বা কমান"
          />
          <CardBody>
            <StockAdjustForm
              storeId={store.id}
              variants={variants.map((variant) => ({
                id: variant.id,
                label: `${variant.product.name} · ${variant.sku} (${variant.stockQty - variant.reservedQty})`,
              }))}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
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
            <Table>
              <thead>
                <tr>
                  <Th>পণ্য</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">উপলব্ধ</Th>
                  <Th className="text-right">রিজার্ভড</Th>
                </tr>
              </thead>
              <tbody>
                {low.map((variant) => (
                  <tr key={variant.id}>
                    <Td>
                      <Link
                        href={`/admin/products/${variant.product.id}`}
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
                    <Td className="text-right text-ink-500">{variant.reservedQty}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card>
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
  );
}
