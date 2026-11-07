import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { getAvailableDemoStoreSlugs } from "@/lib/demo-stores";
import { Badge, Card, CardBody } from "@/components/ui/shell";
import { getLocale } from "@/lib/i18n/server";

/** How it works (PRD §4.1): account → store → theme → products → payment → live. */

export const dynamic = "force-dynamic";

const COPY = {
  bn: {
    meta: {
      title: "কীভাবে কাজ করে",
      description: "ATLaS-এ ছয় ধাপে দোকান খুলুন — সাইনআপ থেকে প্রথম অর্ডার পর্যন্ত।",
    },
    hero: {
      title: "সাইনআপ থেকে প্রথম অর্ডার — এক বসায়",
      body: "কোড লিখতে হবে না, ডিজাইনার লাগবে না। ছয়টি ধাপ, প্রতিটির পাশে আনুমানিক সময় দেওয়া আছে।",
      primary: "ফ্রি শুরু করুন",
      secondary: "ডেমো দোকান দেখুন",
    },
    steps: [
      {
        title: "অ্যাকাউন্ট খুলুন",
        time: "২ মিনিট",
        body: "মোবাইল নম্বর ও পাসওয়ার্ড দিন, OTP দিয়ে নম্বর যাচাই করুন। কোনো কার্ড বা সেটআপ ফি লাগে না — ফ্রি প্ল্যানে ৭ দিনের ট্রায়ালও প্রয়োজন নেই।",
        detail: ["Email/phone দিয়ে signup", "Bangladesh mobile OTP verification", "৭ দিনের trial — কার্ড ছাড়া"],
      },
      {
        title: "দোকান তৈরি করুন",
        time: "৩ মিনিট",
        body: "ব্যবসার নাম, ক্যাটাগরি, লোগো ও ব্র্যান্ড কালার দিন। আপনার subdomain (`your-shop.atlas.app`) লাইভেই availability চেক হয়, ডুপ্লিকেট হলে সাথে সাথে জানিয়ে দেওয়া হয়।",
        detail: ["Slug availability realtime", "ডিফল্ট থিম ও পেজ তৈরি হয়", "Free entitlement স্বয়ংক্রিয়ভাবে বসে"],
      },
      {
        title: "থিম বেছে সাজান",
        time: "৫ মিনিট",
        body: "Nokshi, Bazar, Studio — প্রতিটি থিমে হেডার, হিরো, ক্যাটাগরি গ্রিড, প্রোডাক্ট গ্রিড আর ফুটার সেকশন আছে। রঙ, ফন্ট ও ব্যানার নিজের মতো বদলে draft-এ সেভ করুন।",
        detail: ["Desktop/mobile preview", "Draft সেভ — publish না করলে লাইভ কিছু বদলায় না", "Plan অনুযায়ী থিম পুল"],
      },
      {
        title: "প্রোডাক্ট যোগ করুন",
        time: "১০ মিনিট",
        body: "একটি একটি করে যোগ করুন বা CSV ইমপোর্ট করুন (dry-run সহ — ভুল সারি আগেই দেখা যায়)। প্রতিটি ভ্যারিয়েন্টের SKU, দাম, স্টক ও ছবি আলাদা রাখা যায়।",
        detail: ["Variant + SKU + stock", "CSV import dry-run", "Inventory ledger — প্রতিটি পরিবর্তনের কারণ থাকে"],
      },
      {
        title: "পেমেন্ট ও ডেলিভারি যুক্ত করুন",
        time: "৫ মিনিট",
        body: "ক্যাশ অন ডেলিভারি ডিফল্টে চালু থাকে। বিকাশ, নগদ বা SSLCommerz কানেক্ট করুন — sandbox mode-এ পুরো flow টেস্ট করা যায়। ডেলিভারি zone ও চার্জ নিজে ঠিক করুন।",
        detail: ["COD প্রথম দিন থেকেই", "bKash / Nagad / SSLCommerz sandbox", "ঢাকার ভিতরে-বাইরে আলাদা চার্জ"],
      },
      {
        title: "Publish করে অর্ডার নিন",
        time: "১ ক্লিক",
        body: "Onboarding checklist শেষ হলেই publish করুন। নতুন অর্ডার, পেমেন্ট ও লো-স্টক অ্যালার্ট ড্যাশবোর্ড ও নোটিফিকেশন সেন্টারে আসবে।",
        detail: ["Checklist: product, delivery, payment, publish", "Order timeline ও invoice", "মোবাইল থেকে পুরো অ্যাডমিন"],
      },
    ],
    faq: {
      title: "সাধারণ প্রশ্ন",
      lead: "শুরু করার আগে যা সবাই জিজ্ঞেস করেন।",
      items: [
        {
          q: "কার্ড বা অগ্রিম টাকা লাগবে?",
          a: "না। ফ্রি প্ল্যানে ২৫টি প্রোডাক্ট ও ৫০টি অর্ডার পর্যন্ত কোনো ফি নেই। paid প্ল্যানে ৭ দিনের ট্রায়াল, কার্ড ছাড়াই।",
        },
        {
          q: "নিজের ডোমেইন কখন পাব?",
          a: "Standard ও Pro প্ল্যানে custom domain যোগ করা যায়। DNS-এ TXT ও CNAME রেকর্ড দিলে আমরা যাচাই করে active করি — Pro-তে domain ও subdomain একসাথে চলে।",
        },
        {
          q: "টাকা কোথায় জমা হয়?",
          a: "অনলাইন পেমেন্ট সরাসরি আপনার গেটওয়ে অ্যাকাউন্টে যায়। ATLaS শুধু মাসিক সাবস্ক্রিপশন ও ইনক্লুডেড কোটা ছাড়ানো অর্ডারের কমিশন ইনভয়েস করে।",
        },
        {
          q: "ডেটা কি নিজের কাছে থাকবে?",
          a: "হ্যাঁ। প্ল্যান ডাউনগ্রেড করলেও কিছু মুছে যায় না — শুধু নতুন তৈরি বন্ধ হয়। সবসময় CSV export ও data export খোলা থাকে।",
        },
      ],
    },
    cta: {
      title: "প্রস্তুত? প্রথম প্রোডাক্টটা আজই যোগ করুন",
      body: "ফ্রি প্ল্যানে শুরু করে পরে যেকোনো সময় upgrade করুন।",
      primary: "অ্যাকাউন্ট খুলুন",
      help: "হেল্প সেন্টার →",
    },
  },
  en: {
    meta: {
      title: "How it works",
      description: "Six steps from signup to your first order on ATLaS.",
    },
    hero: {
      title: "From signup to first order — in one sitting",
      body: "No code to write, no designer to hire. Six steps, each with a realistic time estimate.",
      primary: "Start free",
      secondary: "See a demo store",
    },
    steps: [
      {
        title: "Create an account",
        time: "2 minutes",
        body: "Enter a mobile number and password, verify the number with an OTP. No card or setup fee — and no 7-day trial clock ticking on the free plan.",
        detail: ["Sign up with email or phone", "Bangladeshi mobile OTP verification", "7-day trial — no card"],
      },
      {
        title: "Create your store",
        time: "3 minutes",
        body: "Give the business a name, a category, a logo and a brand colour. Your subdomain (`your-shop.atlas.app`) is checked for availability live and rejected immediately if taken.",
        detail: ["Live slug availability", "Default theme and pages created", "Free entitlements applied automatically"],
      },
      {
        title: "Pick a theme and style it",
        time: "5 minutes",
        body: "Nokshi, Bazar, Studio — every theme ships with header, hero, category grid, product grid and footer sections. Change colours, fonts and banners, then save as a draft.",
        detail: ["Desktop and mobile preview", "Draft save — nothing goes live until you publish", "Theme pool depends on the plan"],
      },
      {
        title: "Add products",
        time: "10 minutes",
        body: "Add them one by one or import a CSV (with a dry run, so bad rows show up first). Each variant keeps its own SKU, price, stock and images.",
        detail: ["Variant, SKU and stock", "CSV import dry run", "Inventory ledger — every change has a reason"],
      },
      {
        title: "Connect payments and delivery",
        time: "5 minutes",
        body: "Cash on delivery is on by default. Connect bKash, Nagad or SSLCommerz — the whole flow can be tested in sandbox mode. Set delivery zones and charges yourself.",
        detail: ["COD from day one", "bKash / Nagad / SSLCommerz sandbox", "Separate charges inside and outside Dhaka"],
      },
      {
        title: "Publish and take orders",
        time: "One click",
        body: "Publish once the onboarding checklist is done. New orders, payments and low-stock alerts arrive on the dashboard and in the notification centre.",
        detail: ["Checklist: product, delivery, payment, publish", "Order timeline and invoice", "The whole admin works on a phone"],
      },
    ],
    faq: {
      title: "Common questions",
      lead: "What everyone asks before starting.",
      items: [
        {
          q: "Do I need a card or an advance payment?",
          a: "No. The free plan carries 25 products and 50 orders with no fee. Paid plans start with a 7-day trial, no card required.",
        },
        {
          q: "When do I get my own domain?",
          a: "Custom domains are available on Standard and Pro. Add the TXT and CNAME records and we verify and activate it — Pro runs a domain and a subdomain together.",
        },
        {
          q: "Where does the money go?",
          a: "Online payments land directly in your own gateway account. ATLaS only invoices the monthly subscription and the commission on orders above the included quota.",
        },
        {
          q: "Do I keep my data?",
          a: "Yes. Downgrading deletes nothing — it only stops you creating new records beyond the quota. CSV and data export stay open at every plan.",
        },
      ],
    },
    cta: {
      title: "Ready? Add your first product today",
      body: "Start on the free plan and upgrade whenever you need to.",
      primary: "Create an account",
      help: "Help centre →",
    },
  },
} as const;

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

export default async function HowItWorksPage() {
  const locale = await getLocale();
  const t = COPY[locale];
  const demoSlugs = await getAvailableDemoStoreSlugs();

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{t.hero.title}</h1>
        <p className="text-ink-600">{t.hero.body}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <ButtonLink href="/signup">{t.hero.primary}</ButtonLink>
          {demoSlugs.has("nokshi-demo") ? (
            <ButtonLink href="/store/nokshi-demo" variant="outline">
              {t.hero.secondary}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <ol className="space-y-4">
        {t.steps.map((step, index) => (
          <li key={step.title}>
            <Card>
              <CardBody className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div className="space-y-1.5">
                  <p className="text-base font-semibold text-ink-900">{step.title}</p>
                  <p className="text-sm text-ink-600">{step.body}</p>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                    {step.detail.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="justify-self-start">
                  <Badge tone="neutral">{step.time}</Badge>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ol>

      <section className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">{t.faq.title}</h2>
          <p className="text-ink-600">{t.faq.lead}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {t.faq.items.map((item) => (
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
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50 p-6">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-ink-900">{t.cta.title}</p>
          <p className="text-sm text-ink-600">{t.cta.body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/signup">{t.cta.primary}</ButtonLink>
          <Link href="/help" className="self-center text-sm font-medium text-brand-700 hover:underline">
            {t.cta.help}
          </Link>
        </div>
      </section>
    </div>
  );
}
