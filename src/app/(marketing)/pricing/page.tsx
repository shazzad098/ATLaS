import { ButtonLink } from "@/components/ui/button";
import { pricingMatrix } from "@/lib/services/billing-service";
import { formatRate, type PlanCode } from "@/lib/plans";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { cn } from "@/lib/cn";

/** Public pricing comparison (PRD §5.1). */

export const metadata = {
  title: "প্রাইসিং",
  description:
    "ফ্রি থেকে Pro — প্রতি প্ল্যানে প্রোডাক্ট, অর্ডার, ডোমেইন, টিম আর প্ল্যাটফর্ম ফি কত, সব এক নজরে।",
};

/** Prices and limits are editable by Super Admin, so read them per request. */
export const dynamic = "force-dynamic";

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

function storageLabel(mb: number | null): string {
  if (mb === null) return "আনলিমিটেড";
  return mb >= 1024 ? `${nf.format(mb / 1024)} GB` : `${mb} MB`;
}

function limitLabel(value: number | null): string {
  return value === null ? "আনলিমিটেড" : nf.format(value);
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

const CARD_CHIPS: Record<PlanCode, { label: string; className: string }> = {
  free: { label: "চিরকাল ফ্রি", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  basic: { label: "বাড়ন্ত ব্যবসা", className: "border-ink-200 bg-ink-50 text-ink-600" },
  standard: { label: "সবচেয়ে জনপ্রিয়", className: "border-brand-200 bg-brand-50 text-brand-700" },
  pro: { label: "এন্টারপ্রাইজ", className: "border-violet-200 bg-violet-50 text-violet-700" },
};

/** Five scannable bullets per tier — numbers always come from the plan matrix. */
function cardFeatures(plan: PricingPlan): string[] {
  const limits = plan.limits;
  const extras: Record<PlanCode, string> = {
    free: `${limits.themes.map(themeName).join(" ও ")} থিম · COD checkout`,
    basic: "বাল্ক ইমপোর্ট · CSV রিপোর্ট · ২ স্টাফ সিট",
    standard: "অটোমেশন · অ্যাডভান্সড রিপোর্ট · প্রায়োরিটি সাপোর্ট",
    pro: "ফুল API · ১০ স্টাফ সিট · ডেডিকেটেড অনবোর্ডিং",
  };
  const domain = limits.domainWithSubdomain
    ? "নিজের ডোমেইন + সাবডোমেইন"
    : limits.customDomain
      ? "নিজের ডোমেইন"
      : "ফ্রি সাবডোমেইন";
  return [
    limits.products === null ? "আনলিমিটেড প্রোডাক্ট" : `${nf.format(limits.products)}টি পর্যন্ত প্রোডাক্ট`,
    limits.monthlyOrders === null
      ? "আনলিমিটেড অর্ডার, ওভারেজ ০%"
      : `মাসে ${nf.format(limits.monthlyOrders)}টি অর্ডার ফি-মুক্ত`,
    `${storageLabel(limits.storageMb)} স্টোরেজ`,
    domain,
    extras[plan.code],
  ];
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  const popular = plan.code === "standard";
  const quoteOnly = plan.monthlyPriceBdt === null;
  const chip = CARD_CHIPS[plan.code];

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
          সবচেয়ে জনপ্রিয়
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
            {chip.label}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end gap-1.5">
        {plan.monthlyPriceBdt === null ? (
          <span className="text-2xl font-bold tracking-tight text-ink-900">কাস্টম</span>
        ) : (
          <span className="inline-flex items-baseline gap-0.5 text-4xl leading-none font-bold tracking-tight text-ink-900">
            <Taka />
            <span>{nf.format(plan.monthlyPriceBdt)}</span>
          </span>
        )}
        {plan.monthlyPriceBdt ? (
          <span className="pb-0.5 text-xs font-medium text-ink-500">/মাস</span>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] font-medium text-ink-500">
        {quoteOnly
          ? "আপনার প্রয়োজনে সাজানো কোট"
          : `${plan.trialDays} দিনের ফ্রি ট্রায়াল · ওভারেজ ${formatRate(plan.limits.overageRate)}`}
      </p>

      <p className="mt-4 min-h-[3.25rem] text-xs leading-relaxed text-ink-600">{plan.description}</p>

      <ul className="mt-4 space-y-2.5 border-t border-ink-100 pt-4">
        {cardFeatures(plan).map((feature) => (
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
          {plan.code === "pro" ? "কথা বলুন" : plan.code === "free" ? "ফ্রি শুরু করুন" : "শুরু করুন"}
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

function BoolCell({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center justify-center text-emerald-600">
      <CheckIcon className="h-4 w-4" />
      <span className="sr-only">আছে</span>
    </span>
  ) : (
    <span className="text-ink-300">
      <span aria-hidden="true">—</span>
      <span className="sr-only">নেই</span>
    </span>
  );
}

const THEME_SWITCHING: Record<PricingPlan["limits"]["themeSwitching"], { label: string; tone: ChipTone }> = {
  STARTER_ONLY: { label: "শুধু ফ্রি থিম", tone: "neutral" },
  NOT_ALLOWED: { label: "নিজে বদলানো যায় না", tone: "danger" },
  ALLOWED: { label: "যেকোনো সময়", tone: "brand" },
};

const DISCOUNTS: Record<PricingPlan["limits"]["discounts"], { label: string; tone: ChipTone }> = {
  BASIC: { label: "বেসিক", tone: "neutral" },
  ADVANCED: { label: "অ্যাডভান্সড", tone: "brand" },
};

const REPORTS: Record<PricingPlan["limits"]["reports"], { label: string; tone: ChipTone }> = {
  BASIC: { label: "বেসিক", tone: "neutral" },
  CSV: { label: "CSV এক্সপোর্ট", tone: "neutral" },
  ADVANCED: { label: "অ্যাডভান্সড", tone: "brand" },
  ADVANCED_SCHEDULED: { label: "অ্যাডভান্সড + শিডিউল", tone: "violet" },
};

const API_ACCESS: Record<PricingPlan["limits"]["apiAccess"], { label: string; tone: ChipTone }> = {
  READ_ONLY_PUBLIC: { label: "পাবলিক রিড", tone: "neutral" },
  READ_WEBHOOKS: { label: "রিড + ওয়েবহুক", tone: "neutral" },
  SCOPED: { label: "স্কোপড কী", tone: "brand" },
  FULL: { label: "ফুল অ্যাক্সেস", tone: "violet" },
};

const SUPPORT: Record<PricingPlan["limits"]["support"], { label: string; tone: ChipTone }> = {
  COMMUNITY: { label: "কমিউনিটি", tone: "neutral" },
  STANDARD: { label: "স্ট্যান্ডার্ড", tone: "neutral" },
  PRIORITY: { label: "প্রায়োরিটি", tone: "brand" },
  PRIORITY_ONBOARDING: { label: "ডেডিকেটেড", tone: "violet" },
};

type Row =
  | { kind: "group"; label: string }
  | { kind: "row"; label: string; hint?: string; value: (plan: PricingPlan) => React.ReactNode };

const ROWS: Row[] = [
  { kind: "group", label: "ক্যাটালগ ও অর্ডার" },
  {
    kind: "row",
    label: "প্রোডাক্ট সীমা",
    value: (plan) =>
      plan.limits.products === null ? (
        <ValueChip tone="brand">আনলিমিটেড</ValueChip>
      ) : (
        <span className="font-medium text-ink-800">{limitLabel(plan.limits.products)}</span>
      ),
  },
  {
    kind: "row",
    label: "ফি-মুক্ত অর্ডার",
    hint: "প্রতি মাসে",
    value: (plan) =>
      plan.limits.monthlyOrders === null ? (
        <ValueChip tone="brand">আনলিমিটেড</ValueChip>
      ) : (
        <span className="font-medium text-ink-800">{limitLabel(plan.limits.monthlyOrders)}</span>
      ),
  },
  {
    kind: "row",
    label: "স্টোরেজ",
    value: (plan) => <span className="text-ink-700">{storageLabel(plan.limits.storageMb)}</span>,
  },
  {
    kind: "row",
    label: "থিম",
    value: (plan) => (
      <span className="text-ink-700">{plan.limits.themes.map(themeName).join(", ")}</span>
    ),
  },
  {
    kind: "row",
    label: "থিম বদলানো",
    value: (plan) => {
      const meta = THEME_SWITCHING[plan.limits.themeSwitching];
      return <ValueChip tone={meta.tone}>{meta.label}</ValueChip>;
    },
  },
  {
    kind: "row",
    label: "বাল্ক ইমপোর্ট / এক্সপোর্ট",
    value: (plan) => <BoolCell value={plan.limits.bulkTools} />,
  },
  {
    kind: "row",
    label: "অটোমেশন",
    value: (plan) => <BoolCell value={plan.limits.automation} />,
  },

  { kind: "group", label: "ডোমেইন ও ব্র্যান্ডিং" },
  {
    kind: "row",
    label: "ফ্রি সাবডোমেইন",
    value: (plan) => <BoolCell value={plan.limits.subdomain} />,
  },
  {
    kind: "row",
    label: "নিজের ডোমেইন",
    value: (plan) => <BoolCell value={plan.limits.customDomain} />,
  },
  {
    kind: "row",
    label: "ডোমেইন + সাবডোমেইন একসাথে",
    value: (plan) => <BoolCell value={plan.limits.domainWithSubdomain} />,
  },

  { kind: "group", label: "টিম ও মার্কেটিং" },
  {
    kind: "row",
    label: "স্টাফ সিট",
    value: (plan) => (
      <span className="font-medium text-ink-800">{limitLabel(plan.limits.staffSeats)}</span>
    ),
  },
  {
    kind: "row",
    label: "ডিসকাউন্ট",
    value: (plan) => {
      const meta = DISCOUNTS[plan.limits.discounts];
      return <ValueChip tone={meta.tone}>{meta.label}</ValueChip>;
    },
  },
  {
    kind: "row",
    label: "রিপোর্ট",
    value: (plan) => {
      const meta = REPORTS[plan.limits.reports];
      return <ValueChip tone={meta.tone}>{meta.label}</ValueChip>;
    },
  },

  { kind: "group", label: "ডেভেলপার ও সাপোর্ট" },
  {
    kind: "row",
    label: "API অ্যাক্সেস",
    value: (plan) => {
      const meta = API_ACCESS[plan.limits.apiAccess];
      return <ValueChip tone={meta.tone}>{meta.label}</ValueChip>;
    },
  },
  {
    kind: "row",
    label: "রিকোয়েস্ট / মিনিট",
    value: (plan) => (
      <span className="font-medium text-ink-800">{nf.format(plan.limits.requestsPerMinute)}</span>
    ),
  },
  {
    kind: "row",
    label: "সাপোর্ট",
    value: (plan) => {
      const meta = SUPPORT[plan.limits.support];
      return <ValueChip tone={meta.tone}>{meta.label}</ValueChip>;
    },
  },

  { kind: "group", label: "ফি" },
  {
    kind: "row",
    label: "ওভারেজ কমিশন",
    hint: "সীমার পরে প্রতি অর্ডারে",
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
    label: "ফ্রি ট্রায়াল",
    value: (plan) => (
      <span className="text-ink-700">
        {plan.trialDays > 0 ? `${plan.trialDays} দিন` : "—"}
      </span>
    ),
  },
];

function ComparisonTable({ plans }: { plans: PricingPlan[] }) {
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
                বৈশিষ্ট্য
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
                    {plan.monthlyPriceBdt === null ? (
                      "কাস্টম"
                    ) : (
                      <>
                        <Taka />
                        {nf.format(plan.monthlyPriceBdt)}
                      </>
                    )}
                    {plan.monthlyPriceBdt ? "/মাস" : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
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

const GUIDES: Array<{
  icon: "store" | "chart" | "globe" | "rocket";
  title: string;
  body: string;
  plan: string;
}> = [
  {
    icon: "store",
    title: "সবে শুরু করছেন?",
    body: "একটি প্রোডাক্ট, একটি অর্ডার — সব ফ্রিতেই টেস্ট করুন। ২৫ প্রোডাক্ট ও মাসে ৫০ অর্ডার পর্যন্ত কোনো খরচ নেই।",
    plan: "Free",
  },
  {
    icon: "chart",
    title: "অর্ডার বাড়ছে?",
    body: "নিয়মিত বিক্রি শুরু হলে Basic-এ ২৫০ প্রোডাক্ট, বাল্ক ইমপোর্ট, CSV রিপোর্ট আর ২টি স্টাফ সিট।",
    plan: "Basic",
  },
  {
    icon: "globe",
    title: "নিজের ব্র্যান্ড গড়ছেন?",
    body: "নিজের ডোমেইন, ৫ জনের টিম, অটোমেশন আর প্রায়োরিটি সাপোর্ট — Standard-এ পুরো সেটআপ।",
    plan: "Standard",
  },
  {
    icon: "rocket",
    title: "বড় অপারেশন চালাচ্ছেন?",
    body: "আনলিমিটেড প্রোডাক্ট, ফুল API, ১০টি সিট আর ডেডিকেটেড অনবোর্ডিং — Pro-তে কোনো সীমা নেই।",
    plan: "Pro",
  },
];

const FEE_NOTES = [
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
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PricingPage() {
  const plans = await pricingMatrix();

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
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-medium text-brand-800 shadow-xs backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            প্রাইসিং প্ল্যান
          </span>

          <h1 className="mt-5 text-4xl leading-[1.2] font-bold tracking-tight text-ink-900 sm:text-5xl sm:leading-[1.15]">
            ফ্রি দিয়ে শুরু,{" "}
            <span className="relative inline-block text-brand-700">
              বাড়লে প্রিমিয়াম
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
            প্রতি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত — তার পরে ছোট একটি প্ল্যাটফর্ম কমিশন।
            যত উপরের প্ল্যান, তত কম হার।
          </p>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-ink-600">
            {["কোনো লুকানো চার্জ নেই", "৭ দিনের ফ্রি ট্রায়াল", "যেকোনো সময় বাতিল"].map((item) => (
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
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {plans.map((plan) => (
            <PlanCard key={plan.code} plan={plan} />
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] text-ink-500">
          মূল্য বাংলাদেশি টাকায় (BDT), ভ্যাট প্রযোজ্য নয়। প্ল্যান যেকোনো সময় পরিবর্তন করা যাবে।
        </p>
      </section>

      {/* Comparison */}
      <section className="border-y border-ink-100 bg-ink-50/50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              বিস্তারিত ফিচার তুলনা
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              প্রতিটি প্ল্যানে ঠিক কী কী আছে — লিমিট, ডোমেইন, টিম আর ফি এক নজরে।
            </p>
          </div>

          <div className="mt-8">
            <ComparisonTable plans={plans} />
          </div>

          <p className="mt-3 text-center text-[11px] text-ink-400 sm:hidden">
            ডানে-বাঁয়ে স্ক্রোল করে সব কলাম দেখুন
          </p>
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
                  কোন প্ল্যান আপনার জন্য?
                </h2>
                <p className="mt-1 text-sm text-ink-600">
                  আজ কোথায় আছেন সেখান থেকেই শুরু করুন — পরে যেকোনো সময় উপরে যাওয়া যাবে।
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {GUIDES.map((guide) => (
                <div
                  key={guide.title}
                  className="rounded-xl border border-ink-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-50 text-brand-700">
                      <GuideIcon name={guide.icon} />
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
                ফ্রি অ্যাকাউন্ট খুলুন
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="md">
                কথা বলুন
              </ButtonLink>
              <p className="text-[11px] text-ink-500">কার্ড লাগবে না · ৭ দিনের ট্রায়াল</p>
            </div>
          </div>
        </div>
      </section>

      {/* Fee notes */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">ফি কীভাবে হিসাব হয়</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {FEE_NOTES.map((note, index) => (
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
