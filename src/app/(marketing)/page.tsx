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
