import { platformOverview, listAuditTrail } from "@/lib/services/platform-service";
import { platformBillingMetrics } from "@/lib/services/billing-service";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { FormButton } from "@/app/admin/_components/form-button";
import { runBillingSweepAction, syncThemeCatalogAction } from "@/app/super-admin/actions";

/** Platform overview: growth, revenue and the audit trail (PRD §4.5). */

export const metadata = { title: "ওভারভিউ" };

const STATUS_LABEL: Record<string, string> = {
  TRIALING: "Trial",
  ACTIVE: "সক্রিয়",
  PAST_DUE: "বকেয়া",
  GRACE: "গ্রেস",
  READ_ONLY: "Read-only",
  SUSPENDED: "স্থগিত",
  CANCELLED: "বাতিল",
};

export default async function SuperAdminPage() {
  const [overview, billing, audit] = await Promise.all([
    platformOverview(),
    platformBillingMetrics(),
    listAuditTrail(15),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="প্ল্যাটফর্ম ওভারভিউ"
        description="টেন্যান্ট, GMV, সাবস্ক্রিপশন ও প্ল্যাটফর্ম ফি — সবই BDT-তে (Asia/Dhaka)।"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="টেন্যান্ট" value={overview.tenants.total} hint={`সক্রিয় ${overview.tenants.active}`} />
        <Stat
          label="দোকান"
          value={overview.stores.total}
          hint={`Publish করা ${overview.stores.published}`}
          tone="brand"
        />
        <Stat label="অর্ডার" value={overview.orders.total} hint={`বাতিল/রিফান্ড ${overview.orders.cancelledOrRefunded}`} />
        <Stat label="মোট GMV" value={formatBdt(overview.orders.gmv)} hint={`পরিশোধিত ${formatBdt(overview.orders.paidGmv)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={billing.formatted.mrr} hint={`ARR ${billing.formatted.arr}`} tone="success" />
        <Stat label="পেইড দোকান" value={billing.paidStoreCount} />
        <Stat label="প্ল্যাটফর্ম ফি (অপরিশোধিত)" value={formatBdt(billing.gmvAndFees.platformFees)} tone="warning" />
        <Stat label="প্রোডাক্ট" value={overview.catalog.products} hint={`কাস্টমার ${overview.catalog.customers}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="সাবস্ক্রিপশন অবস্থা" description="সব tenant-এর subscription status" />
          <CardBody>
            {billing.byStatus.length === 0 ? (
              <p className="text-sm text-ink-500">এখনো কোনো সাবস্ক্রিপশন নেই।</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {billing.byStatus.map((row) => (
                  <li key={row.status} className="flex items-center justify-between">
                    <span className="text-ink-700">{STATUS_LABEL[row.status] ?? row.status}</span>
                    <span className="font-medium text-ink-900">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="রক্ষণাবেক্ষণ" description="ম্যানুয়ালি চালানোর জন্য অপারেশন" />
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <FormButton action={runBillingSweepAction} fields={{ source: "super-admin" }}>
                Billing sweep চালান
              </FormButton>
              <p className="text-xs text-ink-500">
                trial শেষ হওয়া downgrade, ইনভয়েস তৈরি, reminder, read-only ও suspend — সব একসাথে।
              </p>
            </div>
            <div className="space-y-1 border-t border-ink-100 pt-4">
              <FormButton action={syncThemeCatalogAction} fields={{ source: "super-admin" }} variant="outline">
                থিম ক্যাটালগ sync করুন
              </FormButton>
              <p className="text-xs text-ink-500">শিপ করা ৩টি theme থেকে Theme/ThemeVersion row তৈরি বা হালনাগাদ করে।</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="সাম্প্রতিক audit log" description="সব privileged ও আর্থিক পরিবর্তন" />
        <Table>
          <thead>
            <tr>
              <Th>সময়</Th>
              <Th>অ্যাকশন</Th>
              <Th>টেন্যান্ট</Th>
              <Th>অ্যাক্টর</Th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={row.id}>
                <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(row.createdAt)}</Td>
                <Td>
                  <Badge tone="neutral">{row.action}</Badge>
                </Td>
                <Td className="text-xs text-ink-500">{row.tenant?.name ?? "—"}</Td>
                <Td className="text-xs text-ink-500">{row.actor?.name ?? row.actor?.phone ?? "system"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
