import Link from "next/link";
import { getAvailableDemoStoreSlugs } from "@/lib/demo-stores";
import { CreditCard, Package, Store, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/shell";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { PLAN_CODES, PLAN_DEFINITIONS, formatLimit, formatRate } from "@/lib/plans";

/** Public landing page (PRD §3). */

export const metadata = {
  title: "ATLaS — বাংলাদেশের অনলাইন দোকান এক জায়গায়",
  description:
    "ঘণ্টার মধ্যে নিজের দোকান দাঁড় করান — সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট সহ।",
};

// Demo stores are seeded data; resolve them on each request so the links
// appear immediately after `npm run db:seed` (and disappear if removed).
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Store,
    title: "নিজের ঠিকানা",
    body: "প্রতিটি দোকান পায় subdomain (যেমন nokshi.atlas.app)। Standard plan-এ নিজের ডোমেইনও জুড়ে দিতে পারবেন।",
  },
  {
    icon: Wallet,
    title: "দেশীয় পেমেন্ট",
    body: "বিকাশ, নগদ, SSLCommerz ও ক্যাশ অন ডেলিভারি — সব একই checkout-এ, স্যান্ডবক্সে টেস্ট করা যায়।",
  },
  {
    icon: Truck,
    title: "ডেলিভারি zone",
    body: "ঢাকার ভিতরে ও বাইরে আলাদা চার্জ, নির্দিষ্ট পরিমাণের উপরে ফ্রি ডেলিভারি — সব নিজে ঠিক করুন।",
  },
  {
    icon: Package,
    title: "অর্ডার ও স্টক",
    body: "প্রতিটি অর্ডারের status, stock movement, রিটার্ন আর COD কালেকশন — সব একসাথে দেখা যায়।",
  },
];

const FEATURES_SECOND_ROW = [
  {
    icon: Users,
    title: "টিম ও রিপোর্ট",
    body: "Role অনুযায়ী স্টাফ যোগ করুন। বিক্রি, কমিশন আর ওভারেজ — সব রিপোর্টে স্পষ্ট।",
  },
  {
    icon: CreditCard,
    title: "কুপন ও ডিসকাউন্ট",
    body: "প্রোডাক্ট, অর্ডার বা ইউজার-লেভেল কুপন, সর্বনিম্ন অর্ডার শর্ত সহ। রিপোর্টে ডিসকাউন্ট-সমন্বিত হিসাব।",
  },
];

const STEPS = [
  { title: "মোবাইল নম্বর দিয়ে সাইনআপ", body: "OTP বা পাসওয়ার্ড, যেটা সহজ। কোনো কার্ড লাগবে না।" },
  { title: "থিম বেছে দোকান সাজান", body: "নাম, থিম আর প্রথম প্রোডাক্ট যোগ করলেই দোকান তৈরি।" },
  { title: "Publish করে অর্ডার নিন", body: "চেকলিস্ট শেষ হলেই দোকান live, অর্ডার আসবে অ্যাডমিনে।" },
];

const PAYMENTS = [
  {
    name: "বিকাশ",
    note: "সবচেয়ে বেশি ব্যবহৃত মোবাইল ওয়ালেট",
    image: "/images/payments/bkash_logo.png",
  },
  {
    name: "নগদ",
    note: "দ্রুত সেটেলমেন্ট, সহজ রিফান্ড",
    image: "/images/payments/Nagad_Logo.png",
  },
  {
    name: "SSLCommerz",
    note: "কার্ড, ব্যাংক ও ওয়ালেট একসাথে",
    image: "/images/payments/sslcommerz_logo.png",
  },
  {
    name: "ক্যাশ অন ডেলিভারি",
    note: "প্রথম দিন থেকেই চালু",
    image: "/images/payments/cod.svg",
  },
];

const COURIERS = ["Pathao", "Steadfast", "RedX", "Paperfly", "নিজের ডেলিভারি"];

const DEMO_STORES = [
  {
    name: "নকশি বুটিক",
    slug: "nokshi-demo",
    theme: "Nokshi",
    body: "হাতে বোনা শাড়ি, কুর্তি ও ওড়না, বড় ছবি, উষ্ণ রঙ, ফ্যাশনের জন্য সাজানো হোমপেজ।",
    gradient: "from-rose-100 via-amber-50 to-orange-100",
  },
  {
    name: "ঢাকা বাজার",
    slug: "dhaka-bazar",
    theme: "Bazar",
    body: "টাটকা সবজি, ফল, মাছ ও মুদি, ঘন প্রোডাক্ট গ্রিড আর ক্যাটাগরি-ফার্স্ট লেআউট।",
    gradient: "from-emerald-100 via-lime-50 to-teal-100",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "আগে শাড়ির অর্ডার নিতাম মেসেজে, ঠিকানা লিখে রাখতাম খাতায়। এখন প্রতিটি অর্ডার নিজের স্ট্যাটাস নিয়ে আসে, কোনটা পাঠানো হয়েছে, কোনটা COD-এ টাকা নেওয়া বাকি, সব এক জায়গায়।",
    name: "নাসরিন আক্তার",
    role: "নকশি বুটিক, ডেমো স্টোর",
    href: "/store/nokshi-demo",
  },
  {
    quote:
      "প্রতিদিন ৭০-৮০টি অর্ডার আসে। ডেলিভারি zone আলাদা করে দেওয়ার পর ঢাকার ভিতরে-বাইরের চার্জ আর ম্যানুয়াল হিসাব করতে হয় না।",
    name: "মাহবুব হাসান",
    role: "ঢাকা বাজার, ডেমো স্টোর",
    href: "/store/dhaka-bazar",
  },
  {
    quote:
      "ঈদের কালেকশনের আগে রাতেই থিম বদলে ব্যানার বসিয়ে দিয়েছি। draft-এ কাজ করেছি, তাই অর্ধেক সাজানো দোকান কেউ দেখেনি।",
    name: "সাদিয়া রহমান",
    role: "কসমেটিক্স ব্র্যান্ড, ডেমো ব্যবহারকারী",
    href: "/themes",
  },
];

const FAQS = [
  {
    q: "শুরু করতে কি কার্ড বা অগ্রিম টাকা লাগবে?",
    a: "না। ফ্রি প্ল্যানে ২৫টি প্রোডাক্ট ও মাসে ৫০টি অর্ডার পর্যন্ত কোনো ফি নেই। paid প্ল্যানে ৭ দিনের ট্রায়াল, কার্ড ছাড়াই।",
  },
  {
    q: "পেমেন্ট কীভাবে নিতে পারব?",
    a: "ক্যাশ অন ডেলিভারি ডিফল্টে চালু। বিকাশ, নগদ ও SSLCommerz কানেক্ট করলে ক্রেতা checkout-এ সেগুলো দেখবে। sandbox mode-এ পুরো flow টেস্ট করা যায়।",
  },
  {
    q: "নিজের ডোমেইন যোগ করা যাবে?",
    a: "Standard ও Pro প্ল্যানে হ্যাঁ। DNS-এ TXT ও CNAME রেকর্ড দিলে যাচাই করে active করা হয়; Pro-তে custom domain ও subdomain একসাথে চলে।",
  },
  {
    q: "প্ল্যাটফর্ম ফি কত?",
    a: "প্রতি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত। তার পরে অর্ডারের ডিসকাউন্ট-সমন্বিত পণ্যমূল্যের উপর ০% থেকে ২.৫% পর্যন্ত কমিশন, যত উপরের প্ল্যান, তত কম।",
  },
  {
    q: "থিম বদলালে প্রোডাক্ট বা অর্ডার হারাবে?",
    a: "না। থিম শুধু চেহারা বদলায়। আপনার প্রোডাক্ট, ক্যাটাগরি, অর্ডার ও কাস্টমার একই থাকে, শুধু দেখতে বদলায়।",
  },
  {
    q: "প্ল্যান ছোট করলে ডেটা মুছে যাবে?",
    a: "না। ডাউনগ্রেডে শুধু কোটা ছাড়ানো নতুন তৈরি বন্ধ হয়; পুরোনো ডেটা পড়া, এডিট ও CSV-তে এক্সপোর্ট করা যায়।",
  },
];

// ── Shared UI pieces ─────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: "left" | "center";
}) {
  if (align === "center") {
    return (
      <div className="mx-auto max-w-2xl space-y-3 text-center">
        {eyebrow ? <p className="text-xs font-semibold tracking-wide text-brand-700">{eyebrow}</p> : null}
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        {description ? <p className="text-sm leading-relaxed text-ink-600">{description}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        {eyebrow ? <p className="text-xs font-semibold tracking-wide text-brand-700">{eyebrow}</p> : null}
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        {description ? <p className="max-w-xl text-sm leading-relaxed text-ink-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function FeatureCell({
  icon: Icon,
  title,
  body,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl border p-6 transition hover:border-brand-300 sm:p-7 ${className}`}>
      <Icon className="h-6 w-6 text-brand-700" strokeWidth={1.75} aria-hidden="true" />
      <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const demoSlugs = await getAvailableDemoStoreSlugs();
  const demoStores = DEMO_STORES.filter((store) => demoSlugs.has(store.slug));
  const hasNokshiDemo = demoSlugs.has("nokshi-demo");
  const testimonials = TESTIMONIALS.filter((item) => {
    const match = /^\/store\/([^/]+)/.exec(item.href);
    return !match || demoSlugs.has(match[1]);
  });
  const plans = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code]);

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#f0f2f6_1px,transparent_1px),linear-gradient(to_bottom,#f0f2f6_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_75%_70%_at_50%_0%,black,transparent_80%)]" />
          <div className="absolute -top-40 left-1/2 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 pb-16 pt-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-xs font-medium text-ink-600">
              বাংলাদেশের উদ্যোক্তার জন্য তৈরি
            </p>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-ink-900 sm:text-[44px]">
              আপনার অনলাইন দোকান,
              <span className="relative inline-block text-brand-700">
                {" "}এক জায়গায়
                <svg
                  viewBox="0 0 300 18"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute -bottom-1 left-0 h-2.5 w-full text-brand-400 sm:h-3.5"
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
            <p className="max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
              সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার, ডেলিভারি চার্জ আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট,
              সব এক ড্যাশবোর্ডে। কোড লিখতে হবে না, ডিজাইনও দরকার নেই।
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink href="/signup" size="lg">
                ফ্রি শুরু করুন
              </ButtonLink>
              {hasNokshiDemo ? (
                <ButtonLink href="/store/nokshi-demo" variant="outline" size="lg">
                  ডেমো দোকান দেখুন
                </ButtonLink>
              ) : null}
            </div>
            <p className="text-xs text-ink-500">
              ফ্রি plan-এ ২৫টি প্রোডাক্ট ও ক্যাশ অন ডেলিভারি, শুরু করতে টাকা লাগে না।
            </p>
          </div>

          {/* Theme preview card */}
          <div className="relative lg:pl-6">
            <div
              aria-hidden="true"
              className="absolute -right-3 -top-3 hidden h-full w-full rounded-2xl border border-ink-100 bg-ink-50 lg:block"
            />
            <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl shadow-ink-900/5">
              <div className="grid grid-cols-3">
                {THEME_CATALOG.map((theme) => (
                  <div key={theme.code} className="border-b border-ink-100">
                    <div className={`h-24 bg-gradient-to-br ${theme.preview.gradient}`} />
                    <p className="px-3 py-2 text-center text-xs font-medium text-ink-700">{theme.name}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3 px-5 py-4">
                <p className="text-sm font-semibold text-ink-900">একই ডেটা, তিন রকম দোকান</p>
                <p className="text-xs leading-relaxed text-ink-500">
                  থিম বদলালেও প্রোডাক্ট, অর্ডার আর কাস্টমার একই থাকে, শুধু দেখতে বদলায়।
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["বিকাশ", "নগদ", "SSLCommerz", "COD"].map((method) => (
                    <Badge key={method} tone="neutral">
                      {method}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-16">
        <div className="space-y-8">
          <SectionHeading
            eyebrow="প্ল্যাটফর্ম"
            title="যা যা আছে"
            description="দোকান খোলা থেকে অর্ডার ডেলিভারি পর্যন্ত প্রতিদিনের কাজগুলো এক প্ল্যাটফর্মে।"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
            <FeatureCell
              {...FEATURES[0]}
              className="border-brand-200 bg-brand-50/60 lg:col-span-7"
            />
            <FeatureCell {...FEATURES[1]} className="border-ink-200 bg-white lg:col-span-5" />
            <FeatureCell {...FEATURES[2]} className="border-ink-200 bg-white lg:col-span-5" />
            <FeatureCell {...FEATURES[3]} className="border-ink-200 bg-white lg:col-span-7" />
            <FeatureCell
              {...FEATURES_SECOND_ROW[0]}
              className="border-ink-200 bg-white lg:col-span-6"
            />
            <FeatureCell
              {...FEATURES_SECOND_ROW[1]}
              className="border-ink-200 bg-white lg:col-span-6"
            />
          </div>
        </div>
      </section>

      {/* Payments & Delivery */}
      <section className="border-y border-ink-200 bg-ink-50/60">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:py-16">
          <SectionHeading
            eyebrow="পেমেন্ট ও ডেলিভারি"
            title="দেশের পেমেন্ট আর ডেলিভারি, এক checkout-এ"
            description="ক্রেতা যেভাবে টাকা দিতে চান, সেভাবেই নিন। ডেলিভারি নিজের লোক দিয়ে হোক বা কুরিয়ারে, চার্জ আর ট্র্যাকিং একই পর্দায়।"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENTS.map((method) => (
              <div
                key={method.name}
                className="rounded-xl border border-ink-200 bg-white p-5 transition hover:border-ink-300 hover:shadow-sm"
              >
                <img src={method.image} alt={method.name} className="h-10 w-20 object-contain" />
                <p className="mt-3 text-sm font-semibold text-ink-900">{method.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{method.note}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-700">কুরিয়ার সংযোগ:</span>
            {COURIERS.map((courier) => (
              <span
                key={courier}
                className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600"
              >
                {courier}
              </span>
            ))}
            <p className="ml-auto text-[11px] text-ink-500">
              তৃতীয় পক্ষের কুরিয়ারে আলাদা ০.৫% ফি, প্ল্যাটফর্ম কমিশনের সাথে দ্বিগুণ হয় না
            </p>
          </div>
        </div>
      </section>

      {/* Demo Stores (only when the seeded fixtures exist) */}
      {demoStores.length > 0 ? (
        <section className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:py-16">
          <SectionHeading
            eyebrow="ডেমো"
            title="একই প্ল্যাটফর্ম, দুই রকম দোকান"
            description="ডেমো স্টোরগুলো আসল ডেটা দিয়ে চলে, প্রোডাক্ট, স্টক, কুপন আর অর্ডারসহ। সরাসরি ঢুকে checkout পর্যন্ত দেখতে পারেন।"
            action={
              <ButtonLink href="/themes" variant="outline">
                সব থিম
              </ButtonLink>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {demoStores.map((store) => (
            <div
              key={store.slug}
              className="group overflow-hidden rounded-2xl border border-ink-200 bg-white transition hover:border-brand-300 hover:shadow-md"
            >
              <div className={`relative h-36 bg-gradient-to-br ${store.gradient}`}>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                  <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-ink-800 backdrop-blur">
                    {store.theme} theme
                  </span>
                  <span className="rounded-full bg-ink-900/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                    Live demo
                  </span>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-base font-semibold text-ink-900">{store.name}</p>
                <p className="text-sm leading-relaxed text-ink-600">{store.body}</p>
                <div className="flex flex-wrap gap-4 pt-1 text-sm font-medium">
                  <Link href={`/store/${store.slug}`} className="text-brand-700 hover:underline">
                    দোকান দেখুন
                  </Link>
                  <Link
                    href={`/store/${store.slug}/shop`}
                    className="text-ink-500 transition hover:text-ink-900"
                  >
                    প্রোডাক্ট তালিকা
                  </Link>
                </div>
              </div>
            </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* How to start */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 pb-14 sm:pb-16">
        <SectionHeading
          eyebrow="শুরু করুন"
          title="তিন ধাপে দোকান live"
          description="সাইনআপ থেকে publish, মিনিটে খুলে যাবে দোকান।"
        />
        <ol className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="hidden flex-1 border-t border-dashed border-ink-300 md:block"
                  />
                ) : null}
              </div>
              <p className="mt-4 text-base font-semibold text-ink-900">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Theme Gallery */}
      <section className="border-t border-ink-200 bg-ink-50/40">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:py-16">
          <SectionHeading
            eyebrow="ডিজাইন"
            title="থিম গ্যালারি"
            description="যে ব্যবসা, সেই ডিজাইন, যেকোনো সময় বদলাতে পারবেন।"
            action={
              <ButtonLink href="/themes" variant="outline">
                সব থিম দেখুন
              </ButtonLink>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {THEME_CATALOG.map((theme) => (
              <div
                key={theme.code}
                className="group overflow-hidden rounded-2xl border border-ink-200 bg-white transition hover:border-brand-300 hover:shadow-md"
              >
                <div className={`relative h-28 bg-gradient-to-br ${theme.preview.gradient}`}>
                  <div className="absolute inset-x-0 bottom-0 flex gap-1.5 p-3">
                    {theme.preview.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="h-5 w-5 rounded-full border border-white/80 shadow-sm"
                        style={{ background: swatch }}
                      />
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-ink-900">{theme.name}</p>
                    <span className="rounded-full border border-ink-200 bg-ink-50 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
                      {theme.style}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{theme.description}</p>
                  <p className="mt-2 text-xs text-ink-500">{theme.industry}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="border-t border-ink-200 bg-ink-50/60">
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-14 sm:py-16">
          <SectionHeading
            align="center"
            eyebrow="প্রাইসিং"
            title="প্ল্যান"
            description="ফ্রি plan-এ শুরু করুন। ৫০টি অর্ডারের পরে সামান্য কমিশন, তারপর যত বাড়বেন তত কম খরচ।"
          />
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.code}
                className={`relative flex h-full flex-col rounded-2xl border p-6 ${
                  plan.code === "standard"
                    ? "border-brand-600 bg-white shadow-lg shadow-brand-900/10 ring-1 ring-brand-600"
                    : "border-ink-200 bg-white transition hover:border-ink-300"
                }`}
              >
                {plan.code === "standard" ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-0.5 text-[11px] font-semibold text-white">
                    সবচেয়ে জনপ্রিয়
                  </span>
                ) : null}
                <p className="text-sm font-semibold text-ink-500">{plan.name}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                  {plan.monthlyPriceBdt === null
                    ? "কাস্টম"
                    : plan.monthlyPriceBdt === 0
                      ? "৳০"
                      : `৳${plan.monthlyPriceBdt.toLocaleString("en-US")}`}
                  {plan.monthlyPriceBdt === 0 ? <span className="text-xs font-normal text-ink-500"> /মাস</span> : null}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">{plan.description}</p>
                <ul className="mt-5 space-y-2 border-t border-ink-100 pt-5 text-sm text-ink-600">
                  <li>
                    প্রোডাক্ট: <span className="font-semibold text-ink-900">{formatLimit(plan.$limits.products)}</span>
                  </li>
                  <li>
                    মাসিক অর্ডার: <span className="font-semibold text-ink-900">{formatLimit(plan.$limits.monthlyOrders)}</span>
                  </li>
                  <li>
                    স্টাফ seat: <span className="font-semibold text-ink-900">{formatLimit(plan.$limits.staffSeats)}</span>
                  </li>
                  <li>
                    ওভারেজ: <span className="font-semibold text-ink-900">{formatRate(plan.$limits.overageRate)}</span>
                  </li>
                </ul>
                <div className="mt-auto pt-6">
                  <ButtonLink
                    href={plan.code === "free" ? "/signup" : "/pricing"}
                    variant={plan.code === "standard" ? "primary" : "outline"}
                    className="w-full"
                  >
                    {plan.code === "free" ? "ফ্রি শুরু করুন" : "বিস্তারিত দেখুন"}
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:py-16">
        <SectionHeading
          eyebrow="অভিজ্ঞতা"
          title="ডেমো স্টোরের গল্প"
          description="এই দোকানগুলো প্ল্যাটফর্মেই চলে, নিচের অভিজ্ঞতাগুলো সেই ডেমো ডেটা থেকেই নেওয়া।"
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {testimonials.map((item) => (
            <figure key={item.name} className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-6">
              <span aria-hidden="true" className="font-serif text-4xl leading-none text-brand-300">
                “
              </span>
              <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">{item.quote}</blockquote>
              <figcaption className="mt-4 border-t border-ink-100 pt-4">
                <p className="text-sm font-semibold text-ink-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-ink-500">{item.role}</p>
                <Link
                  href={item.href}
                  className="mt-1.5 inline-block text-xs font-medium text-brand-700 hover:underline"
                >
                  দেখুন
                </Link>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl space-y-8 px-4 pb-14 sm:pb-16">
        <SectionHeading align="center" eyebrow="প্রশ্নোত্তর" title="সাধারণ প্রশ্ন" />
        <div className="space-y-2">
          {FAQS.map((item) => (
            <details key={item.q} className="group rounded-xl border border-ink-200 bg-white px-5 py-4 transition-colors open:bg-ink-50/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink-900 marker:hidden">
                {item.q}
                <span aria-hidden="true" className="shrink-0 text-ink-400 transition-transform group-open:rotate-90">
                  ↓
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="text-center text-xs text-ink-500">
          আরও প্রশ্ন আছে?{" "}
          <Link href="/help" className="font-medium text-brand-700 hover:underline">
            হেল্প সেন্টার
          </Link>{" "}
          দেখুন বা{" "}
          <Link href="/contact" className="font-medium text-brand-700 hover:underline">
            আমাদের লিখুন
          </Link>
          ।
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-14 sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(31,163,131,0.28),transparent_60%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(31,163,131,0.18),transparent_55%)]"
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              আজই আপনার দোকান দাঁড় করান
            </h2>
            <p className="mt-3 text-base leading-relaxed text-ink-300">
              মোবাইল নম্বর দিয়েই শুরু, কোনো সেটআপ ফি নেই, কার্ডও লাগবে না।
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" size="lg" variant="inverse">
                ফ্রি অ্যাকাউন্ট খুলুন
              </ButtonLink>
              <ButtonLink href="/pricing" size="lg" variant="inverse-outline">
                প্ল্যান দেখুন
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-400">কার্ড লাগবে না, ৭ দিনের ট্রায়াল</p>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-ink-500">
          বাংলা ও ইংরেজি, দুটোতেই দোকান চলে। সব মূল্য BDT-তে, সময় Asia/Dhaka অনুযায়ী। প্রশ্ন থাকলে{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            মার্চেন্ট লগইন
          </Link>{" "}
          করে সাপোর্ট টিকেট খুলুন।
        </p>
      </section>
    </div>
  );
}
