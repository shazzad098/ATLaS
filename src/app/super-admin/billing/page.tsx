import { listInvoicesForAdmin, platformBillingMetrics } from "@/lib/services/billing-service";
import { formatBdt } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, PageHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { InvoiceSettleForm } from "@/app/super-admin/_components/invoice-settle-form";

/** Subscription invoices + manual settlement queue (PRD §4.5, §5.2). */

export const metadata = { title: "সাবস্ক্রিপশন বিলিং" };

export default async function SuperAdminBillingPage() {
  const [invoices, metrics] = await Promise.all([
    listInvoicesForAdmin(100),
    platformBillingMetrics(),
  ]);

  const open = invoices.filter((invoice) => invoice.status === "OPEN");
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const openTotal = open.reduce((sum, invoice) => sum + Number(invoice.total), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="সাবস্ক্রিপশন বিলিং"
        description="Merchant invoice যাচাই করে manual settlement করুন। Settlement ছাড়া কোনো paid plan বা suspended store চালু হয় না।"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="বকেয়া invoice" value={open.length} hint={`${formatBdt(openTotal)}`} tone="warning" />
        <Stat label="পরিশোধিত" value={paid.length} tone="success" />
        <Stat label="MRR" value={metrics.formatted.mrr} hint={`ARR ${metrics.formatted.arr}`} />
      </div>

      <Card>
        <CardHeader
          title="Invoice কিউ"
          description="প্রতিটি settlement audit log-এ actor, invoice ও কারণ সহ সংরক্ষিত হয়।"
        />
        {invoices.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">এখনো কোনো invoice তৈরি হয়নি।</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Tenant / Plan</Th>
                <Th>স্ট্যাটাস</Th>
                <Th>ডিউ</Th>
                <Th className="text-right">মোট</Th>
                <Th>Settlement</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td className="font-medium">{invoice.number}</Td>
                  <Td>
                    <span className="block text-sm text-ink-800">{invoice.tenant.name}</span>
                    <span className="block text-[11px] text-ink-400">
                      {invoice.subscription?.plan.name ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        invoice.status === "PAID"
                          ? "success"
                          : invoice.status === "OPEN"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-ink-500">
                    {formatDate(invoice.dueAt ?? invoice.createdAt)}
                  </Td>
                  <Td className="text-right font-medium">{formatBdt(invoice.total)}</Td>
                  <Td>
                    {invoice.status === "OPEN" ? (
                      <InvoiceSettleForm invoiceId={invoice.id} total={formatBdt(invoice.total)} />
                    ) : invoice.status === "PAID" ? (
                      <span className="text-xs text-emerald-700">
                        {invoice.paidAt ? formatDate(invoice.paidAt) : "পরিশোধিত"}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
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
