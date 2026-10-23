import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, Table, Td, Th } from "@/components/ui/shell";
import { pricingMatrix } from "@/lib/services/billing-service";
import { formatLimit, formatRate } from "@/lib/plans";

/** Public pricing comparison (PRD §5.1). */

export const metadata = {
  title: "প্রাইসিং",
  description: "ফ্রি থেকে Pro — প্রতি প্ল্যানে প্রোডাক্ট, অর্ডার, ডোমেইন আর ফি কত।",
};

/** Prices and limits are editable by Super Admin, so read them per request. */
export const dynamic = "force-dynamic";

type PricingPlan = Awaited<ReturnType<typeof pricingMatrix>>[number];

const BOOLEAN = (value: boolean) => (value ? "আছে" : "—");

const ROWS: Array<{ label: string; value: (plan: PricingPlan) => string }> = [
  { label: "প্রোডাক্ট", value: (plan) => formatLimit(plan.limits.products) },
  { label: "প্রতি মাসে অর্ডার (এর পরে ফি)", value: (plan) => formatLimit(plan.limits.monthlyOrders) },
  { label: "স্টোরেজ", value: (plan) => `${plan.limits.storageMb} MB` },
  { label: "থিম", value: (plan) => plan.limits.themes.join(", ") },
  { label: "থিম বদলানো", value: (plan) => plan.limits.themeSwitching },
  { label: "Subdomain", value: (plan) => BOOLEAN(plan.limits.subdomain) },
  { label: "নিজের ডোমেইন", value: (plan) => BOOLEAN(plan.limits.customDomain) },
  { label: "ডোমেইন + subdomain একসাথে", value: (plan) => BOOLEAN(plan.limits.domainWithSubdomain) },
  { label: "স্টাফ seat", value: (plan) => formatLimit(plan.limits.staffSeats) },
  { label: "Bulk ইমপোর্ট/এক্সপোর্ট", value: (plan) => BOOLEAN(plan.limits.bulkTools) },
  { label: "Automation", value: (plan) => BOOLEAN(plan.limits.automation) },
  { label: "ডিসকাউন্ট", value: (plan) => plan.limits.discounts },
  { label: "রিপোর্ট", value: (plan) => plan.limits.reports },
  { label: "API", value: (plan) => plan.limits.apiAccess },
  { label: "রিকোয়েস্ট / মিনিট", value: (plan) => formatLimit(plan.limits.requestsPerMinute) },
  { label: "সাপোর্ট", value: (plan) => plan.limits.support },
  { label: "ওভারেজ কমিশন", value: (plan) => formatRate(plan.limits.overageRate) },
];

function priceLabel(plan: PricingPlan): string {
  if (plan.monthlyPriceBdt === null) return "কাস্টম";
  if (plan.monthlyPriceBdt === 0) return "৳০";
  return `৳${plan.monthlyPriceBdt.toLocaleString("en-US")}`;
}

export default async function PricingPage() {
  const plans = await pricingMatrix();

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <Badge tone="brand">প্রাইসিং</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          ফ্রি দিয়ে শুরু, বাড়লে প্ল্যান
        </h1>
        <p className="text-ink-600">
          প্রতি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত। তার পরে প্রতিটি অর্ডারে ছোট একটি প্ল্যাটফর্ম
          কমিশন — যত উপরের প্ল্যান, তত কম হার।
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.code} className={plan.code === "free" ? "border-brand-300" : undefined}>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-900">{plan.name}</p>
                {plan.code === "free" ? <Badge tone="success">ফ্রি</Badge> : null}
              </div>
              <p className="text-2xl font-semibold text-ink-900">
                {priceLabel(plan)}
                {plan.monthlyPriceBdt ? <span className="text-xs text-ink-500"> /মাস</span> : null}
              </p>
              {plan.yearlyPriceBdt ? (
                <p className="text-xs text-ink-500">
                  বছর হলে ৳{plan.yearlyPriceBdt.toLocaleString("en-US")}
                </p>
              ) : null}
              <p className="text-xs text-ink-600">{plan.description}</p>
              <p className="text-xs text-ink-500">
                {plan.trialDays} দিনের ট্রায়াল · ওভারেজ {formatRate(plan.limits.overageRate)}
              </p>
              <ButtonLink
                href="/signup"
                variant={plan.code === "free" ? "primary" : "outline"}
                size="sm"
                className="w-full"
              >
                {plan.monthlyPriceBdt === null ? "কথা বলুন" : "শুরু করুন"}
              </ButtonLink>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>বৈশিষ্ট্য</Th>
              {plans.map((plan) => (
                <Th key={plan.code}>{plan.name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <Td className="font-medium text-ink-800">{row.label}</Td>
                {plans.map((plan) => (
                  <Td key={plan.code} className="text-ink-600">
                    {row.value(plan)}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-6">
        <h2 className="text-lg font-semibold text-ink-900">ফি কীভাবে হিসাব হয়</h2>
        <ul className="space-y-2 text-sm text-ink-600">
          <li>
            • প্ল্যানের সীমা পর্যন্ত কোনো কমিশন নেই; এর পরে প্রতিটি অর্ডারে plan অনুযায়ী হার বসে।
          </li>
          <li>• হিসাব হয় অর্ডারের সাবটোটাল থেকে ডিসকাউন্ট বাদ দিয়ে (ডেলিভারি চার্জ বাদে)।</li>
          <li>• মাস শেষে সব ফি এক ইনভয়েসে যোগ হয়; বাতিল অর্ডারের ফি স্বয়ংক্রিয়ভাবে ফেরত হয়।</li>
          <li>• Basic, Standard ও Pro-র মাসিক মূল্য চূড়ান্ত হয়নি — অ্যাকাউন্ট ম্যানেজারের সাথে ঠিক করা হবে।</li>
        </ul>
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink href="/signup">ফ্রি অ্যাকাউন্ট খুলুন</ButtonLink>
          <ButtonLink href="/themes" variant="outline">
            থিম দেখুন
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
