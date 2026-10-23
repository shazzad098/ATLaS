import Link from "next/link";
import { listPlatformFees } from "@/lib/services/platform-service";
import { formatBdt } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";

/** Platform fee ledger across all tenants (PRD §5.1). */

export const metadata = { title: "ফি লেজার" };

const FEE_LABEL: Record<string, string> = {
  ORDER_COMMISSION: "অর্ডার কমিশন",
  PAYMENT_GATEWAY: "পেমেন্ট গেটওয়ে",
  COURIER: "কুরিয়ার",
};

const FILTERS = [
  { value: "", label: "সব" },
  { value: "PENDING", label: "Pending" },
  { value: "INVOICED", label: "Invoiced" },
  { value: "VOID", label: "Void" },
];

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = FILTERS.some((row) => row.value === status) ? status ?? "" : "";

  const { fees, summary } = await listPlatformFees({
    limit: 200,
    status: activeStatus || undefined,
  });

  const totalPending = summary.find((row) => row.status === "PENDING");
  const totalInvoiced = summary.find((row) => row.status === "INVOICED");

  return (
    <div className="space-y-5">
      <PageHeader
        title="ফি লেজার"
        description="প্রতিটি অর্ডারের কমিশন, গেটওয়ে ও কুরিয়ার ফি — merchant ইনভয়েসে যুক্ত হওয়ার আগে।"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="অপরিশোধিত (PENDING)"
          value={formatBdt(totalPending?.amount ?? "0.00")}
          hint={`${totalPending?.count ?? 0} এন্ট্রি`}
          tone="warning"
        />
        <Stat
          label="ইনভয়েসে যুক্ত (INVOICED)"
          value={formatBdt(totalInvoiced?.amount ?? "0.00")}
          hint={`${totalInvoiced?.count ?? 0} এন্ট্রি`}
          tone="success"
        />
        <Stat label="মোট এন্ট্রি" value={summary.reduce((acc, row) => acc + row.count, 0)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value || "all"}
            href={filter.value ? `/super-admin/fees?status=${filter.value}` : "/super-admin/fees"}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              activeStatus === filter.value
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title="লেজার এন্ট্রি" description={`সর্বশেষ ${fees.length}টি`} />
        {fees.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">এই ফিল্টারে কোনো ফি এন্ট্রি নেই।</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>সময়</Th>
                <Th>টেন্যান্ট / দোকান</Th>
                <Th>অর্ডার</Th>
                <Th>ধরন</Th>
                <Th>বেস</Th>
                <Th>রেট</Th>
                <Th>ফি</Th>
                <Th>স্ট্যাটাস</Th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(fee.createdAt)}</Td>
                  <Td>
                    <span className="text-sm text-ink-800">{fee.tenant.name}</span>
                    <span className="block text-[11px] text-ink-400">{fee.store.name}</span>
                  </Td>
                  <Td className="text-xs text-ink-500">{fee.order?.orderNo ?? "—"}</Td>
                  <Td className="text-xs">{FEE_LABEL[fee.feeType] ?? fee.feeType}</Td>
                  <Td>{formatBdt(fee.baseAmount)}</Td>
                  <Td className="text-xs text-ink-500">{Number(fee.rate).toFixed(4)}</Td>
                  <Td className="font-medium">{formatBdt(fee.feeAmount)}</Td>
                  <Td>
                    {fee.reversedAt ? (
                      <Badge tone="danger">Reversed</Badge>
                    ) : (
                      <Badge tone={fee.status === "INVOICED" ? "success" : fee.status === "VOID" ? "neutral" : "warning"}>
                        {fee.status}
                      </Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
