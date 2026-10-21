import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/shell";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { PLAN_CODES, PLAN_DEFINITIONS, formatLimit, formatRate } from "@/lib/plans";

/** Public landing page (PRD §3). */

export const metadata = {
  title: "ATLaS — বাংলাদেশের অনলাইন দোকান এক জায়গায়",
  description:
    "ঘণ্টার মধ্যে নিজের দোকান দাঁড় করান — সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট সহ।",
};

const FEATURES = [
  {
    title: "নিজের ঠিকানা",
    body: "প্রতিটি দোকান পায় subdomain (যেমন nokshi.atlas.app)। Standard plan-এ নিজের ডোমেইনও জুড়ে দিতে পারবেন।",
  },
  {
    title: "৩টি তৈরি থিম",
    body: "Nokshi, Bazar, Studio — বুটিক, মুদি ও গ্যাজেটের জন্য আলাদা ডিজাইন। রঙ, হিরো ও সেকশন নিজেই বদলান।",
  },
  {
    title: "দেশীয় পেমেন্ট",
    body: "বিকাশ, নগদ, SSLCommerz ও ক্যাশ অন ডেলিভারি — সব একই checkout-এ, স্যান্ডবক্সে টেস্ট করা যায়।",
  },
  {
    title: "ডেলিভারি zone",
    body: "ঢাকার ভিতরে ও বাইরে আলাদা চার্জ, নির্দিষ্ট পরিমাণের উপরে ফ্রি ডেলিভারি — সব নিজে ঠিক করুন।",
  },
  {
    title: "অর্ডার ও স্টক",
    body: "প্রতিটি অর্ডার status, stock movement, রিটার্ন আর COD কালেকশন সহ একসাথে দেখা যায়।",
  },
  {
    title: "টিম ও রিপোর্ট",
    body: "Role অনুযায়ী স্টাফ যোগ করুন। বিক্রি, কমিশন আর ওভারেজ — সব রিপোর্টে স্পষ্ট।",
  },
];

const STEPS = [
  { title: "মোবাইল নম্বর দিয়ে সাইনআপ", body: "OTP বা পাসওয়ার্ড — যেটা সহজ। কোনো কার্ড লাগবে না।" },
  { title: "থিম বেছে দোকান সাজান", body: "নাম, থিম আর প্রথম প্রোডাক্ট যোগ করলেই দোকান তৈরি।" },
  { title: "Publish করে অর্ডার নিন", body: "চেকলিস্ট শেষ হলেই দোকান live — অর্ডার আসবে অ্যাডমিনে।" },
];

const PAYMENTS = [
  { name: "বিকাশ", note: "সবচেয়ে বেশি ব্যবহৃত মোবাইল ওয়ালেট", tone: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: "নগদ", note: "দ্রুত সেটেলমেন্ট, সহজ রিফান্ড", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  { name: "SSLCommerz", note: "কার্ড, ব্যাংক ও ওয়ালেট একসাথে", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  { name: "ক্যাশ অন ডেলিভারি", note: "প্রথম দিন থেকেই চালু", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

const COURIERS = ["Pathao", "Steadfast", "RedX", "Paperfly", "নিজের ডেলিভারি"];

const DEMO_STORES = [
  {
    name: "নকশি বুটিক",
    slug: "nokshi-demo",
    theme: "Nokshi",
    body: "হাতে বোনা শাড়ি, কুর্তি ও ওড়না — বড় ছবি, উষ্ণ রঙ, ফ্যাশনের জন্য সাজানো হোমপেজ।",
    gradient: "from-rose-100 via-amber-50 to-orange-100",
  },
  {
    name: "ঢাকা বাজার",
    slug: "dhaka-bazar",
    theme: "Bazar",
    body: "টাটকা সবজি, ফল, মাছ ও মুদি — ঘন প্রোডাক্ট গ্রিড আর ক্যাটাগরি-ফার্স্ট লেআউট।",
    gradient: "from-emerald-100 via-lime-50 to-teal-100",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "আগে শাড়ির অর্ডার নিতাম মেসেজে, ঠিকানা লিখে রাখতাম খাতায়। এখন প্রতিটি অর্ডার নিজের স্ট্যাটাস নিয়ে আসে — কোনটা পাঠানো হয়েছে, কোনটা COD-এ টাকা নেওয়া বাকি, সব এক জায়গায়।",
    name: "নাসরিন আক্তার",
    role: "নকশি বুটিক · ডেমো স্টোর",
    href: "/store/nokshi-demo",
  },
  {
    quote:
      "প্রতিদিন ৭০-৮০টি অর্ডার আসে। ডেলিভারি zone আলাদা করে দেওয়ার পর ঢাকার ভিতরে-বাইরের চার্জ আর ম্যানুয়াল হিসাব করতে হয় না।",
    name: "মাহবুব হাসান",
    role: "ঢাকা বাজার · ডেমো স্টোর",
    href: "/store/dhaka-bazar",
  },
  {
    quote:
      "ঈদের কালেকশনের আগে রাতেই থিম বদলে ব্যানার বসিয়ে দিয়েছি। draft-এ কাজ করেছি, তাই অর্ধেক সাজানো দোকান কেউ দেখেনি।",
    name: "সাদিয়া রহমান",
    role: "কসমেটিক্স ব্র্যান্ড · ডেমো ব্যবহারকারী",
    href: "/themes",
  },
];

const FAQS = [
  {
    q: "শুরু করতে কি কার্ড বা অগ্রিম টাকা লাগবে?",
    a: "না। ফ্রি প্ল্যানে ২৫টি প্রোডাক্ট ও মাসে ৫০টি অর্ডার পর্যন্ত কোনো ফি নেই। paid প্ল্যানে ৭ দিনের ট্রায়াল — কার্ড ছাড়াই।",
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
    a: "প্রতি প্ল্যানে নির্দিষ্ট সংখ্যক অর্ডার ফি-মুক্ত। তার পরে অর্ডারের ডিসকাউন্ট-সমন্বিত পণ্যমূল্যের উপর ০% থেকে ২.৫% পর্যন্ত কমিশন — যত উপরের প্ল্যান, তত কম।",
  },
  {
    q: "থিম বদলালে প্রোডাক্ট বা অর্ডার হারাবে?",
    a: "না। থিম শুধু চেহারা বদলায়। আপনার প্রোডাক্ট, ক্যাটাগরি, অর্ডার ও কাস্টমার একই থাকে — শুধু দেখতে বদলায়।",
  },
  {
    q: "প্ল্যান ছোট করলে ডেটা মুছে যাবে?",
    a: "না। ডাউনগ্রেডে শুধু কোটা ছাড়ানো নতুন তৈরি বন্ধ হয়; পুরোনো ডেটা পড়া, এডিট ও CSV-তে এক্সপোর্ট করা যায়।",
  },
];

export default function LandingPage() {
  const plans = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code]);

  return (
    <div className="space-y-20 pb-20 sm:space-y-24">
      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-16 pb-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="space-y-5">
            <Badge tone="brand">বাংলাদেশের জন্য তৈরি</Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl lg:text-5xl">
              আপনার অনলাইন দোকান, <span className="text-brand-700">এক জায়গায়</span>।
            </h1>
            <p className="max-w-xl text-base text-ink-600 sm:text-lg">
              সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার, ডেলিভারি চার্জ আর বিকাশ/নগদ/SSLCommerz/COD — সব এক
              ড্যাশবোর্ডে। কোড লিখতে হবে না, ডিজাইনও দরকার নেই।
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                ফ্রি শুরু করুন
              </ButtonLink>
              <ButtonLink href="/store/nokshi-demo" variant="outline" size="lg">
                ডেমো দোকান দেখুন
              </ButtonLink>
            </div>
            <p className="text-xs text-ink-500">
              ফ্রি plan-এ ২৫টি প্রোডাক্ট ও ক্যাশ অন ডেলিভারি — শুরু করতে টাকা লাগে না।
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="grid grid-cols-3">
              {THEME_CATALOG.map((theme) => (
                <div key={theme.code}>
                  <div className={`h-24 bg-gradient-to-br ${theme.preview.gradient}`} />
                  <p className="px-3 py-2 text-center text-xs font-medium text-ink-700">{theme.name}</p>
                </div>
              ))}
            </div>
            <CardBody className="space-y-3 border-t border-ink-100">
              <p className="text-sm font-semibold text-ink-900">একই ডেটা, তিন রকম দোকান</p>
              <p className="text-xs text-ink-500">
                থিম বদলালেও প্রোডাক্ট, অর্ডার আর কাস্টমার একই থাকে — শুধু দেখতে বদলায়।
              </p>
              <div className="flex flex-wrap gap-2">
                {["বিকাশ", "নগদ", "SSLCommerz", "ক্যাশ অন ডেলিভারি"].map((method) => (
                  <Badge key={method} tone="neutral">
                    {method}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 space-y-8 px-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">যা যা আছে</h2>
          <p className="text-ink-600">
            দোকান খোলা থেকে অর্ডার ডেলিভারি পর্যন্ত প্রতিদিনের কাজগুলো এক প্ল্যাটফর্মে।
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardBody className="space-y-2">
                <p className="text-sm font-semibold text-ink-900">{feature.title}</p>
                <p className="text-sm text-ink-600">{feature.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            বাংলাদেশের পেমেন্ট আর ডেলিভারি, এক জায়গায়
          </h2>
          <p className="text-ink-600">
            ক্রেতা যেভাবে টাকা দিতে চান, সেভাবেই নিন। আর ডেলিভারি আপনার নিজের লোক দিয়েই হোক বা
            কুরিয়ারে — চার্জ আর ট্র্যাকিং একই পর্দায়।
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PAYMENTS.map((method) => (
            <div key={method.name} className={`rounded-xl border p-4 ${method.tone}`}>
              <p className="text-sm font-semibold">{method.name}</p>
              <p className="mt-1 text-xs opacity-80">{method.note}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
          <span className="text-xs font-semibold text-ink-700">কুরিয়ার সংযোগ:</span>
          {COURIERS.map((courier) => (
            <Badge key={courier} tone="neutral">
              {courier}
            </Badge>
          ))}
          <span className="ml-auto text-[11px] text-ink-500">
            তৃতীয় পক্ষের কুরিয়ারে আলাদা ০.৫% ফি — প্ল্যাটফর্ম কমিশনের সাথে দ্বিগুণ হয় না
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              একই প্ল্যাটফর্ম, দুই রকম দোকান
            </h2>
            <p className="text-ink-600">
              ডেমো স্টোরগুলো আসল ডেটা দিয়ে চলে — প্রোডাক্ট, স্টক, কুপন আর অর্ডারসহ। সরাসরি ঢুকে
              checkout পর্যন্ত দেখতে পারেন।
            </p>
          </div>
          <ButtonLink href="/themes" variant="outline">
            সব থিম
          </ButtonLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DEMO_STORES.map((store) => (
            <Card key={store.slug} className="overflow-hidden">
              <div className={`h-28 bg-gradient-to-br ${store.gradient}`} />
              <CardBody className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">{store.name}</p>
                  <Badge tone="brand">{store.theme}</Badge>
                </div>
                <p className="text-xs text-ink-600">{store.body}</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    href={`/store/${store.slug}`}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    দোকান দেখুন →
                  </Link>
                  <Link
                    href={`/store/${store.slug}/shop`}
                    className="text-xs font-medium text-ink-500 hover:text-ink-900"
                  >
                    প্রোডাক্ট তালিকা
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">কীভাবে শুরু করবেন</h2>
          <p className="text-ink-600">তিন ধাপ — তারপরই দোকান live।</p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-ink-200 bg-white p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">{step.title}</p>
              <p className="mt-1 text-sm text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">থিম গ্যালারি</h2>
            <p className="text-ink-600">যে ব্যবসা, সেই ডিজাইন — যেকোনো সময় বদলাতে পারবেন।</p>
          </div>
          <ButtonLink href="/themes" variant="outline">
            সব থিম দেখুন
          </ButtonLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {THEME_CATALOG.map((theme) => (
            <Card key={theme.code} className="overflow-hidden">
              <div className={`h-32 bg-gradient-to-br ${theme.preview.gradient}`}>
                <div className="flex h-full items-end gap-2 p-3">
                  {theme.preview.swatches.map((swatch) => (
                    <span
                      key={swatch}
                      className="h-5 w-5 rounded-full border border-white/70"
                      style={{ background: swatch }}
                    />
                  ))}
                </div>
              </div>
              <CardBody className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">{theme.name}</p>
                  <Badge tone="neutral">{theme.style}</Badge>
                </div>
                <p className="text-xs text-ink-500">{theme.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">প্ল্যান</h2>
            <p className="text-ink-600">
              ফ্রি plan-এ শুরু করুন। ৫০টি অর্ডারের পরে সামান্য কমিশন, তারপর যত বাড়বেন তত কম খরচ।
            </p>
          </div>
          <ButtonLink href="/pricing" variant="outline">
            বিস্তারিত তুলনা
          </ButtonLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.code}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">{plan.name}</p>
                  {plan.code === "free" ? <Badge tone="success">শুরু এখানেই</Badge> : null}
                </div>
                <p className="text-2xl font-semibold text-ink-900">
                  {plan.monthlyPriceBdt === null
                    ? "কাস্টম"
                    : plan.monthlyPriceBdt === 0
                      ? "৳০"
                      : `৳${plan.monthlyPriceBdt.toLocaleString("en-US")}`}
                  {plan.monthlyPriceBdt ? <span className="text-xs text-ink-500"> /মাস</span> : null}
                </p>
                <ul className="space-y-1.5 text-xs text-ink-600">
                  <li>প্রোডাক্ট: {formatLimit(plan.$limits.products)}</li>
                  <li>মাসিক অর্ডার: {formatLimit(plan.$limits.monthlyOrders)}</li>
                  <li>স্টাফ seat: {formatLimit(plan.$limits.staffSeats)}</li>
                  <li>ওভারেজ: {formatRate(plan.$limits.overageRate)}</li>
                </ul>
                <p className="text-xs text-ink-500">{plan.description}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            ডেমো স্টোরের গল্প
          </h2>
          <p className="text-ink-600">
            এই দোকানগুলো প্ল্যাটফর্মেই চলে — নিচের অভিজ্ঞতাগুলো সেই ডেমো ডেটা থেকেই নেওয়া।
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <Card key={item.name}>
              <CardBody className="flex h-full flex-col gap-3">
                <p className="flex-1 text-sm leading-relaxed text-ink-700">“{item.quote}”</p>
                <div className="border-t border-ink-100 pt-3">
                  <p className="text-sm font-semibold text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-500">{item.role}</p>
                  <Link
                    href={item.href}
                    className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline"
                  >
                    দেখুন →
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-6 px-4">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">সাধারণ প্রশ্ন</h2>
          <p className="text-ink-600">শুরুর আগে যা সবাই জিজ্ঞেস করেন।</p>
        </div>
        <div className="space-y-2">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-ink-200 bg-white px-5 py-4 open:bg-ink-50"
            >
              <summary className="cursor-pointer list-none text-sm font-medium text-ink-900 marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-ink-400 group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-ink-600">{item.a}</p>
            </details>
          ))}
        </div>
        <p className="text-xs text-ink-500">
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

      <section className="mx-auto max-w-6xl px-4">
        <Card className="border-brand-200 bg-brand-50">
          <CardBody className="flex flex-wrap items-center justify-between gap-4 py-8">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-ink-900">আজই আপনার দোকান দাঁড় করান</p>
              <p className="text-sm text-ink-600">
                মোবাইল নম্বর দিয়েই শুরু — কোনো সেটআপ ফি নেই, কার্ডও লাগবে না।
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/signup">ফ্রি অ্যাকাউন্ট খুলুন</ButtonLink>
              <ButtonLink href="/pricing" variant="outline">
                প্ল্যান দেখুন
              </ButtonLink>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 text-center text-xs text-ink-500">
        <p>
          বাংলা ও ইংরেজি — দুটোতেই দোকান চলে। সব মূল্য BDT-তে, সময় Asia/Dhaka অনুযায়ী।
          প্রশ্ন থাকলে{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            মার্চেন্ট লগইন
          </Link>{" "}
          করে সাপোর্ট টিকেট খুলুন।
        </p>
      </section>
    </div>
  );
}
