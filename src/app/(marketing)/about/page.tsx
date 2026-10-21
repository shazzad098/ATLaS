import { ButtonLink } from "@/components/ui/button";
import { PAYMENT_PROVIDERS } from "@/lib/payments";
import { PLAN_CODES } from "@/lib/plans";
import { THEME_CATALOG } from "@/lib/theme-catalog";

/** About ATLaS (PRD §4.1, §2 differentiation). */

export const metadata = {
  title: "আমাদের সম্পর্কে",
  description:
    "ATLaS কেন তৈরি — বাংলাদেশের ছোট ব্যবসার জন্য একটি সম্পূর্ণ, সাশ্রয়ী ই-কমার্স স্টোর বিল্ডার।",
};

const PRINCIPLES = [
  {
    title: "বাংলাদেশ আগে, তারপর বাকি সব",
    body: "বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন ডেলিভারি — চেকআউটের প্রথম সারিতে। দাম BDT-তে, সময় Asia/Dhaka, ইন্টারফেস বাংলা ও ইংরেজি দুটোতেই।",
  },
  {
    title: "একই ডেটা, অনেক রকম দোকান",
    body: "থিম বদলালে প্রোডাক্ট, অর্ডার বা কাস্টমার বদলায় না। প্রতিটি থিম একই সেকশন কনট্র্যাক্ট ব্যবহার করে, তাই নতুন থিম মানে নতুন করে সব বানানো নয়।",
  },
  {
    title: "লুকানো খরচ নেই",
    body: "প্রতিটি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত; তার পরে যে কমিশন, সেটি ইনভয়েসে অর্ডার রেফারেন্সসহ দেখানো হয়। বাতিল বা পুরো রিফান্ড হওয়া অর্ডারের ফি স্বয়ংক্রিয়ভাবে বাতিল হয়।",
  },
  {
    title: "ডাউনগ্রেডে ডেটা হারায় না",
    body: "প্ল্যান ছোট করলে শুধু নতুন তৈরি বন্ধ হয় — পুরোনো প্রোডাক্ট পড়া ও এডিট করা যায়, এক্সপোর্ট সবসময় খোলা। সাসপেনশনেও ডেটা সংরক্ষিত থাকে।",
  },
  {
    title: "নিরাপত্তা আলাদা ফিচার নয়",
    body: "প্রতিটি রিকোয়েস্টে tenant boundary সার্ভারে যাচাই হয়, পেমেন্ট webhook HMAC দিয়ে সাইন করা, পাসওয়ার্ড bcrypt-এ, গেটওয়ে ক্রেডেনশিয়াল এনক্রিপ্টেড।",
  },
  {
    title: "ছোট ও বড় দোকান, একই লাইনে",
    body: "২৫টি প্রোডাক্টের হোম বেকারি আর ১০,০০০ প্রোডাক্টের ব্র্যান্ড — একই প্ল্যাটফর্মে, প্ল্যান অনুযায়ী আলাদা কোটা, রিপোর্ট আর API অ্যাক্সেস নিয়ে।",
  },
];

const BEFORE = [
  "অর্ডার আসে ইনবক্সে, ঠিকানা ওঠে খাতায়",
  "স্টক মেলাতে হয় Excel-এ, হাতে",
  "কোন অর্ডার কোথায় — জানতে ফোন করতে হয়",
  "মাস শেষে পেমেন্ট আর ডেলিভারির হিসাব আলাদা",
];

const AFTER = [
  "সব অর্ডার এক ড্যাশবোর্ডে, স্ট্যাটাসসহ",
  "স্টক নিজে কমে, ইনভেন্টরি লেজার থাকে",
  "কাস্টমার নিজেই অর্ডার ট্র্যাক করে",
  "বিকাশ/নগদ/SSLCommerz + COD এক checkout-এ",
];

const PROMISES = [
  "কার্ড ছাড়া ৭ দিনের ট্রায়াল",
  "ডাউনগ্রেডে ডেটা মুছে না",
  "প্রতি মাসে অর্ডার-লেভেল ইনভয়েস",
  "বাংলায় সাপোর্ট, কর্মদিবসে উত্তর",
];

type IconName =
  | "language"
  | "layers"
  | "receipt"
  | "arrow-down"
  | "shield"
  | "scale"
  | "users"
  | "sparkles"
  | "handshake"
  | "wallet"
  | "chart"
  | "terminal"
  | "store"
  | "check";

function Icon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {    language: (
      <>
        <path d="M4 5h9M8.5 5c0 4.5-2.6 8.2-5.5 10" />
        <path d="M6 10.5c1.6 2.2 3.6 3.6 6 4.5" />
        <path d="M13 20l4-11 4 11M14.6 16h4.8" />
      </>
    ),
    layers: (
      <>
        <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" />
        <path d="m4 12 8 4.5 8-4.5" />
        <path d="m4 16 8 4.5 8-4.5" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    "arrow-down": (
      <>
        <path d="M12 4v12" />
        <path d="m7 11 5 5 5-5" />
        <path d="M5 20h14" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 4.5 6v6c0 4.2 3 7.5 7.5 8.5 4.5-1 7.5-4.3 7.5-8.5V6L12 3.5Z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
    scale: (
      <>
        <path d="M12 4v16M8 20h8" />
        <path d="M12 7 5 9l3 5c1.7-.6 3.4-.6 5 0" />
        <path d="m12 7 7 2-3 5c-1.7-.6-3.4-.6-5 0" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
        <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 15.4c1.6.6 2.7 2.2 3 4.6" />
      </>
    ),
    sparkles: (
      <>
        <path d="M11 3.5 12.6 8l4.4 1.6-4.4 1.6L11 15.7 9.4 11.2 5 9.6 9.4 8 11 3.5Z" />
        <path d="M17.5 14l.9 2.4 2.6 1-2.6 1-.9 2.4-.9-2.4-2.6-1 2.6-1 .9-2.4Z" />
      </>
    ),
    handshake: (
      <>
        <path d="m7 12 3-3 2.5 2.5L15 9l3 3" />
        <path d="M4.5 13.5 8 17c.8.8 2 .8 2.8 0l.7-.7" />
        <path d="m19.5 13.5-3.4 3.4c-.8.8-2 .8-2.8 0l-1.3-1.2" />
      </>
    ),
    wallet: (
      <>
        <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
        <path d="M3.5 10h17" />
        <circle cx="17" cy="14.5" r="1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20h16" />
        <path d="M7 16.5V11M12 16.5V5.5M17 16.5v-8" />
      </>
    ),
    terminal: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="m8 10 2.5 2.5L8 15M13 15h4" />
      </>
    ),
    store: (
      <>
        <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
        <path d="M3 9.5l2-4.5h14l2 4.5a3 3 0 0 1-5.5 1.5A3 3 0 0 1 12 12a3 3 0 0 1-3.5-1A3 3 0 0 1 3 9.5Z" />
        <path d="M9.5 20v-5h5v5" />
      </>
    ),
    check: <path d="m5 10.5 3.4 3.4 7.6-8" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className ?? "h-5 w-5"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
    >
      {paths[name]}
    </svg>
  );
}

const PRINCIPLE_ICONS: IconName[] = ["language", "layers", "receipt", "arrow-down", "shield", "scale"];

const STATS = [
  {
    label: "থিম",
    value: `${THEME_CATALOG.length}টি`,
    hint: THEME_CATALOG.map((theme) => theme.name).join(", "),
    icon: "layers" as IconName,
  },
  {
    label: "পেমেন্ট",
    value: `${PAYMENT_PROVIDERS.length}টি`,
    hint: "bKash, Nagad, SSLCommerz, COD",
    icon: "wallet" as IconName,
  },
  {
    label: "প্ল্যান",
    value: `${PLAN_CODES.length}টি`,
    hint: "Free, Basic, Standard, Pro",
    icon: "chart" as IconName,
  },
  {
    label: "API",
    value: "REST v1",
    hint: "OpenAPI 3.1 + webhook signature",
    icon: "terminal" as IconName,
  },
];

export default function AboutPage() {
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

        <div className="relative mx-auto max-w-3xl px-4 pt-14 pb-14 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-medium text-brand-800 shadow-xs backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            আমাদের সম্পর্কে
          </span>

          <h1 className="mt-5 text-3xl leading-[1.25] font-bold tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.18]">
            ছোট ব্যবসার জন্য বড় প্লাটফর্ম —{" "}
            <span className="relative inline-block text-brand-700">
              কোনো কোড ছাড়াই
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

          <p className="mx-auto mt-7 max-w-2xl text-sm leading-relaxed text-ink-600 sm:text-base">
            বাংলাদেশে হাজারো উদ্যোক্তা প্রতিদিন Facebook পেজে অর্ডার নেন, মেসেজে কাস্টমারের ঠিকানা
            লিখে রাখেন, আর Excel-এ স্টক মেলান। ATLaS সেই কাজটুকু এক জায়গায় আনে — দোকান, প্রোডাক্ট,
            অর্ডার, পেমেন্ট আর ডেলিভারি, সব একটি অ্যাডমিনে।
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
            লক্ষ্য পরিষ্কার — একজন উদ্যোক্তা রাত ১০টায় মোবাইল থেকে নিজের প্রথম প্রোডাক্ট যোগ করবেন,
            আর সকালে দোকানটা লাইভ থাকবে।
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/signup" size="lg">
              ফ্রি অ্যাকাউন্ট খুলুন
            </ButtonLink>
            <ButtonLink href="/how-it-works" variant="outline" size="lg">
              ছয় ধাপে শুরু করুন
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">কেন ATLaS</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              একটা দোকান চালাতে দশটা টুল লাগা উচিত নয়
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              অর্ডার আসে ইনবক্সে, স্টক থাকে খাতায়, ডেলিভারি চার্জ মনে রাখতে হয়, আর মাস শেষে হিসাব
              মেলাতে রাত জাগতে হয়। এই কাজগুলো একজন মানুষের একার সীমা — তাই ATLaS-এ সবকিছু এক জায়গায়
              আনা হয়েছে। নিজে করতে হয় শুধু একটি ফর্ম পূরণ।
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              দোকান সাজানো, প্রোডাক্ট তোলা, অর্ডার সামলানো আর রিপোর্ট দেখা — সব একই অ্যাডমিনে, একই
              লগইনে, একই ভাষায়।
            </p>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white shadow-sm">
            <div className="grid gap-0 sm:grid-cols-2">
              <div className="border-b border-ink-100 p-5 sm:border-r sm:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-100 text-ink-500">
                    <Icon name="store" className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">আগে</p>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {BEFORE.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
                      <span className="mt-0.5 text-ink-300">
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2.2}>
                          <path d="M6 6l8 8M14 6l-8 8" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-brand-50/40 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-white">
                    <Icon name="check" className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">ATLaS-এ</p>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {AFTER.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-ink-700">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                        <Icon name="check" className="h-2.5 w-2.5" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-y border-ink-100 bg-ink-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">আমাদের নীতি</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              যে ছয়টি সিদ্ধান্তে প্ল্যাটফর্মটা দাঁড়িয়ে
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              প্রতিটি ফিচার লেখার আগে এই প্রশ্নগুলোর উত্তর একই থাকে — তাই আচরণও একই থাকে।
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <article
                key={principle.title}
                className="group relative flex h-full flex-col rounded-xl border border-ink-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-100">
                    <Icon name={PRINCIPLE_ICONS[index]} />
                  </span>
                  <span className="font-mono text-[11px] font-medium text-ink-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{principle.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-600">{principle.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Audience / difference / promise */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid gap-6 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-3 lg:divide-x lg:divide-ink-100">
          <div className="lg:pr-6">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 text-brand-700">
              <Icon name="users" />
            </span>
            <h2 className="mt-3 text-base font-semibold text-ink-900">কাদের জন্য</h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              বুটিক, হোম বেকারি, মুদি দোকান, গ্যাজেট ও কসমেটিক্স — যাদের নিজের ডিজাইন নেই, কিন্তু
              নিজের ব্র্যান্ড আছে। প্রোডাক্ট ফটোগ্রাফি ও বর্ণনা নিজের, চেহারাটা প্ল্যাটফর্মের।
            </p>
          </div>

          <div className="lg:px-6">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 text-brand-700">
              <Icon name="sparkles" />
            </span>
            <h2 className="mt-3 text-base font-semibold text-ink-900">যেভাবে আলাদা</h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              রেফারেন্স প্ল্যাটফর্মগুলো হয় খুব সাধারণ, নয়তো বিদেশি গেটওয়ে-কেন্দ্রিক। ATLaS-এ দেশীয়
              পেমেন্ট ও COD একই স্রোতে, প্ল্যান-ভিত্তিক entitlement সার্ভারে enforce হয়, আর থিমগুলো
              একটি শেয়ারড কনট্র্যাক্টে চলে — তাই দোকান সাজানো ও স্কেল করা দুটোই সহজ।
            </p>
          </div>

          <div className="lg:pl-6">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-50 text-brand-700">
              <Icon name="handshake" />
            </span>
            <h2 className="mt-3 text-base font-semibold text-ink-900">আমাদের প্রতিশ্রুতি</h2>
            <ul className="mt-3 space-y-2">
              {PROMISES.map((promise) => (
                <li key={promise} className="flex items-start gap-2 text-xs text-ink-600">
                  <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <Icon name="check" className="h-2.5 w-2.5" />
                  </span>
                  {promise}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Platform stats */}
      <section className="border-t border-ink-100 bg-ink-50/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">এক নজরে</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              আজই যা ব্যবহার করা যায়
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              কোনো অতিরিক্ত সেটআপ, অ্যাপ বা ইন্টিগ্রেশন ছাড়াই — সাইনআপ করলেই সবগুলো খোলা।
            </p>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-ink-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-500">{stat.label}</p>
                  <span className="text-brand-600">
                    <Icon name={stat.icon} className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-ink-900">{stat.value}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{stat.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-10 text-center shadow-xl shadow-brand-900/10 sm:px-10 sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              কথা বলতে চান?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-brand-50">
              প্ল্যান, অংশীদারিত্ব বা কাস্টম প্রয়োজনে আমাদের লিখুন — কর্মদিবসে একই দিনে উত্তর
              পাবেন। অথবা আজই ফ্রি অ্যাকাউন্ট খুলে নিজের দোকান সাজানো শুরু করুন।
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/contact" variant="inverse" size="lg">
                যোগাযোগ করুন
              </ButtonLink>
              <ButtonLink href="/signup" variant="inverse-outline" size="lg">
                ফ্রি অ্যাকাউন্ট খুলুন
              </ButtonLink>
            </div>
            <p className="mt-4 text-[11px] text-brand-100">কার্ড লাগবে না · ৭ দিনের ট্রায়াল</p>
          </div>
        </div>
      </section>
    </div>
  );
}
