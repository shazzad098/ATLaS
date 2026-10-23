import { requireActiveStore } from "@/lib/tenant";
import { formatDate } from "@/lib/dates";
import { formatBdt } from "@/lib/money";
import { pricingMatrix, getSubscriptionDetail, listInvoices } from "@/lib/services/billing-service";
import { Badge, Card, CardBody, CardHeader, Stat, Table, Td, Th } from "@/components/ui/shell";
import { InvoiceRowAction, PlanSwitcher } from "@/app/admin/_components/plan-switcher";

/** Billing: plan, usage vs limits, overage and invoices (PRD §5). */

export const metadata = { title: "বিলিং" };

export default async function BillingPage() {
  const { workspace } = await requireActiveStore();
  const tenantId = workspace.activeTenant.tenantId;

  const [detail, invoices, plans] = await Promise.all([
    getSubscriptionDetail(tenantId),
    listInvoices(tenantId, 24),
    pricingMatrix(),
  ]);

  const { subscription, snapshot, fees, overage } = detail;
  const canManage = workspace.actor.permissions.includes("billing:write");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">বিলিং ও সাবস্ক্রিপশন</h1>
        <p className="text-sm text-ink-500">
          {subscription.plan.name} প্ল্যান · {subscription.billingPeriod === "YEARLY" ? "বার্ষিক" : "মাসিক"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="বর্তমান প্ল্যান"
          value={subscription.plan.name}
          hint={subscription.status}
          tone={subscription.status === "ACTIVE" ? "success" : "warning"}
        />
        <Stat
          label="পিরিয়ড শেষ"
          value={formatDate(subscription.currentPeriodEnd)}
          hint={detail.periodDaysRemaining === null ? undefined : `${detail.periodDaysRemaining} দিন বাকি`}
        />
        <Stat
          label="Overage অর্ডার"
          value={overage}
          hint={
            snapshot.limits.monthlyOrders === null
              ? "আনলিমিটেড"
              : `লিমিট ${snapshot.limits.monthlyOrders} · রেট ${formatBdt(snapshot.overageRate)}`
          }
          tone={overage > 0 ? "warning" : "success"}
        />
        <Stat label="বকেয়া ফি" value={formatBdt(fees.pending)} hint={`রিভার্সড ${formatBdt(fees.reversed)}`} />
      </div>

      <Card>
        <CardHeader title="প্ল্যান ও সীমা" description="আপনার ব্যবহার ও সীমা একসাথে" />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Usage label="পণ্য" used={snapshot.usage.products} limit={snapshot.limits.products} />
          <Usage label="এই মাসের অর্ডার" used={snapshot.usage.ordersThisPeriod} limit={snapshot.limits.monthlyOrders} />
          <Usage label="স্টোরেজ (MB)" used={snapshot.usage.storageMb} limit={snapshot.limits.storageMb} />
          <Usage label="স্টাফ সিট" used={snapshot.usage.staffSeats} limit={snapshot.limits.staffSeats} />
        </CardBody>
      </Card>

      <PlanSwitcher
        plans={plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          monthlyPriceBdt: plan.monthlyPriceBdt,
          yearlyPriceBdt: plan.yearlyPriceBdt,
          trialDays: plan.trialDays,
          limits: {
            products: plan.limits.products,
            monthlyOrders: plan.limits.monthlyOrders,
            staffSeats: plan.limits.staffSeats,
          },
        }))}
        currentPlanCode={snapshot.planCode}
        currentPeriod={subscription.billingPeriod === "YEARLY" ? "YEARLY" : "MONTHLY"}
        canManage={canManage}
      />

      <Card>
        <CardHeader title="ইনভয়েস" description="প্ল্যান ফি + প্রতি অর্ডারের প্ল্যাটফর্ম চার্জ" />
        {invoices.length === 0 ? (
          <CardBody>
            <p className="text-sm text-ink-500">এখনো কোনো ইনভয়েস তৈরি হয়নি।</p>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>নম্বর</Th>
                <Th>সময়</Th>
                <Th>স্ট্যাটাস</Th>
                <Th className="text-right">মোট</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <Td className="font-medium">{invoice.number}</Td>
                  <Td className="text-xs text-ink-500">
                    {formatDate(invoice.createdAt)}
                    {invoice.dueAt ? <span className="block">ডিউ {formatDate(invoice.dueAt)}</span> : null}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        invoice.status === "PAID"
                          ? "success"
                          : invoice.status === "OPEN"
                            ? "warning"
                            : invoice.status === "VOID"
                              ? "neutral"
                              : "danger"
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium">{formatBdt(invoice.total)}</Td>
                  <Td>{canManage ? <InvoiceRowAction invoiceId={invoice.id} status={invoice.status} /> : null}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const percent = limit === null || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = limit !== null && used > limit;
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-0.5 font-semibold text-ink-900">
        {used}
        {limit === null ? " / ∞" : ` / ${limit}`}
      </p>
      {limit !== null ? (
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100">
          <span
            className={`block h-full rounded-full ${over ? "bg-red-500" : "bg-brand-500"}`}
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}
