import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { pricingMatrix } from "@/lib/services/billing-service";
import { formatRate, type PlanCode } from "@/lib/plans";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/messages";
import { cn } from "@/lib/cn";

/** Public pricing comparison (PRD §5.1). */

export const dynamic = "force-dynamic";

const COPY = {
  bn: {
    meta: {
      title: "প্রাইসিং",
      description:
        "ফ্রি থেকে Pro — প্রতি প্ল্যানে প্রোডাক্ট, অর্ডার, ডোমেইন, টিম আর প্ল্যাটফর্ম ফি কত, সব এক নজরে।",
    },
    labels: {
      unlimited: "আনলিমিটেড",
      custom: "কাস্টম",
      perMonth: "/মাস",
      perYear: "/বছর",
      feature: "বৈশিষ্ট্য",
      included: "আছে",
      notIncluded: "নেই",
    },
    billing: {
      label: "বিলিং সময়কাল",
      monthly: "মাসিক",
      yearly: "বার্ষিক",
      billedYearly: "বছরে একবার পরিশোধ",
      save: "{percent}% সেভ",
    },
    hero: {
      titleLead: "ফ্রি দিয়ে শুরু,",
      titleAccent: "বাড়লে প্রিমিয়াম",
      body: "প্রতি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত — তার পরে ছোট একটি প্ল্যাটফর্ম কমিশন। যত উপরের প্ল্যান, তত কম হার।",
      highlights: ["কোনো লুকানো চার্জ নেই", "৭ দিনের ফ্রি ট্রায়াল", "যেকোনো সময় বাতিল"],
    },
    card: {
      popular: "সবচেয়ে জনপ্রিয়",
      chips: {
        free: "চিরকাল ফ্রি",
        basic: "বাড়ন্ত ব্যবসা",
        standard: "সবচেয়ে জনপ্রিয়",
        pro: "এন্টারপ্রাইজ",
      },
      quote: "আপনার প্রয়োজনে সাজানো কোট",
      trial: "{days} দিনের ফ্রি ট্রায়াল · ওভারেজ {rate}",
      ctaFree: "ফ্রি শুরু করুন",
      ctaPlan: "শুরু করুন",
      ctaPro: "কথা বলুন",
      themesJoin: " ও ",
      extras: {
        free: "{themes} থিম · COD checkout",
        basic: "বাল্ক ইমপোর্ট · CSV রিপোর্ট · ২ স্টাফ সিট",
        standard: "অটোমেশন · অ্যাডভান্সড রিপোর্ট · প্রায়োরিটি সাপোর্ট",
        pro: "ফুল API · ১০ স্টাফ সিট · ডেডিকেটেড অনবোর্ডিং",
      },
      features: {
        productsUpTo: "{count}টি পর্যন্ত প্রোডাক্ট",
        productsUnlimited: "আনলিমিটেড প্রোডাক্ট",
        ordersMonthly: "মাসে {count}টি অর্ডার ফি-মুক্ত",
        ordersUnlimited: "আনলিমিটেড অর্ডার, ওভারেজ ০%",
        storage: "{size} স্টোরেজ",
        domainBoth: "নিজের ডোমেইন + সাবডোমেইন",
        domainCustom: "নিজের ডোমেইন",
        domainFree: "ফ্রি সাবডোমেইন",
      },
    },
    pageNote: "মূল্য বাংলাদেশি টাকায় (BDT), ভ্যাট প্রযোজ্য নয়। প্ল্যান যেকোনো সময় পরিবর্তন করা যাবে।",
    comparison: {
      title: "বিস্তারিত ফিচার তুলনা",
      lead: "প্রতিটি প্ল্যানে ঠিক কী কী আছে — লিমিট, ডোমেইন, টিম আর ফি এক নজরে।",
      scrollHint: "ডানে-বাঁয়ে স্ক্রোল করে সব কলাম দেখুন",
    },
    matrix: {
      groups: {
        catalogue: "ক্যাটালগ ও অর্ডার",
        domain: "ডোমেইন ও ব্র্যান্ডিং",
        team: "টিম ও মার্কেটিং",
        developer: "ডেভেলপার ও সাপোর্ট",
        fees: "ফি",
      },
      rows: {
        products: "প্রোডাক্ট সীমা",
        orders: "ফি-মুক্ত অর্ডার",
        ordersHint: "প্রতি মাসে",
        storage: "স্টোরেজ",
        themes: "থিম",
        themeSwitching: "থিম বদলানো",
        bulk: "বাল্ক ইমপোর্ট / এক্সপোর্ট",
        automation: "অটোমেশন",
        subdomain: "ফ্রি সাবডোমেইন",
        customDomain: "নিজের ডোমেইন",
        domainBoth: "ডোমেইন + সাবডোমেইন একসাথে",
        seats: "স্টাফ সিট",
        discounts: "ডিসকাউন্ট",
        reports: "রিপোর্ট",
        api: "API অ্যাক্সেস",
        rpm: "রিকোয়েস্ট / মিনিট",
        support: "সাপোর্ট",
        overage: "ওভারেজ কমিশন",
        overageHint: "সীমার পরে প্রতি অর্ডারে",
        trial: "ফ্রি ট্রায়াল",
      },
      themeSwitching: {
        STARTER_ONLY: "শুধু ফ্রি থিম",
        NOT_ALLOWED: "নিজে বদলানো যায় না",
        ALLOWED: "যেকোনো সময়",
      },
      discounts: {
        BASIC: "বেসিক",
        ADVANCED: "অ্যাডভান্সড",
      },
      reports: {
        BASIC: "বেসিক",
        CSV: "CSV এক্সপোর্ট",
        ADVANCED: "অ্যাডভান্সড",
        ADVANCED_SCHEDULED: "অ্যাডভান্সড + শিডিউল",
      },
      apiAccess: {
        READ_ONLY_PUBLIC: "পাবলিক রিড",
        READ_WEBHOOKS: "রিড + ওয়েবহুক",
        SCOPED: "স্কোপড কী",
        FULL: "ফুল অ্যাক্সেস",
      },
      support: {
        COMMUNITY: "কমিউনিটি",
        STANDARD: "স্ট্যান্ডার্ড",
        PRIORITY: "প্রায়োরিটি",
        PRIORITY_ONBOARDING: "ডেডিকেটেড",
      },
      trialDays: "{days} দিন",
    },
    guides: {
      title: "কোন প্ল্যান আপনার জন্য?",
      lead: "আজ কোথায় আছেন সেখান থেকেই শুরু করুন — পরে যেকোনো সময় উপরে যাওয়া যাবে।",
      items: [
        {
          title: "সবে শুরু করছেন?",
          body: "একটি প্রোডাক্ট, একটি অর্ডার — সব ফ্রিতেই টেস্ট করুন। ২৫ প্রোডাক্ট ও মাসে ৫০ অর্ডার পর্যন্ত কোনো খরচ নেই।",
          plan: "Free",
        },
        {
          title: "অর্ডার বাড়ছে?",
          body: "নিয়মিত বিক্রি শুরু হলে Basic-এ ২৫০ প্রোডাক্ট, বাল্ক ইমপোর্ট, CSV রিপোর্ট আর ২টি স্টাফ সিট।",
          plan: "Basic",
        },
        {
          title: "নিজের ব্র্যান্ড গড়ছেন?",
          body: "নিজের ডোমেইন, ৫ জনের টিম, অটোমেশন আর প্রায়োরিটি সাপোর্ট — Standard-এ পুরো সেটআপ।",
          plan: "Standard",
        },
        {
          title: "বড় অপারেশন চালাচ্ছেন?",
          body: "আনলিমিটেড প্রোডাক্ট, ফুল API, ১০টি সিট আর ডেডিকেটেড অনবোর্ডিং — Pro-তে কোনো সীমা নেই।",
          plan: "Pro",
        },
      ],
      ctaFree: "ফ্রি অ্যাকাউন্ট খুলুন",
      ctaTalk: "কথা বলুন",
      note: "কার্ড লাগবে না · ৭ দিনের ট্রায়াল",
    },
    fees: {
      title: "ফি কীভাবে হিসাব হয়",
      items: [
        {
          title: "সীমা পর্যন্ত ০%",
          body: "প্ল্যানের অর্ডার সীমা শেষ হলেই কেবল ওভারেজ কমিশন শুরু হয় — তার আগে প্রতিটি অর্ডার ফি-মুক্ত।",
        },
        {
          title: "ডিসকাউন্ট বাদ দিয়ে হিসাব",
          body: "কমিশন বসে শুধু পণ্যমূল্যের উপর, ডেলিভারি চার্জ বাদ দিয়ে। কুপন বা ডিসকাউন্টও আগে বাদ যায়।",
        },
        {
          title: "মাস শেষে এক ইনভয়েস",
          body: "মাসের সব ওভারেজ এক ইনভয়েসে যোগ হয়; অর্ডার বাতিল বা ফুল রিফান্ড হলে ফি স্বয়ংক্রিয়ভাবে ফেরত।",
        },
      ],
    },
  },
  en: {
    meta: {
      title: "Pricing",
      description:
        "From Free to Pro — how many products, orders, domains, team seats and platform fees each plan includes, all at a glance.",
    },
    labels: {
      unlimited: "Unlimited",
      custom: "Custom",
      perMonth: "/mo",
      perYear: "/yr",
      feature: "Feature",
      included: "Included",
      notIncluded: "Not included",
    },
    billing: {
      label: "Billing period",
      monthly: "Monthly",
      yearly: "Yearly",
      billedYearly: "billed once a year",
      save: "Save {percent}%",
    },
    hero: {
      titleLead: "Start free,",
      titleAccent: "premium as you grow",
      body: "Every plan includes a set number of fee-free orders — after that a small platform commission applies. The higher the plan, the lower the rate.",
      highlights: ["No hidden charges", "7-day free trial", "Cancel anytime"],
    },
    card: {
      popular: "Most popular",
      chips: {
        free: "Free forever",
        basic: "Growing business",
        standard: "Most popular",
        pro: "Enterprise",
      },
      quote: "A quote shaped around your needs",
      trial: "{days}-day free trial · {rate} overage",
      ctaFree: "Start free",
      ctaPlan: "Get started",
      ctaPro: "Talk to us",
      themesJoin: " and ",
      extras: {
        free: "{themes} themes · COD checkout",
        basic: "Bulk import · CSV reports · 2 staff seats",
        standard: "Automation · Advanced reports · Priority support",
        pro: "Full API · 10 staff seats · Dedicated onboarding",
      },
      features: {
        productsUpTo: "Up to {count} products",
        productsUnlimited: "Unlimited products",
        ordersMonthly: "{count} fee-free orders a month",
        ordersUnlimited: "Unlimited orders, 0% overage",
        storage: "{size} of storage",
        domainBoth: "Own domain + subdomain",
        domainCustom: "Own domain",
        domainFree: "Free subdomain",
      },
    },
    pageNote: "Prices are in Bangladeshi Taka (BDT) and exclude VAT. You can change plan at any time.",
    comparison: {
      title: "Compare every feature",
      lead: "Exactly what each plan includes — limits, domains, team and fees at a glance.",
      scrollHint: "Scroll sideways to see every column",
    },
    matrix: {
      groups: {
        catalogue: "Catalogue and orders",
        domain: "Domain and branding",
        team: "Team and marketing",
        developer: "Developer and support",
        fees: "Fees",
      },
      rows: {
        products: "Product limit",
        orders: "Fee-free orders",
        ordersHint: "Per month",
        storage: "Storage",
        themes: "Themes",
        themeSwitching: "Theme switching",
        bulk: "Bulk import / export",
        automation: "Automation",
        subdomain: "Free subdomain",
        customDomain: "Own domain",
        domainBoth: "Domain and subdomain together",
        seats: "Staff seats",
        discounts: "Discounts",
        reports: "Reports",
        api: "API access",
        rpm: "Requests / minute",
        support: "Support",
        overage: "Overage commission",
        overageHint: "Per order past the limit",
        trial: "Free trial",
      },
      themeSwitching: {
        STARTER_ONLY: "Free themes only",
        NOT_ALLOWED: "Cannot be changed",
        ALLOWED: "Anytime",
      },
      discounts: {
        BASIC: "Basic",
        ADVANCED: "Advanced",
      },
      reports: {
        BASIC: "Basic",
        CSV: "CSV export",
        ADVANCED: "Advanced",
        ADVANCED_SCHEDULED: "Advanced + scheduled",
      },
      apiAccess: {
        READ_ONLY_PUBLIC: "Public read",
        READ_WEBHOOKS: "Read + webhooks",
        SCOPED: "Scoped keys",
        FULL: "Full access",
      },
      support: {
        COMMUNITY: "Community",
        STANDARD: "Standard",
        PRIORITY: "Priority",
        PRIORITY_ONBOARDING: "Dedicated",
      },
      trialDays: "{days} days",
    },
    guides: {
      title: "Which plan is right for you?",
      lead: "Start where you are today — you can move up whenever you need to.",
      items: [
        {
          title: "Just getting started?",
          body: "One product, one order — test the whole thing for free. Up to 25 products and 50 orders a month at no cost.",
          plan: "Free",
        },
        {
          title: "Orders picking up?",
          body: "Once sales are steady, Basic gives you 250 products, bulk import, CSV reports and two staff seats.",
          plan: "Basic",
        },
        {
          title: "Building your own brand?",
          body: "Your own domain, a team of five, automation and priority support — the full setup on Standard.",
          plan: "Standard",
        },
        {
          title: "Running a bigger operation?",
          body: "Unlimited products, the full API, ten seats and dedicated onboarding — no ceilings on Pro.",
          plan: "Pro",
        },
      ],
      ctaFree: "Create a free account",
      ctaTalk: "Talk to us",
      note: "No card · 7-day trial",
    },
    fees: {
      title: "How the fee is calculated",
      items: [
        {
          title: "0% up to your limit",
          body: "Overage commission only starts once the plan's order limit is used — before that every order is fee-free.",
        },
        {
          title: "Calculated after discounts",
          body: "Commission applies to merchandise value only, excluding delivery charges. Coupons and discounts come off first.",
        },
        {
          title: "One invoice at month end",
          body: "Every overage for the month lands on a single invoice; if an order is cancelled or fully refunded, the fee is reversed automatically.",
        },
      ],
    },
  },
} as const;

type PricingCopy = (typeof COPY)[keyof typeof COPY];

/** English blurbs for plan descriptions (the plan matrix itself is data). */
const PLAN_BLURB_EN: Record<PlanCode, string> = {
  free: "Where every shop starts: 25 products, cash on delivery at checkout and 50 fee-free orders a month.",
  basic: "For a growing business: 250 products, 500 orders a month, bulk import and CSV reports.",
  standard: "For a brand of your own: 1,000 products, 2,000 orders, your own domain and five staff seats.",
  pro: "No ceilings: unlimited products and orders, the full API and dedicated onboarding.",
};

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

type PricingPlan = Awaited<ReturnType<typeof pricingMatrix>>[number];

const nf = new Intl.NumberFormat("en-US");

const THEME_NAMES = new Map<string, string>(THEME_CATALOG.map((theme) => [theme.code, theme.name]));

const THEME_NAMES_FALLBACK: Record<string, string> = {
  nokshi: "Nokshi",
  bazar: "Bazar",
  studio: "Studio",
};

function themeName(code: string): string {
  return THEME_NAMES.get(code) ?? THEME_NAMES_FALLBACK[code] ?? code;
}

/**
 * The ৳ glyph is drawn as a tiny superscript in some bold Bengali fallback
 * faces, so the symbol is always rendered at regular weight next to bold digits.
 */
function Taka({ className }: { className?: string }) {
  return <span className={cn("font-normal", className)}>৳</span>;
}

/** Fills `{name}` placeholders in COPY templates. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

function storageLabel(mb: number | null, unlimited: string): string {
  if (mb === null) return unlimited;
  return mb >= 1024 ? `${nf.format(mb / 1024)} GB` : `${mb} MB`;
}

function limitLabel(value: number | null, unlimited: string): string {
  return value === null ? unlimited : nf.format(value);
}

// ── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.4}
    >
      <path d="M4.5 10.5l3.4 3.4 7.6-8" />
    </svg>
  );
}

function GuideIcon({ name, className }: { name: "store" | "chart" | "globe" | "rocket"; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? "h-5 w-5"} {...common}>
      {name === "store" ? (
        <>
          <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
          <path d="M3 9.5l2-4.5h14l2 4.5a3 3 0 0 1-5.5 1.5A3 3 0 0 1 12 12a3 3 0 0 1-3.5-1A3 3 0 0 1 3 9.5Z" />
          <path d="M9.5 20v-5h5v5" />
        </>
      ) : null}
      {name === "chart" ? (
        <>
          <path d="M4 20h16" />
          <path d="M6.5 16.5V11" />
          <path d="M12 16.5V6" />
          <path d="M17.5 16.5v-8" />
        </>
      ) : null}
      {name === "globe" ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17" />
          <path d="M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5S14.5 18.1 12 20.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5Z" />
        </>
      ) : null}
      {name === "rocket" ? (
        <>
          <path d="M14 4.5c3.5-1 5.5-1 5.5-1s0 2-1 5.5c-.8 2.9-2.6 5-4.9 6.3l-2.9-2.9C12 10.1 11.1 5.4 14 4.5Z" />
          <path d="M10.7 12.4 7.4 9.1 4 10.5l2.6 2.9" />
          <path d="M11.6 13.3l3.3 3.3-1.4 3.4-2.9-2.6" />
          <circle cx="15.2" cy="8.8" r="1.2" />
        </>
      ) : null}
    </svg>
  );
}

// ── Plan cards ───────────────────────────────────────────────────────────────

const CARD_CHIPS: Record<PlanCode, { className: string }> = {
  free: { className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  basic: { className: "border-ink-200 bg-ink-50 text-ink-600" },
  standard: { className: "border-brand-200 bg-brand-50 text-brand-700" },
  pro: { className: "border-violet-200 bg-violet-50 text-violet-700" },
};

/** Five scannable bullets per tier — numbers always come from the plan matrix. */
function cardFeatures(plan: PricingPlan, locale: Locale): string[] {
  const t = COPY[locale];
  const limits = plan.limits;
  const themes = limits.themes.map(themeName).join(t.card.themesJoin);
  const extras: Record<PlanCode, string> = {
    free: fill(t.card.extras.free, { themes }),
    basic: t.card.extras.basic,
    standard: t.card.extras.standard,
    pro: t.card.extras.pro,
  };
  const domain = limits.domainWithSubdomain
    ? t.card.features.domainBoth
    : limits.customDomain
      ? t.card.features.domainCustom
      : t.card.features.domainFree;
  return [
    limits.products === null
      ? t.card.features.productsUnlimited
      : fill(t.card.features.productsUpTo, { count: nf.format(limits.products) }),
    limits.monthlyOrders === null
      ? t.card.features.ordersUnlimited
      : fill(t.card.features.ordersMonthly, { count: nf.format(limits.monthlyOrders) }),
    fill(t.card.features.storage, { size: storageLabel(limits.storageMb, t.labels.unlimited) }),
    domain,
    extras[plan.code],
  ];
}

type BillingPeriod = "monthly" | "yearly";

function PlanCard({
  plan,
  locale,
  period,
}: {
  plan: PricingPlan;
  locale: Locale;
  period: BillingPeriod;
}) {
  const t = COPY[locale];
  const popular = plan.code === "standard";
  const price = period === "yearly" ? plan.yearlyPriceBdt : plan.monthlyPriceBdt;
  const quoteOnly = price === null;
  const chip = CARD_CHIPS[plan.code];
  const yearlySaving =
    period === "yearly" && plan.monthlyPriceBdt && plan.yearlyPriceBdt
      ? Math.round((1 - plan.yearlyPriceBdt / (plan.monthlyPriceBdt * 12)) * 100)
      : 0;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-white p-6 transition",
        popular
          ? "border-brand-500 shadow-xl shadow-brand-900/10 ring-1 ring-brand-500/15"
          : "border-ink-200 shadow-xs hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md",
      )}
    >
      {popular ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-white shadow-sm">
          {t.card.popular}
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-semibold text-ink-900">{plan.name}</p>
        {popular ? null : (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
              chip.className,
            )}
          >
            {t.card.chips[plan.code]}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        {price === null ? (
          <span className="text-2xl font-bold tracking-tight text-ink-900">{t.labels.custom}</span>
        ) : (
          <span className="inline-flex items-baseline gap-0.5 text-4xl leading-none font-bold tracking-tight text-ink-900">
            <Taka />
            <span>{nf.format(price)}</span>
          </span>
        )}
        {price ? (
          <span className="pb-0.5 text-xs font-medium text-ink-500">
            {period === "yearly" ? t.labels.perYear : t.labels.perMonth}
          </span>
        ) : null}
      </div>

      {period === "yearly" && yearlySaving > 0 ? (
        <p className="mt-1.5">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            {fill(t.billing.save, { percent: yearlySaving })}
          </span>
          <span className="ml-1.5 text-[10px] text-ink-500">{t.billing.billedYearly}</span>
        </p>
      ) : null}

      <p className="mt-2 text-[11px] font-medium text-ink-500">
        {quoteOnly
          ? t.card.quote
          : fill(t.card.trial, { days: plan.trialDays, rate: formatRate(plan.limits.overageRate) })}
      </p>

      <p className="mt-4 min-h-[3.25rem] text-xs leading-relaxed text-ink-600">
        {locale === "en" ? PLAN_BLURB_EN[plan.code] : plan.description}
      </p>

      <ul className="mt-4 space-y-2.5 border-t border-ink-100 pt-4">
        {cardFeatures(plan, locale).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs text-ink-700">
            <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
              <CheckIcon className="h-3 w-3" />
            </span>
            <span className="leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <ButtonLink
          href={quoteOnly && plan.code === "pro" ? "/contact" : "/signup"}
          variant={popular ? "primary" : "outline"}
          size="md"
          className="w-full"
        >
          {plan.code === "pro" ? t.card.ctaPro : plan.code === "free" ? t.card.ctaFree : t.card.ctaPlan}
        </ButtonLink>
      </div>
    </div>
  );
}

// ── Comparison table ─────────────────────────────────────────────────────────

type ChipTone = "brand" | "violet" | "neutral" | "danger";

const CHIP_TONES: Record<ChipTone, string> = {
  brand: "border-brand-200 bg-brand-50 text-brand-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  neutral: "border-ink-200 bg-ink-50 text-ink-600",
  danger: "border-red-200 bg-red-50 text-red-600",
};

function ValueChip({ tone = "neutral", children }: { tone?: ChipTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        CHIP_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

function BoolCell({ value, t }: { value: boolean; t: PricingCopy }) {
  return value ? (
    <span className="inline-flex items-center justify-center text-emerald-600">
      <CheckIcon className="h-4 w-4" />
      <span className="sr-only">{t.labels.included}</span>
    </span>
  ) : (
    <span className="text-ink-300">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t.labels.notIncluded}</span>
    </span>
  );
}

/** Chip tones per level; the labels live in COPY. */
const THEME_SWITCHING: Record<PricingPlan["limits"]["themeSwitching"], ChipTone> = {
  STARTER_ONLY: "neutral",
  NOT_ALLOWED: "danger",
  ALLOWED: "brand",
};

const DISCOUNTS: Record<PricingPlan["limits"]["discounts"], ChipTone> = {
  BASIC: "neutral",
  ADVANCED: "brand",
};

const REPORTS: Record<PricingPlan["limits"]["reports"], ChipTone> = {
  BASIC: "neutral",
  CSV: "neutral",
  ADVANCED: "brand",
  ADVANCED_SCHEDULED: "violet",
};

const API_ACCESS: Record<PricingPlan["limits"]["apiAccess"], ChipTone> = {
  READ_ONLY_PUBLIC: "neutral",
  READ_WEBHOOKS: "neutral",
  SCOPED: "brand",
  FULL: "violet",
};

const SUPPORT: Record<PricingPlan["limits"]["support"], ChipTone> = {
  COMMUNITY: "neutral",
  STANDARD: "neutral",
  PRIORITY: "brand",
  PRIORITY_ONBOARDING: "violet",
};

type Row =
  | { kind: "group"; label: string }
  | { kind: "row"; label: string; hint?: string; value: (plan: PricingPlan) => React.ReactNode };

function comparisonRows(t: PricingCopy): Row[] {
  return [
    { kind: "group", label: t.matrix.groups.catalogue },
    {
      kind: "row",
      label: t.matrix.rows.products,
      value: (plan) =>
        plan.limits.products === null ? (
          <ValueChip tone="brand">{t.labels.unlimited}</ValueChip>
        ) : (
          <span className="font-medium text-ink-800">
            {limitLabel(plan.limits.products, t.labels.unlimited)}
          </span>
        ),
    },
    {
      kind: "row",
      label: t.matrix.rows.orders,
      hint: t.matrix.rows.ordersHint,
      value: (plan) =>
        plan.limits.monthlyOrders === null ? (
          <ValueChip tone="brand">{t.labels.unlimited}</ValueChip>
        ) : (
          <span className="font-medium text-ink-800">
            {limitLabel(plan.limits.monthlyOrders, t.labels.unlimited)}
          </span>
        ),
    },
    {
      kind: "row",
      label: t.matrix.rows.storage,
      value: (plan) => (
        <span className="text-ink-700">{storageLabel(plan.limits.storageMb, t.labels.unlimited)}</span>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.themes,
      value: (plan) => (
        <span className="text-ink-700">{plan.limits.themes.map(themeName).join(", ")}</span>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.themeSwitching,
      value: (plan) => (
        <ValueChip tone={THEME_SWITCHING[plan.limits.themeSwitching]}>
          {t.matrix.themeSwitching[plan.limits.themeSwitching]}
        </ValueChip>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.bulk,
      value: (plan) => <BoolCell value={plan.limits.bulkTools} t={t} />,
    },
    {
      kind: "row",
      label: t.matrix.rows.automation,
      value: (plan) => <BoolCell value={plan.limits.automation} t={t} />,
    },

    { kind: "group", label: t.matrix.groups.domain },
    {
      kind: "row",
      label: t.matrix.rows.subdomain,
      value: (plan) => <BoolCell value={plan.limits.subdomain} t={t} />,
    },
    {
      kind: "row",
      label: t.matrix.rows.customDomain,
      value: (plan) => <BoolCell value={plan.limits.customDomain} t={t} />,
    },
    {
      kind: "row",
      label: t.matrix.rows.domainBoth,
      value: (plan) => <BoolCell value={plan.limits.domainWithSubdomain} t={t} />,
    },

    { kind: "group", label: t.matrix.groups.team },
    {
      kind: "row",
      label: t.matrix.rows.seats,
      value: (plan) => (
        <span className="font-medium text-ink-800">
          {limitLabel(plan.limits.staffSeats, t.labels.unlimited)}
        </span>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.discounts,
      value: (plan) => (
        <ValueChip tone={DISCOUNTS[plan.limits.discounts]}>
          {t.matrix.discounts[plan.limits.discounts]}
        </ValueChip>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.reports,
      value: (plan) => (
        <ValueChip tone={REPORTS[plan.limits.reports]}>
          {t.matrix.reports[plan.limits.reports]}
        </ValueChip>
      ),
    },

    { kind: "group", label: t.matrix.groups.developer },
    {
      kind: "row",
      label: t.matrix.rows.api,
      value: (plan) => (
        <ValueChip tone={API_ACCESS[plan.limits.apiAccess]}>
          {t.matrix.apiAccess[plan.limits.apiAccess]}
        </ValueChip>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.rpm,
      value: (plan) => (
        <span className="font-medium text-ink-800">{nf.format(plan.limits.requestsPerMinute)}</span>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.support,
      value: (plan) => (
        <ValueChip tone={SUPPORT[plan.limits.support]}>{t.matrix.support[plan.limits.support]}</ValueChip>
      ),
    },

    { kind: "group", label: t.matrix.groups.fees },
    {
      kind: "row",
      label: t.matrix.rows.overage,
      hint: t.matrix.rows.overageHint,
      value: (plan) => (
        <span
          className={cn(
            "font-semibold",
            plan.limits.overageRate === 0 ? "text-brand-700" : "text-ink-800",
          )}
        >
          {formatRate(plan.limits.overageRate)}
        </span>
      ),
    },
    {
      kind: "row",
      label: t.matrix.rows.trial,
      value: (plan) => (
        <span className="text-ink-700">
          {plan.trialDays > 0 ? fill(t.matrix.trialDays, { days: plan.trialDays }) : "—"}
        </span>
      ),
    },
  ];
}

function ComparisonTable({
  plans,
  locale,
  period,
}: {
  plans: PricingPlan[];
  locale: Locale;
  period: BillingPeriod;
}) {
  const t = COPY[locale];
  const rows = comparisonRows(t);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 w-[32%] border-b border-ink-200 bg-white px-5 py-4 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase"
              >
                {t.labels.feature}
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.code}
                  scope="col"
                  className={cn(
                    "border-b border-ink-200 px-4 py-4 text-center",
                    plan.code === "standard" ? "bg-brand-50/70" : "bg-white",
                  )}
                >
                  <span className="block text-sm font-semibold text-ink-900">{plan.name}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs font-medium",
                      plan.code === "standard" ? "text-brand-700" : "text-ink-500",
                    )}
                  >
                    {(period === "yearly" ? plan.yearlyPriceBdt : plan.monthlyPriceBdt) === null ? (
                      t.labels.custom
                    ) : (
                      <>
                        <Taka />
                        {nf.format(
                          (period === "yearly" ? plan.yearlyPriceBdt : plan.monthlyPriceBdt) as number,
                        )}
                      </>
                    )}
                    {(period === "yearly" ? plan.yearlyPriceBdt : plan.monthlyPriceBdt)
                      ? period === "yearly"
                        ? t.labels.perYear
                        : t.labels.perMonth
                      : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "group") {
                return (
                  <tr key={`group-${row.label}`}>
                    <th
                      scope="colgroup"
                      colSpan={plans.length + 1}
                      className="border-b border-ink-100 bg-ink-50/80 px-5 py-2 text-left text-[11px] font-semibold tracking-wide text-ink-500 uppercase"
                    >
                      {row.label}
                    </th>
                  </tr>
                );
              }

              return (
                <tr key={row.label} className="group border-b border-ink-100 last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-5 py-3 text-left font-medium text-ink-800 group-hover:bg-ink-50"
                  >
                    {row.label}
                    {row.hint ? (
                      <span className="mt-0.5 block text-[11px] font-normal text-ink-400">{row.hint}</span>
                    ) : null}
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.code}
                      className={cn(
                        "px-4 py-3 text-center align-middle group-hover:bg-ink-50",
                        plan.code === "standard" ? "bg-brand-50/40" : "bg-white",
                      )}
                    >
                      {row.value(plan)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Guidance + fee notes ─────────────────────────────────────────────────────

const GUIDE_ICONS: Array<"store" | "chart" | "globe" | "rocket"> = ["store", "chart", "globe", "rocket"];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const locale = await getLocale();
  const t = COPY[locale];
  const plans = await pricingMatrix();
  const period: BillingPeriod = (await searchParams).period === "yearly" ? "yearly" : "monthly";

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50/80 via-white to-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-14rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="absolute -right-24 top-4 h-64 w-64 rounded-full bg-accent-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#d5d9e2_1px,transparent_1px)] [background-size:22px_22px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 pt-14 pb-12 text-center sm:pt-20">

          <h1 className="mt-5 text-4xl leading-[1.2] font-bold tracking-tight text-ink-900 sm:text-5xl sm:leading-[1.15]">
            {t.hero.titleLead}{" "}
            <span className="relative inline-block text-brand-700">
              {t.hero.titleAccent}
              <svg
                viewBox="0 0 300 18"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute -bottom-1.5 left-0 h-3 w-full text-brand-400 sm:h-4"
              >
                <path
                  d="M3 12C48 4 96 15 147 9c51-6 99 4 150-3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
            {t.hero.body}
          </p>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-ink-600">
            {t.hero.highlights.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-100 text-brand-700">
                  <CheckIcon className="h-2.5 w-2.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:pt-14">
        <div className="mb-7 flex justify-center">
          <div
            role="group"
            aria-label={t.billing.label}
            className="inline-flex rounded-full border border-ink-200 bg-ink-50 p-1"
          >
            {(["monthly", "yearly"] as const).map((value) => (
              <Link
                key={value}
                href={`?period=${value}`}
                scroll={false}
                aria-current={period === value ? "true" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  period === value
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-900",
                )}
              >
                {value === "monthly" ? t.billing.monthly : t.billing.yearly}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.code} plan={plan} locale={locale} period={period} />
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] text-ink-500">{t.pageNote}</p>
      </section>

      {/* Comparison */}
      <section className="border-y border-ink-100 bg-ink-50/50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              {t.comparison.title}
            </h2>
            <p className="mt-2 text-sm text-ink-600">{t.comparison.lead}</p>
          </div>

          <div className="mt-8">
            <ComparisonTable plans={plans} locale={locale} period={period} />
          </div>

          <p className="mt-3 text-center text-[11px] text-ink-400 sm:hidden">{t.comparison.scrollHint}</p>
        </div>
      </section>

      {/* Guidance */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-b from-brand-50/80 to-white p-6 sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl" />

          <div className="relative">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
                <GuideIcon name="chart" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
                  {t.guides.title}
                </h2>
                <p className="mt-1 text-sm text-ink-600">{t.guides.lead}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {t.guides.items.map((guide, index) => (
                <div
                  key={guide.title}
                  className="rounded-xl border border-ink-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-brand-700">
                      <GuideIcon name={GUIDE_ICONS[index]} />
                    </span>
                    <p className="text-sm font-semibold text-ink-900">{guide.title}</p>
                    <span className="ml-auto rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-600">
                      {guide.plan}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-ink-600">{guide.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ButtonLink href="/signup" size="md">
                {t.guides.ctaFree}
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="md">
                {t.guides.ctaTalk}
              </ButtonLink>
              <p className="text-[11px] text-ink-500">{t.guides.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Fee notes */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">{t.fees.title}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {t.fees.items.map((note, index) => (
              <div key={note.title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">{note.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">{note.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
