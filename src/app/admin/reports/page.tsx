import Link from "next/link";
import { requireActiveStorePermissionPage } from "@/lib/tenant";
import { addDays, bnNumber, formatDate, formatDateTime } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { orderMetrics } from "@/lib/services/order-service";
import { loadEntitlementSnapshot, assertReportLevel } from "@/lib/entitlements";
import {
  EXPORT_LABELS,
  EXPORT_TYPES,
  listExportJobs,
  listExportSchedules,
  reportOverview,
} from "@/lib/services/report-service";
import { Badge, Card, CardBody, CardHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { ReportExportForm, ExportScheduleForm } from "@/app/admin/_components/report-export-form";
import { FormButton } from "@/app/admin/_components/form-button";
import { deleteExportScheduleAction } from "@/app/admin/actions";

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
  const { workspace, store } = await requireActiveStorePermissionPage("reports:read");
  const query = await searchParams;

  const days = RANGES.find((range) => range.value === query.range)?.value ?? "30";
  const to = new Date();
  const from = addDays(to, -Number(days));

  const [metrics, snapshot, reports, jobs, schedules] = await Promise.all([
    orderMetrics(store.id, { from, to }),
    loadEntitlementSnapshot(workspace.activeTenant.tenantId),
    reportOverview(store.id, { from, to }),
    listExportJobs(store.id, 8),
    listExportSchedules(store.id),
  ]);

  let exportAllowed = true;
  try {
    assertReportLevel(snapshot, "CSV");
  } catch {
    exportAllowed = false;
  }
  const scheduleAllowed = exportAllowed && snapshot.features.scheduledExport;

  const peak = Math.max(1, ...metrics.byDay.map((day) => Number(day.revenue)));
  const exportTypes = EXPORT_TYPES.map((type) => ({ value: type, label: EXPORT_LABELS[type] }));
  const fromInput = from.toISOString().slice(0, 10);
  const toInput = to.toISOString().slice(0, 10);

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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="কাস্টমার রিপোর্ট"
            description={`নতুন ${bnNumber(reports.customers.newCustomers)} · ক্রেতা ${bnNumber(reports.customers.buyingCustomers)} · রিপিট ${reports.customers.repeatRate}%`}
          />
          {reports.customers.topCustomers.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এই সময়ে কোনো ক্রেতা নেই।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>কাস্টমার</Th>
                  <Th className="text-right">অর্ডার</Th>
                  <Th className="text-right">খরচ</Th>
                </tr>
              </thead>
              <tbody>
                {reports.customers.topCustomers.map((customer) => (
                  <tr key={customer.phone}>
                    <Td>
                      <span className="font-medium">{customer.name}</span>
                      <span className="ml-2 text-xs text-ink-500">{customer.phone}</span>
                    </Td>
                    <Td className="text-right">{bnNumber(customer.orders)}</Td>
                    <Td className="text-right font-medium">{formatBdt(customer.spent)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="পেমেন্ট মিলান" description="Provider ও status অনুযায়ী amount, fee ও net" />
          {reports.payments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">এই সময়ে কোনো পেমেন্ট নেই।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Fee</Th>
                  <Th className="text-right">Net</Th>
                </tr>
              </thead>
              <tbody>
                {reports.payments.map((row) => (
                  <tr key={`${row.provider}-${row.status}`}>
                    <Td>{row.provider}</Td>
                    <Td className="text-xs">{row.status}</Td>
                    <Td className="text-right">{formatBdt(row.amount)}</Td>
                    <Td className="text-right">{formatBdt(row.fee)}</Td>
                    <Td className="text-right font-medium">{formatBdt(row.net)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="পণ্যভিত্তিক লাভ" description="Cost price থাকলে profit দেখানো হয়" />
          {reports.profit.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-500">বিক্রির ডেটা নেই।</p>
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>পণ্য</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">আয়</Th>
                  <Th className="text-right">লাভ</Th>
                </tr>
              </thead>
              <tbody>
                {reports.profit.map((row) => (
                  <tr key={row.name}>
                    <Td className="font-medium">{row.name}</Td>
                    <Td className="text-right">{bnNumber(row.qty)}</Td>
                    <Td className="text-right">{formatBdt(row.revenue)}</Td>
                    <Td className="text-right font-medium">{row.profit ? formatBdt(row.profit) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="স্টক ও ইনভেন্টরি"
            description={`${bnNumber(reports.stock.totalSkus)} SKU · স্টক মূল্য ${formatBdt((reports.stock.totalStockValuePaisa / 100).toFixed(2))}`}
          />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={reports.stock.outOfStock > 0 ? "danger" : "success"}>
                স্টক শেষ: {bnNumber(reports.stock.outOfStock)}
              </Badge>
              <Badge tone="warning">কম স্টক: {bnNumber(reports.stock.lowStock.length)}</Badge>
            </div>
            {reports.stock.lowStock.length > 0 ? (
              <Table>
                <thead>
                  <tr>
                    <Th>পণ্য / SKU</Th>
                    <Th className="text-right">Available</Th>
                  </tr>
                </thead>
                <tbody>
                  {reports.stock.lowStock.slice(0, 10).map((row) => (
                    <tr key={row.id}>
                      <Td>
                        <span className="font-medium">{row.product.name}</span>
                        <span className="ml-1 font-mono text-[11px] text-ink-500">{row.sku}</span>
                      </Td>
                      <Td className="text-right font-semibold">{bnNumber(row.available)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-sm text-ink-500">সব SKU-তে যথেষ্ট স্টক আছে।</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Export ও scheduled report"
          description={
            exportAllowed
              ? "CSV job তৈরি করুন; Pro plan-এ প্রতিদিন/সাপ্তাহিক schedule করা যায়।"
              : "CSV export Basic ও তার উপরের plan-এ পাওয়া যায়।"
          }
          action={exportAllowed ? <Badge tone="success">CSV সক্রিয়</Badge> : <Badge tone="warning">Upgrade প্রয়োজন</Badge>}
        />
        <CardBody className="space-y-6">
          {exportAllowed ? (
            <ReportExportForm storeId={store.id} types={exportTypes} from={fromInput} to={toInput} />
          ) : null}

          {jobs.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">সাম্প্রতিক export</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>রিপোর্ট</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Rows</Th>
                    <Th>তৈরি</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <Td>{EXPORT_LABELS[job.type as keyof typeof EXPORT_LABELS] ?? job.type}</Td>
                      <Td>
                        <Badge tone={job.status === "COMPLETED" ? "success" : job.status === "FAILED" ? "danger" : "warning"}>
                          {job.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">{bnNumber(job.rowCount)}</Td>
                      <Td className="text-xs">{formatDateTime(job.createdAt)}</Td>
                      <Td className="text-right">
                        {job.status === "COMPLETED" ? (
                          <Link href={`/admin/reports/exports/${job.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                            ডাউনলোড
                          </Link>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Scheduled export</h3>
            {!scheduleAllowed ? (
              <p className="text-sm text-ink-500">Scheduled export Pro plan-এ পাওয়া যায়।</p>
            ) : (
              <>
                <ExportScheduleForm storeId={store.id} types={exportTypes} />
                {schedules.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs"
                      >
                        <span>
                          <span className="font-semibold">{EXPORT_LABELS[schedule.type as keyof typeof EXPORT_LABELS] ?? schedule.type}</span>
                          {" · "}
                          {schedule.frequency === "DAILY" ? "প্রতিদিন" : "সাপ্তাহিক"} · {schedule.recipients.join(", ")}
                          {" · "}পরবর্তী {formatDateTime(schedule.nextRunAt)}
                        </span>
                        <FormButton
                          action={deleteExportScheduleAction}
                          fields={{ storeId: store.id, scheduleId: schedule.id }}
                          variant="ghost"
                          size="sm"
                          confirmText="এই schedule মুছে ফেলবেন?"
                        >
                          মুছুন
                        </FormButton>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
