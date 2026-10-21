import { prisma } from "@/lib/db";
import { pricingMatrix, PLAN_EDITABLE_LIMITS } from "@/lib/services/billing-service";
import { formatBdt } from "@/lib/money";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/shell";
import { PlanEditForm } from "@/app/super-admin/_components/plan-edit-form";

/**
 * Plan & entitlement configuration (PRD §4.5).
 *
 * Price, trial length and the hard limits are editable — those are the values
 * the entitlement engine actually reads at request time. Feature flags, theme
 * pools and report tiers stay with the shipped `PLAN_DEFINITIONS` because they
 * gate code paths rather than numbers.
 */

export const metadata = { title: "প্ল্যান ও entitlement" };

export default async function PlansPage() {
  const [plans, subscribers] = await Promise.all([
    pricingMatrix(),
    prisma.subscription.groupBy({ by: ["planId"], _count: { _all: true } }),
  ]);

  const planRows = await prisma.plan.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(planRows.map((row) => [row.code, row.id]));
  const countByCode = new Map(
    subscribers.map((row) => [row.planId, row._count._all] as const),
  );

  const totalSubscribers = subscribers.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="প্ল্যান ও entitlement"
        description={`${plans.length}টি plan · ${totalSubscribers}টি subscription — দাম ও limit বদলালে সাথে সাথে কার্যকর হয়।`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const subscribers = countByCode.get(idByCode.get(plan.code) ?? "") ?? 0;
          return (
            <Card key={plan.code}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {plan.name}
                    <Badge tone="neutral">{plan.code}</Badge>
                  </span>
                }
                description={`${subscribers}টি tenant · trial ${plan.trialDays} দিন`}
                action={
                  <Badge tone="brand">
                    {plan.monthlyPriceBdt === null ? "কাস্টম কোট" : `${formatBdt(plan.monthlyPriceBdt)}/মাস`}
                  </Badge>
                }
              />
              <CardBody>
                <PlanEditForm
                  code={plan.code}
                  monthlyPrice={plan.monthlyPriceBdt}
                  yearlyPrice={plan.yearlyPriceBdt}
                  trialDays={plan.trialDays}
                  limits={Object.fromEntries(
                    PLAN_EDITABLE_LIMITS.map((key) => [key, plan.limits[key] as number | null]),
                  )}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Entitlement ম্যাট্রিক্স"
          description="ফিচার ফ্ল্যাগ ও থিম পুল কোডে নির্ধারিত — এখানে শুধু দেখা যায়"
        />
        <Table>
          <thead>
            <tr>
              <Th>প্ল্যান</Th>
              <Th className="text-right">প্রোডাক্ট</Th>
              <Th className="text-right">মাসিক অর্ডার</Th>
              <Th className="text-right">ওভারেজ</Th>
              <Th className="text-right">স্টাফ</Th>
              <Th className="text-right">স্টোরেজ</Th>
              <Th>কাস্টম ডোমেইন</Th>
              <Th>বাল্ক টুলস</Th>
              <Th>থিম</Th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.code}>
                <Td className="font-medium">{plan.name}</Td>
                <Td className="text-right">{plan.limits.products ?? "Unlimited"}</Td>
                <Td className="text-right">{plan.limits.monthlyOrders ?? "Unlimited"}</Td>
                <Td className="text-right">{(plan.limits.overageRate * 100).toFixed(2)}%</Td>
                <Td className="text-right">{plan.limits.staffSeats}</Td>
                <Td className="text-right">{plan.limits.storageMb ?? "Unlimited"}MB</Td>
                <Td>
                  <Badge tone={plan.limits.customDomain ? "success" : "neutral"}>
                    {plan.limits.customDomain ? "হ্যাঁ" : "না"}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={plan.limits.bulkTools ? "success" : "neutral"}>
                    {plan.limits.bulkTools ? "হ্যাঁ" : "না"}
                  </Badge>
                </Td>
                <Td className="text-xs text-ink-500">{plan.limits.themes.join(", ") || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <p className="text-xs text-ink-500">
        নোট: ফিচার ফ্ল্যাগ (bulk tools, scheduled export, courier) বদলাতে `src/lib/plans.ts`-এর{" "}
        <span className="font-mono">PLAN_DEFINITIONS</span> আপডেট করে redeploy করতে হয় — সেগুলো কোড-লেভেল
        entitlement।
      </p>
    </div>
  );
}
