import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle, CreditCard, Package, ShoppingBag, Store, Truck } from "lucide-react";

/** How it works page (PRD §4.1). */

export const metadata = {
  title: "কীভাবে কাজ করে — ATLaS",
  description: "মাত্র কয়েক মিনিটে আপনার অনলাইন দোকান তৈরি করুন। অ্যাকাউন্ট থেকে প্রথম বিক্রি পর্যন্ত ধাপে ধাপে গাইড।",
};

const STEPS = [
  {
    icon: Store,
    step: "০১",
    title: "অ্যাকাউন্ট ও দোকান তৈরি করুন",
    body: "ফোন নম্বর দিয়ে OTP যাচাই করে সাইনআপ করুন। দোকানের নাম, ক্যাটেগরি, লোগো ও ব্র্যান্ড কালার দিন — মাত্র ২ মিনিটে আপনার সাবডোমেইন রেডি।",
    details: [
      "ফোন OTP দিয়ে নিরাপদ সাইনআপ",
      "দোকানের নাম ও সাবডোমেইন সিলেক্ট করুন",
      "লোগো, ঠিকানা ও যোগাযোগ নম্বর দিন",
      "৭ দিনের ফ্রি ট্রায়াল — কার্ড ছাড়াই",
    ],
    color: "bg-[#E8F1FF] text-[#2563EB]",
    dotColor: "bg-[#2563EB]",
  },
  {
    icon: Package,
    step: "০২",
    title: "থিম বেছে প্রোডাক্ট যোগ করুন",
    body: "Nokshi, Bazar বা Studio — আপনার ব্যবসার ধরন অনুযায়ী থিম বেছে নিন। প্রোডাক্ট, ভেরিয়েন্ট, ইমেজ ও স্টক যোগ করুন; CSV import করে একসাথে অনেক প্রোডাক্ট আনুন।",
    details: [
      "৩টি পোলিশড থিম — ফ্যাশন, গ্রোসারি ও গ্যাজেট",
      "প্রোডাক্ট ভেরিয়েন্ট, SKU ও স্টক ট্র্যাকিং",
      "CSV import দিয়ে bulk upload",
      "SEO title, description ও Open Graph image",
    ],
    color: "bg-[#F1EBFF] text-[#7C3AED]",
    dotColor: "bg-[#7C3AED]",
  },
  {
    icon: CreditCard,
    step: "০৩",
    title: "পেমেন্ট কানেক্ট করুন",
    body: "বিকাশ, নগদ, SSLCommerz বা COD — যে পেমেন্ট পদ্ধতি চান সেটা কানেক্ট করুন। গেটওয়ে ক্রেডেনশিয়াল encrypted থাকে, payment callback স্বয়ংক্রিয়ভাবে যাচাই হয়।",
    details: [
      "বিকাশ, নগদ ও SSLCommerz সাপোর্ট",
      "COD (ক্যাশ অন ডেলিভারি) first-class সাপোর্ট",
      "Duplicate payment callback safe",
      "Payment gateway secret encrypted at rest",
    ],
    color: "bg-[#E7F7F0] text-[#0B8F68]",
    dotColor: "bg-[#0B8F68]",
  },
  {
    icon: Truck,
    step: "০৪",
    title: "ডেলিভারি সেট করুন",
    body: "ডেলিভারি জোন ও চার্জ ঠিক করুন। Pathao, Steadfast, RedX বা Paperfly কুরিয়ার কানেক্ট করুন। প্রতিটি অর্ডারের ট্র্যাকিং স্ট্যাটাস admin panel থেকে দেখুন।",
    details: [
      "জোনভিত্তিক ডেলিভারি চার্জ",
      "Pathao, Steadfast, RedX কুরিয়ার সাপোর্ট",
      "COD কালেকশন ও রিকনসিলিয়েশন",
      "Return ও exchange state machine",
    ],
    color: "bg-[#FFF3E2] text-[#D97706]",
    dotColor: "bg-[#D97706]",
  },
  {
    icon: ShoppingBag,
    step: "০৫",
    title: "দোকান পাবলিশ — বিক্রি শুরু",
    body: "প্রিভিউ দেখে Publish বাটনে ক্লিক করুন। আপনার subdomain-এ সাথে সাথে দোকান live হয়ে যাবে। কাস্টমার অর্ডার করলে SMS/email notification পাবেন।",
    details: [
      "Desktop ও mobile preview",
      "সাবডোমেইন auto-provision",
      "Standard/Pro-তে custom domain",
      "SMS ও email order notification",
    ],
    color: "bg-[#FFF1F2] text-[#E11D48]",
    dotColor: "bg-[#E11D48]",
  },
];

const FAQS = [
  {
    q: "কত দ্রুত দোকান তৈরি করা যায়?",
    a: "সাইনআপ থেকে প্রথম প্রোডাক্ট পর্যন্ত ১০–১৫ মিনিট। পেমেন্ট ও কুরিয়ার কানেক্ট করতে আরও কিছুটা সময় লাগে কারণ provider-এ credential দরকার।",
  },
  {
    q: "ফ্রি প্ল্যানে কী কী পাওয়া যায়?",
    a: "২৫টি প্রোডাক্ট, ১০০MB স্টোরেজ, ২টি starter থিম। প্রথম ৫০টি সম্পূর্ণ বিক্রিতে কোনো platform fee নেই; এরপর প্রতি বিক্রিতে ২.৫%।",
  },
  {
    q: "বিকাশ বা নগদ কানেক্ট করতে কী লাগে?",
    a: "বিকাশ/নগদ merchant account ও API credential লাগে। ATLaS sandbox mode-এ demo checkout টেস্ট করতে পারবেন; production-এ provider-approved credentials দিয়ে activate করুন।",
  },
  {
    q: "COD অর্ডারের fee কীভাবে হিসাব হয়?",
    a: "Merchant-confirmed COD order fee-eligible। Cancelled বা পুরো refund হলে fee void হয়। Fee base হলো discount-adjusted merchandise subtotal — delivery charge ও refunded items বাদে।",
  },
  {
    q: "Custom domain কখন পাব?",
    a: "Standard বা Pro plan-এ upgrade করলে custom domain mapping পাবেন। TXT/CNAME দিয়ে DNS verify করার পর TLS certificate স্বয়ংক্রিয়ভাবে provision হয়।",
  },
  {
    q: "একটি account থেকে কি একাধিক দোকান পরিচালনা করা যাবে?",
    a: "হ্যাঁ। একই account থেকে একাধিক store তৈরি করা যায়। Workspace switcher দিয়ে এক দোকান থেকে আরেক দোকানে যেতে পারবেন।",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-[#e8eeeb] bg-gradient-to-b from-[#f0faf6] to-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#c3e9d8] bg-[#e7f7f0] px-3 py-1 text-[12px] font-semibold text-[#0b7a5b]">
            কীভাবে কাজ করে
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            ৫ ধাপে আপনার অনলাইন দোকান
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink-600">
            Technical knowledge ছাড়াই — account থেকে প্রথম বিক্রি পর্যন্ত সব ধাপ এখানে।
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-6 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
            >
              ফ্রিতে শুরু করুন <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/themes"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-6 py-3 text-[13px] font-semibold text-ink-800 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:bg-[#f4f8f6]"
            >
              থিম দেখুন
            </Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="space-y-12">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isEven = i % 2 === 1;
              return (
                <div
                  key={step.step}
                  className={`flex flex-col gap-8 lg:flex-row lg:items-center ${isEven ? "lg:flex-row-reverse" : ""}`}
                >
                  {/* Icon block */}
                  <div className="lg:w-2/5">
                    <div className={`relative inline-flex rounded-2xl ${step.color} p-8 shadow-sm`}>
                      <Icon className="h-24 w-24 opacity-80" />
                      <span className="absolute -top-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-ink-800 shadow-md">
                        {step.step}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="lg:w-3/5">
                    <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{step.title}</h2>
                    <p className="mt-3 text-[15px] leading-7 text-ink-600">{step.body}</p>
                    <ul className="mt-5 space-y-2">
                      {step.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-2 text-[14px] text-ink-700">
                          <CheckCircle className={`mt-0.5 h-4 w-4 shrink-0 ${step.color.split(" ")[1]}`} />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#e8eeeb] bg-[#f7faf9] py-16 sm:py-20">
        <div className="mx-auto max-w-[860px] px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-ink-900">সাধারণ প্রশ্নোত্তর</h2>
            <p className="mt-2 text-[14px] text-ink-500">
              আরও প্রশ্ন থাকলে{" "}
              <Link href="/help" className="font-medium text-[#0B7A5B] hover:underline">
                Help Center
              </Link>{" "}
              বা{" "}
              <Link href="/contact" className="font-medium text-[#0B7A5B] hover:underline">
                যোগাযোগ
              </Link>{" "}
              পেজে দেখুন।
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-[#e2ebe6] bg-white px-5 py-4 shadow-[0_1px_3px_rgba(13,42,32,0.04)]"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[14px] font-semibold text-ink-800 marker:content-none">
                  {faq.q}
                  <span className="shrink-0 text-[#0B7A5B] group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 text-[13.5px] leading-6 text-ink-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <BadgeCheck className="mx-auto mb-4 h-10 w-10 text-[#0BA678]" />
          <h2 className="text-2xl font-bold text-ink-900">এখনই শুরু করুন — বিনামূল্যে</h2>
          <p className="mx-auto mt-3 max-w-lg text-[14px] text-ink-500">
            ৭ দিনের ফ্রি ট্রায়াল। কার্ড দরকার নেই। যেকোনো সময় বাতিল করা যাবে।
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-7 py-3 text-[14px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
          >
            ফ্রি অ্যাকাউন্ট খুলুন <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
