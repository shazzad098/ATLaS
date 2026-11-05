import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { getAvailableDemoStoreSlugs } from "@/lib/demo-stores";
import { Badge, Card, CardBody } from "@/components/ui/shell";

/** How it works (PRD §4.1): account → store → theme → products → payment → live. */

export const metadata = {
  title: "কীভাবে কাজ করে",
  description: "ATLaS-এ ছয় ধাপে দোকান খুলুন — সাইনআপ থেকে প্রথম অর্ডার পর্যন্ত।",
};

export const dynamic = "force-dynamic";

const STEPS = [
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
];

const FAQ = [
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
];

export default async function HowItWorksPage() {
  const demoSlugs = await getAvailableDemoStoreSlugs();
  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-12">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          সাইনআপ থেকে প্রথম অর্ডার — এক বসায়
        </h1>
        <p className="text-ink-600">
          কোড লিখতে হবে না, ডিজাইনার লাগবে না। ছয়টি ধাপ, প্রতিটির পাশে আনুমানিক সময় দেওয়া আছে।
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <ButtonLink href="/signup">ফ্রি শুরু করুন</ButtonLink>
          {demoSlugs.has("nokshi-demo") ? (
            <ButtonLink href="/store/nokshi-demo" variant="outline">
              ডেমো দোকান দেখুন
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <ol className="space-y-4">
        {STEPS.map((step, index) => (
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
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">সাধারণ প্রশ্ন</h2>
          <p className="text-ink-600">শুরু করার আগে যা সবাই জিজ্ঞেস করেন।</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQ.map((item) => (
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
          <p className="text-lg font-semibold text-ink-900">প্রস্তুত? প্রথম প্রোডাক্টটা আজই যোগ করুন</p>
          <p className="text-sm text-ink-600">ফ্রি প্ল্যানে শুরু করে পরে যেকোনো সময় upgrade করুন।</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/signup">অ্যাকাউন্ট খুলুন</ButtonLink>
          <Link href="/help" className="self-center text-sm font-medium text-brand-700 hover:underline">
            হেল্প সেন্টার →
          </Link>
        </div>
      </section>
    </div>
  );
}
