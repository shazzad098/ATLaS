import Link from "next/link";
import { Fragment } from "react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { pricingMatrix } from "@/lib/services/billing-service";
import { formatRate } from "@/lib/plans";

/** Public pricing page (PRD §5.1). Prices and limits are editable by Super Admin,
 *  so the matrix is read per request. */

export const metadata = {
  title: "দাম ও প্ল্যান",
  description: "ফ্রি থেকে Pro — প্রতি প্ল্যানে প্রোডাক্ট, অর্ডার, ডোমেইন, কমিশন আর সাপোর্ট কত।",
};

export const dynamic = "force-dynamic";

type PricingPlan = Awaited<ReturnType<typeof pricingMatrix>>[number];

/* ──────────────────────────────────────────────────────────────
 * Formatting
 * ────────────────────────────────────────────────────────────── */

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

function limitLabel(value: number | null): string {
  return value === null ? "আনলিমিটেড" : bn(value.toLocaleString("en-US"));
}

function storageLabel(plan: PricingPlan): string {
  const mb = plan.limits.storageMb;
  if (mb === null) return "আনলিমিটেড";
  return mb >= 1024 ? `${bn(mb / 1024)} GB` : `${bn(mb)} MB`;
}

function themeLabel(plan: PricingPlan): string {
  const names: Record<string, string> = { nokshi: "Nokshi", bazar: "Bazar", studio: "Studio" };
  if (plan.limits.themes.length >= 3) return "সব ৩টি";
  return plan.limits.themes.map((code) => names[code] ?? code).join(" + ");
}

const THEME_SWITCHING: Record<string, string> = {
  STARTER_ONLY: "স্টার্টার থিম",
  NOT_ALLOWED: "নেই",
  ALLOWED: "যেকোনো সময়",
};

const DISCOUNTS: Record<string, string> = { BASIC: "বেসিক", ADVANCED: "অ্যাডভান্সড" };

const REPORTS: Record<string, string> = {
  BASIC: "বেসিক",
  CSV: "CSV এক্সপোর্ট",
  ADVANCED: "অ্যাডভান্সড",
  ADVANCED_SCHEDULED: "অ্যাডভান্সড + শিডিউল",
};

const API_ACCESS: Record<string, string> = {
  READ_ONLY_PUBLIC: "পাবলিক রিড",
  READ_WEBHOOKS: "রিড + ওয়েবহুক",
  SCOPED: "স্কোপড",
  FULL: "ফুল অ্যাক্সেস",
};

const SUPPORT: Record<string, string> = {
  COMMUNITY: "কমিউনিটি",
  STANDARD: "স্ট্যান্ডার্ড",
  PRIORITY: "প্রায়োরিটি",
  PRIORITY_ONBOARDING: "প্রায়োরিটি + অনবোর্ডিং",
};

function priceLabel(plan: PricingPlan): string {
  if (plan.monthlyPriceBdt === null) return "কাস্টম";
  if (plan.monthlyPriceBdt === 0) return "৳০";
  return `৳${bn(plan.monthlyPriceBdt.toLocaleString("en-US"))}`;
}

function priceHint(plan: PricingPlan): string {
  if (plan.monthlyPriceBdt === null) return "আপনার প্রয়োজন অনুযায়ী";
  if (plan.monthlyPriceBdt === 0) return "চিরকাল ফ্রি";
  return "প্রতি মাসে";
}

/* ──────────────────────────────────────────────────────────────
 * Table model
 * ────────────────────────────────────────────────────────────── */

function Bool({ on }: { on: boolean }) {
  if (!on) {
    return (
      <span className="text-ink-300" title="নেই">
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E7F7F0] align-middle"
      title="আছে"
    >
      <Check className="h-3 w-3 text-[#0BA678]" strokeWidth={3} />
    </span>
  );
}

type Row = { label: string; value: (plan: PricingPlan) => React.ReactNode };

const GROUPS: Array<{ title: string; rows: Row[] }> = [
  {
    title: "বিক্রয়, ক্যাটালগ ও স্টক",
    rows: [
      { label: "প্রোডাক্ট লিমিট", value: (plan) => limitLabel(plan.limits.products) },
      {
        label: "মাসিক অর্ডার (এর পরে ফি)",
        value: (plan) => limitLabel(plan.limits.monthlyOrders),
      },
      { label: "স্টোরেজ", value: (plan) => storageLabel(plan) },
      {
        label: "ওভারেজ কমিশন",
        value: (plan) => bn(formatRate(plan.limits.overageRate)),
      },
      { label: "বাল্ক ইমপোর্ট/এক্সপোর্ট", value: (plan) => <Bool on={plan.limits.bulkTools} /> },
    ],
  },
  {
    title: "ডিজাইন ও ডোমেইন",
    rows: [
      { label: "থিম", value: (plan) => themeLabel(plan) },
      {
        label: "থিম বদলানো",
        value: (plan) => THEME_SWITCHING[plan.limits.themeSwitching] ?? plan.limits.themeSwitching,
      },
      { label: "সাবডোমেইন", value: (plan) => <Bool on={plan.limits.subdomain} /> },
      { label: "নিজের ডোমেইন", value: (plan) => <Bool on={plan.limits.customDomain} /> },
      {
        label: "ডোমেইন + সাবডোমেইন একসাথে",
        value: (plan) => <Bool on={plan.limits.domainWithSubdomain} />,
      },
    ],
  },
  {
    title: "টিম, অটোমেশন ও রিপোর্ট",
    rows: [
      { label: "স্টাফ seat", value: (plan) => limitLabel(plan.limits.staffSeats) },
      { label: "অটোমেশন", value: (plan) => <Bool on={plan.limits.automation} /> },
      {
        label: "ডিসকাউন্ট",
        value: (plan) => DISCOUNTS[plan.limits.discounts] ?? plan.limits.discounts,
      },
      {
        label: "রিপোর্ট",
        value: (plan) => REPORTS[plan.limits.reports] ?? plan.limits.reports,
      },
      {
        label: "API অ্যাক্সেস",
        value: (plan) => API_ACCESS[plan.limits.apiAccess] ?? plan.limits.apiAccess,
      },
    ],
  },
  {
    title: "সাপোর্ট ও সীমা",
    rows: [
      {
        label: "রিকোয়েস্ট / মিনিট",
        value: (plan) => limitLabel(plan.limits.requestsPerMinute),
      },
      { label: "সাপোর্ট", value: (plan) => SUPPORT[plan.limits.support] ?? plan.limits.support },
      {
        label: "অনবোর্ডিং সহায়তা",
        value: (plan) => <Bool on={plan.features.onboardingAssistance} />,
      },
      {
        label: "প্রায়োরিটি সাপোর্ট",
        value: (plan) => <Bool on={plan.features.prioritySupport} />,
      },
      {
        label: "ট্রায়াল",
        value: (plan) => `${bn(plan.trialDays)} দিন`,
      },
    ],
  },
];

const PLAN_BADGE: Record<string, string> = {
  free: "শুরু এখানেই",
  basic: "বাড়ছে ব্যবসা",
  standard: "জনপ্রিয়",
  pro: "প্রো টিম",
};

const CARD_POINTS: Record<string, string[]> = {
  free: ["২৫টি প্রোডাক্ট", "৫০টি মাসিক অর্ডার", "১ জন স্টাফ", "Nokshi + Bazar থিম", "২.৫০% ওভারেজ"],
  basic: ["২৫০টি প্রোডাক্ট", "৫০০টি মাসিক অর্ডার", "২ জন স্টাফ", "সব ৩টি থিম", "২% ওভারেজ"],
  standard: [
    "১,০০০টি প্রোডাক্ট",
    "২,০০০টি মাসিক অর্ডার",
    "৫ জন স্টাফ",
    "নিজের ডোমেইন",
    "১% ওভারেজ",
  ],
  pro: ["আনলিমিটেড প্রোডাক্ট", "আনলিমিটেড অর্ডার", "১০ জন স্টাফ", "ফুল API + অটোমেশন", "০% ওভারেজ"],
};

/** Card copy stays plain Bengali — the stored plan descriptions are terse DB text. */
const CARD_BLURB: Record<string, string> = {
  free: "ছোট ক্যাটালগ নিয়ে শুরু করার জন্য যথেষ্ট — COD চেকআউট আর মাসে ৫০টি অর্ডার।",
  basic: "নিয়মিত বিক্রি শুরু হলে — বেশি প্রোডাক্ট, সব থিম আর CSV রিপোর্ট।",
  standard: "বাড়তে থাকা দোকানের জন্য — নিজের ডোমেইন, বেশি অর্ডার আর প্রায়োরিটি সাপোর্ট।",
  pro: "বড় টিম ও হাই ভলিউম — আনলিমিটেড প্রোডাক্ট, ফুল API আর অনবোর্ডিং সহায়তা।",
};

const PAYMENT_METHODS = [
  { label: "bKash", tone: "bg-[#E2136E]" },
  { label: "Nagad", tone: "bg-[#F58220]" },
  { label: "SSLCommerz", tone: "bg-[#1F6FD0]" },
  { label: "Visa / Mastercard", tone: "bg-[#1A1F71]" },
  { label: "COD", tone: "bg-[#0F172A]" },
];

const WHY_US = [
  {
    title: "৭ দিনের ফ্রি ট্রায়াল",
    body: "কার্ড ছাড়াই শুরু — পুরো ড্যাশবোর্ড খোলা থাকে।",
  },
  {
    title: "কোনো লুকানো চার্জ নেই",
    body: "শুধু প্ল্যানের মাসিক ফি আর ওভারেজ কমিশন — ব্যস।",
  },
  {
    title: "যেকোনো সময় বাতিল",
    body: "বাধা নেই; বাতিল করলেও ডেটা পড়া যায়, ব্যাকআপ নেওয়া যায়।",
  },
  {
    title: "৫ মিনিটে সেটআপ",
    body: "নম্বর দিয়ে সাইনআপ, থিম বেছে প্রথম প্রোডাক্ট যোগ করুন।",
  },
];

const FAQ = [
  {
    q: "ফ্রি প্ল্যানে কি সত্যিই দোকান চালানো যায়?",
    a: "হ্যাঁ। Free প্ল্যানে ২৫টি প্রোডাক্ট, ৫০টি মাসিক অর্ডার, সাবডোমেইন আর ক্যাশ অন ডেলিভারি চেকআউট আছে। বাড়তি সুবিধা দরকার হলে যেকোনো সময় উপরের প্ল্যানে যেতে পারবেন।",
  },
  {
    q: "ওভারেজ ফি কীভাবে হিসাব হয়?",
    a: "প্ল্যানের মাসিক অর্ডার সীমা পর্যন্ত কোনো কমিশন নেই। এর পরে প্রতিটি অর্ডারের সাবটোটাল (ডেলিভারি চার্জ বাদে, ডিসকাউন্টের পরে) থেকে প্ল্যানের হার বসে। মাস শেষে সব ফি এক ইনভয়েসে যোগ হয়।",
  },
  {
    q: "প্ল্যান কি যেকোনো সময় বদলানো যায়?",
    a: "যায়। আপগ্রেড করলে সাথে সাথে নতুন সীমা প্রযোজ্য হয়; ডাউনগ্রেড পরের বিলিং সাইকেল থেকে কার্যকর হয়। প্ল্যান বদলালে বর্তমান কনটেন্ট মুছে যায় না।",
  },
  {
    q: "নিজের ডোমেইন কোন প্ল্যানে পাওয়া যায়?",
    a: "Standard ও Pro প্ল্যানে সাবডোমেইনের সাথে নিজের ডোমেইন যোগ করা যায়। DNS ভেরিফিকেশন ড্যাশবোর্ডে ধাপে ধাপে দেখানো হয়।",
  },
  {
    q: "বিকাশ, নগদ পেমেন্ট কি এখনই চালু?",
    a: "স্যান্ডবক্স ফ্লো এখনই টেস্ট করা যায়। মার্চেন্ট অনবোর্ডিং শেষে লাইভ ক্রেডেনশিয়াল বসালেই আসল পেমেন্ট চালু হবে — ততক্ষণ COD দিয়ে অর্ডার নেওয়া যায়।",
  },
  {
    q: "বাতিল করলে আমার ডেটা কী হয়?",
    a: "ডেটা মুছে যায় না। দোকান অফলাইন হয়ে যায় এবং প্ল্যানের সীমা Free-তে নেমে আসে; চাইলে আবার সাবস্ক্রাইব করে আগের জায়গা থেকেই শুরু করতে পারবেন।",
  },
];

/* ──────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────── */

export default async function PricingPage() {
  const plans = await pricingMatrix();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#e8eeeb] bg-gradient-to-b from-[#eefaf5] via-[#f8fdfb] to-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(55%_80%_at_50%_0%,#d6f3e8_0%,rgba(255,255,255,0)_75%)]" />
        <div className="relative mx-auto max-w-3xl px-4 pt-14 pb-12 text-center sm:px-6 sm:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8ede4] bg-white/80 px-3 py-1 text-[10.5px] font-semibold text-[#0B7A5B] shadow-[0_1px_2px_rgba(13,42,32,0.04)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0BA678]" />
            সব মূল্য BDT-এ
          </span>

          <h1 className="mt-5 text-[32px] leading-[1.2] font-bold tracking-[-0.02em] text-ink-900 sm:text-[46px] sm:leading-[1.15]">
            ফ্রি দিয়ে শুরু করুন,
            <br />
            বাড়লে <span className="text-[#0B9A6E]">বড় প্ল্যান</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-[13px] leading-7 text-ink-500 sm:text-[14px]">
            প্রতি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত। তার পরে প্রতিটি অর্ডারে ছোট একটি
            প্ল্যাটফর্ম কমিশন — যত উপরের প্ল্যান, তত কম হার।
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-ink-500">
            {["৭ দিনের ফ্রি ট্রায়াল", "কার্ড লাগে না", "যেকোনো সময় বাতিল"].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#0BA678]" strokeWidth={2.8} />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-[1160px] px-4 pt-8 pb-12 sm:px-6">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const featured = plan.code === "standard";
            return (
              <div
                key={plan.code}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
                  featured
                    ? "border-[#0BA678] shadow-[0_20px_45px_-28px_rgba(11,166,120,0.55)] ring-1 ring-[#0BA678]/15 lg:-mt-2 lg:mb-2"
                    : "border-[#e7eeea] shadow-[0_1px_2px_rgba(13,42,32,0.04)]"
                }`}
              >
                {featured ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0BA678] px-2.5 py-0.5 text-[8.5px] font-bold text-white">
                    জনপ্রিয়
                  </span>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-ink-900">{plan.name}</p>
                  {featured ? null : (
                    <span className="rounded-full bg-[#E7F7F0] px-2 py-0.5 text-[8.5px] font-semibold text-[#0B7A5B]">
                      {PLAN_BADGE[plan.code]}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[28px] leading-none font-bold tracking-tight text-ink-900">
                  {priceLabel(plan)}
                  {plan.monthlyPriceBdt ? (
                    <span className="ml-1 text-[10px] font-medium text-ink-400">/মাস</span>
                  ) : null}
                </p>
                <p className="mt-1 text-[9.5px] text-ink-400">{priceHint(plan)}</p>

                <p className="mt-3 min-h-[36px] text-[11px] leading-5 text-ink-500">
                  {CARD_BLURB[plan.code] ?? plan.description}
                </p>

                <ul className="mt-3 flex-1 space-y-2 border-t border-[#f0f4f2] pt-3.5 text-[11px] text-ink-600">
                  {(CARD_POINTS[plan.code] ?? []).map((point) => (
                    <li key={point} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0BA678]" strokeWidth={2.8} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-4 inline-flex items-center justify-center rounded-[9px] px-3 py-2 text-[11.5px] font-semibold transition ${
                    featured
                      ? "bg-[#0BA678] text-white shadow-[0_10px_22px_-12px_rgba(11,166,120,0.95)] hover:bg-[#099569]"
                      : "border border-[#dfe8e4] bg-white text-ink-800 hover:bg-[#f4f8f6]"
                  }`}
                >
                  {plan.monthlyPriceBdt === null ? "কথা বলুন" : "ফ্রি শুরু করুন"}
                </Link>

                <p className="mt-2 text-center text-[9px] text-ink-400">
                  {bn(plan.trialDays)} দিনের ট্রায়াল · ওভারেজ {bn(formatRate(plan.limits.overageRate))}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: "৭ দিন", label: "ফ্রি ট্রায়াল, কার্ড ছাড়াই" },
            { value: "৳০", label: "শুরু করার সেটআপ ফি" },
            { value: "৪টি", label: "পেমেন্ট মেথড, এক চেকআউটে" },
            { value: "২৪/৭", label: "ড্যাশবোর্ড ও বাংলা সাপোর্ট" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#e7eeea] bg-white px-4 py-4">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E7F7F0]">
                <CircleCheck className="h-4 w-4 text-[#0BA678]" strokeWidth={2} />
              </span>
              <p className="mt-2.5 text-[20px] font-bold tracking-tight text-ink-900">{stat.value}</p>
              <p className="mt-0.5 text-[10.5px] leading-5 text-ink-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
              <Sparkles className="h-3 w-3" />
              প্ল্যান তুলনা
            </span>
            <h2 className="mt-3 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
              বিস্তারিত ফিচার তুলনা
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-ink-500">
              প্রতিটি প্ল্যানে কী কী আছে, এক নজরে দেখে নিন। প্ল্যান বদলালে সাথে সাথে প্রযোজ্য হবে।
            </p>
          </div>
          <Link
            href="/features"
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:bg-[#f4f8f6]"
          >
            সব ফিচার দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#e7eeea] bg-white">
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f7faf9]">
                    <th className="sticky left-0 z-10 w-[30%] bg-[#f7faf9] px-5 py-4 text-[10.5px] font-semibold tracking-wide text-ink-500">
                      ফিচার
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.code} className="px-4 py-4 text-center">
                        <p className="text-[12px] font-bold text-ink-900">{plan.name}</p>
                        <p className="mt-0.5 text-[10px] font-medium text-ink-400">{priceLabel(plan)}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((group) => (
                    <Fragment key={group.title}>
                      <tr className="border-t border-[#eef3f0]">
                        <td
                          colSpan={plans.length + 1}
                          className="bg-[#fbfdfc] px-5 py-2.5 text-[10px] font-semibold tracking-wide text-[#0B7A5B]"
                        >
                          {group.title}
                        </td>
                      </tr>
                      {group.rows.map((row) => (
                        <tr key={row.label} className="border-t border-[#f4f8f6]">
                          <td className="sticky left-0 z-10 border-r border-[#f4f8f6] bg-white px-5 py-2.5 text-[11.5px] text-ink-600">
                            {row.label}
                          </td>
                          {plans.map((plan) => (
                            <td
                              key={plan.code}
                              className="px-4 py-2.5 text-center text-[11.5px] font-medium text-ink-800"
                            >
                              {row.value(plan)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white via-white/70 to-transparent lg:hidden"
            />
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-400 lg:hidden">
          <ArrowRight className="h-3.5 w-3.5" />
          টেবিলটি ডানে-বাঁয়ে স্ক্রল করে বাকি প্ল্যান দেখুন।
        </p>
      </section>

      {/* Payments */}
      <section className="mx-auto max-w-[1160px] px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-[#e7eeea] bg-[#fbfdfc] px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-800">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0BA678]" /> সব পেমেন্ট, এক চেকআউটে
              </p>
              <p className="mt-1 text-[10.5px] leading-5 text-ink-500">
                মার্চেন্ট অনবোর্ডিং শেষে গেটওয়ে লাইভ হয় — স্যান্ডবক্সে আগেই পুরো ফ্লো টেস্ট করা যায়।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method.label}
                  className={`rounded-md px-2 py-1 text-[9px] font-semibold text-white ${method.tone}`}
                >
                  {method.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto max-w-[1160px] px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-[#e7eeea] bg-white p-6 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#E7F7F0]">
                <CircleCheck className="h-5 w-5 text-[#0BA678]" strokeWidth={2} />
              </span>
              <h2 className="mt-3 text-[22px] font-bold tracking-tight text-ink-900 sm:text-[24px]">
                কেন ATLaS বেছে নেবেন?
              </h2>
              <p className="mt-2 text-[12.5px] leading-6 text-ink-500">
                লুকানো খরচ নেই, লম্বা চুক্তি নেই — যা দেখছেন, সেটাই দাম। শুরু করুন আজই, দরকার না হলে
                বন্ধ করে দিন।
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
                >
                  ফ্রি শুরু করুন <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center justify-center rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 transition hover:bg-[#f4f8f6]"
                >
                  ফিচার দেখুন
                </Link>
              </div>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {WHY_US.map((item) => (
                <li key={item.title} className="flex gap-2.5 rounded-xl border border-[#edf2ef] bg-[#fbfdfc] p-3.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E7F7F0]">
                    <Check className="h-3 w-3 text-[#0BA678]" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="text-[11.5px] font-semibold text-ink-800">{item.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-5 text-ink-500">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1000px] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
            সাধারণ জিজ্ঞাসা (FAQ)
          </h2>
          <p className="mt-2 text-[12.5px] leading-6 text-ink-500">
            দাম, বিলিং আর প্ল্যান নিয়ে যা সবচেয়ে বেশি জিজ্ঞাসা করা হয়।
          </p>
        </div>

        <div className="mt-7 grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-[#e7eeea] bg-white px-4 py-3.5 transition open:bg-[#fbfdfc]"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[12px] font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[#0BA678] transition group-open:rotate-45" />
              </summary>
              <p className="mt-2.5 text-[11.5px] leading-6 text-ink-500">{item.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-6 text-center text-[10.5px] text-ink-400">
          আরও প্রশ্ন আছে?{" "}
          <Link href="/login" className="font-semibold text-[#0B8F68] hover:underline">
            সাপোর্টে লিখুন
          </Link>
        </p>
      </section>
    </div>
  );
}
