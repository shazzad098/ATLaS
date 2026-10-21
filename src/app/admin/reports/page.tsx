import Link from "next/link";
import { requireActiveStore } from "@/lib/tenant";
import { addDays, formatDate } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { orderMetrics } from "@/lib/services/order-service";
import { loadEntitlementSnapshot, assertReportLevel } from "@/lib/entitlements";
import { Badge, Card, CardBody, CardHeader, Stat, Table, Td, Th } from "@/components/ui/shell";

/** Sales reporting with CSV export (FR-10). */

export const metadata = { title: "রিপোর্ট" };

const RANGES = [
  { value: "7", label: "৭ দিন" },
  { value: "30", label: "৩০ দিন" },
  { value: "90", label: "৯০ দিন" },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { workspace, store } = await requireActiveStore();
  const query = await searchParams;

  const days = RANGES.find((range) => range.value === query.range)?.value ?? "30";
  const to = new Date();
  const from = addDays(to, -Number(days));

  const [metrics, snapshot] = await Promise.all([
    orderMetrics(store.id, { from, to }),
    loadEntitlementSnapshot(workspace.activeTenant.tenantId),
  ]);

  let exportAllowed = true;
  try {
    assertReportLevel(snapshot, "CSV");
  } catch {
    exportAllowed = false;
  }

  const peak = Math.max(1, ...metrics.byDay.map((day) => Number(day.revenue)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">রিপোর্ট</h1>
          <p className="text-sm text-ink-500">
            {formatDate(from)} – {formatDate(to)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((range) => (
            <Link
              key={range.value}
              href={`/admin/reports?range=${range.value}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                days === range.value ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700"
              }`}
            >
              {range.label}
            </Link>
          ))}
          {exportAllowed ? (
            <Link
              href={`/admin/reports/export?from=${from.toISOString()}&to=${to.toISOString()}`}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              CSV ডাউনলোড
            </Link>
          ) : (
            <Badge tone="warning">CSV export এই প্ল্যানে নেই</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="আয়" value={formatBdt(metrics.revenue)} hint={`${metrics.orderCount}টি অর্ডার`} />
        <Stat label="গড় অর্ডার মূল্য" value={formatBdt(metrics.averageOrderValue)} />
        <Stat label="রিফান্ড" value={formatBdt(metrics.refunded)} tone={metrics.refunded === "0.00" ? "success" : "warning"} />
        <Stat
          label="সফল অর্ডার হার"
          value={`${
            metrics.orderCount === 0
              ? 0
              : Math.round(
                  ((metrics.byStatus.find((row) => row.status === "DELIVERED")?.count ?? 0) / metrics.orderCount) * 100,
                )
          }%`}
          hint="Delivered"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="দৈনিক আয়" description="নির্বাচিত সময়ের প্রতিদিনের বিক্রি" />
          <CardBody>
            {metrics.byDay.length === 0 ? (
              <p className="text-sm text-ink-500">এই সময়ে কোনো অর্ডার নেই।</p>
            ) : (
              <ul className="space-y-1.5">
                {metrics.byDay.map((day) => (
                  <li key={day.date} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 text-ink-500">{day.date.slice(5)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.max(4, (Number(day.revenue) / peak) * 100)}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right font-medium">{formatBdt(day.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="পেমেন্ট মাধ্যম" />
            <Table>
              <thead>
                <tr>
                  <Th>প্রোভাইডার</Th>
                  <Th className="text-right">অর্ডার</Th>
                </tr>
              </thead>
              <tbody>
                {metrics.byProvider.map((row) => (
                  <tr key={row.provider}>
                    <Td>{row.provider}</Td>
                    <Td className="text-right">{row.count}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="স্ট্যাটাস অনুযায়ী" />
            <Table>
              <thead>
                <tr>
                  <Th>স্ট্যাটাস</Th>
                  <Th className="text-right">সংখ্যা</Th>
                </tr>
              </thead>
              <tbody>
                {metrics.byStatus.map((row) => (
                  <tr key={row.status}>
                    <Td>{row.status}</Td>
                    <Td className="text-right">{row.count}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="সর্বাধিক বিক্রীত পণ্য" />
        {metrics.topProducts.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">পর্যাপ্ত ডেটা নেই।</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>পণ্য</Th>
                <Th className="text-right">পরিমাণ</Th>
                <Th className="text-right">আয়</Th>
              </tr>
            </thead>
            <tbody>
              {metrics.topProducts.map((row) => (
                <tr key={row.name}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-right">{row.qty}</Td>
                  <Td className="text-right font-medium">{formatBdt(row.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
