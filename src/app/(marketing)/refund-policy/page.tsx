import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  MessageSquare,
  Package,
  PackageCheck,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Store,
  Timer,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/** Refund + cancellation policy (PRD §4.1 "Refund/Cancellation Policy"). */

export const metadata = {
  title: "রিফান্ড ও বাতিল নীতি",
  description: "ক্রেতার অর্ডার রিফান্ড, মার্চেন্টের সাবস্ক্রিপশন বাতিল এবং প্ল্যাটফর্ম ফি ফেরতের নিয়ম।",
};

const LAST_UPDATED = "২১ অক্টোবর ২০২৬";

const NAV = [
  { id: "order-refund", label: "ক্রেতার অর্ডার রিফান্ড" },
  { id: "process", label: "রিফান্ড প্রক্রিয়া" },
  { id: "platform-fee", label: "প্ল্যাটফর্ম ফি" },
  { id: "subscription", label: "সাবস্ক্রিপশন বাতিল" },
  { id: "subscription-refund", label: "সাবস্ক্রিপশন ফি ফেরত" },
  { id: "request", label: "অনুরোধ করবেন যেভাবে" },
  { id: "dispute", label: "বিরোধ ও প্রশ্ন" },
];

const FACTS = [
  {
    value: "৭ দিন",
    label: "পণ্য পাওয়ার পর সমস্যা জানানোর সময়",
    icon: Clock,
  },
  {
    value: "৭–১০",
    label: "কর্মদিবসে গেটওয়ে রিফান্ড",
    icon: CreditCard,
  },
  {
    value: "১৪ দিন",
    label: "ইনভয়েস নম্বরসহ ফেরতের অনুরোধ",
    icon: Receipt,
  },
] as const;

const AUDIENCES = [
  {
    title: "ক্রেতা",
    body: "অর্ডার ট্র্যাকিং থেকে রিটার্ন বা রিফান্ডের অনুরোধ করুন।",
    href: "#order-refund",
    icon: Package,
  },
  {
    title: "মার্চেন্ট",
    body: "অর্ডার অনুমোদন, ক্যাশ অন ডেলিভারি রিফান্ড ও সাবস্ক্রিপশন বাতিল সামলান।",
    href: "#request",
    icon: Store,
  },
  {
    title: "প্ল্যাটফর্ম ফি",
    body: "বাতিল বা রিফান্ডে কমিশন স্বয়ংক্রিয়ভাবে সমন্বয় হয়।",
    href: "#platform-fee",
    icon: Wallet,
  },
] as const;

const STEPS = [
  {
    title: "অনুরোধ জমা",
    body: "ক্রেতা অর্ডার ট্র্যাকিং পেজ থেকে রিটার্ন/রিফান্ডের অনুরোধ করেন; অনুরোধটি মার্চেন্টের অর্ডার ডিটেইলে জমা হয়।",
    icon: MessageSquare,
  },
  {
    title: "মার্চেন্ট যাচাই",
    body: "দোকানের নিজস্ব রিটার্ন নীতির ভিত্তিতে মার্চেন্ট অনুরোধটি অনুমোদন বা প্রত্যাখ্যান করেন।",
    icon: BadgeCheck,
  },
  {
    title: "রিফান্ড প্রক্রিয়া",
    body: "অনুমোদিত হলে গেটওয়ে দিয়ে রিফান্ড যায়; ক্যাশ অন ডেলিভারির ক্ষেত্রে মার্চেন্ট নিজে ব্যবস্থা করেন।",
    icon: CreditCard,
  },
  {
    title: "নিশ্চিতকরণ",
    body: "অর্ডার টাইমলাইন ও অডিট লগে প্রতিটি ধাপের রেকর্ড থাকে, তাই পরে যাচাই করা যায়।",
    icon: PackageCheck,
  },
] as const;

const FEE_ROWS = [
  {
    case: "পুরো অর্ডার বাতিল / পুরো রিফান্ড",
    fee: "ওই অর্ডারের কমিশন বাতিল",
    quota: "ব্যবহৃত কোটা ফেরত",
    tone: "success" as const,
  },
  {
    case: "আংশিক রিফান্ড",
    fee: "শুধু রিফান্ড হওয়া লাইনের অনুপাতে ফি",
    quota: "আংশিক সমন্বয়",
    tone: "warning" as const,
  },
  {
    case: "ডেলিভারি চার্জ",
    fee: "প্ল্যাটফর্ম ফি-র হিসাবে ধরা হয় না",
    quota: "প্রযোজ্য নয়",
    tone: "neutral" as const,
  },
  {
    case: "গেটওয়ে চার্জ",
    fee: "গেটওয়ের নিজস্ব নীতি অনুযায়ী",
    quota: "প্রযোজ্য নয়",
    tone: "info" as const,
  },
];

const REFUND_RULES = [
  {
    title: "চলতি মাসের ফি",
    body: "ইতিমধ্যে পরিশোধিত সাবস্ক্রিপশন ফি সাধারণত ফেরতযোগ্য নয়, কারণ পিরিয়ডের পুরো সময় সেবা চালু থাকে।",
    icon: Receipt,
  },
  {
    title: "প্ল্যাটফর্মের ত্রুটি",
    body: "ডাবল চার্জ, ভুল পরিমাণ বা প্ল্যাটফর্মের ত্রুটির কারণে হওয়া চার্জ সম্পূর্ণ ফেরত দেওয়া হয়।",
    icon: RotateCcw,
  },
  {
    title: "দীর্ঘ ডাউনটাইম",
    body: "সাসপেনশন বা একটানা ৭২ ঘণ্টার বেশি ডাউনটাইম হলে অনুরোধের ভিত্তিতে পরবর্তী ইনভয়েসে ক্রেডিট দেওয়া হয়।",
    icon: Timer,
  },
  {
    title: "অনুরোধের সময়",
    body: "ইনভয়েস তৈরির ১৪ দিনের মধ্যে ইনভয়েস নম্বরসহ অনুরোধ করতে হবে; অনুমোদিত রিফান্ড সাধারণত ৭–১০ কর্মদিবসে ফেরে।",
    icon: CalendarDays,
  },
];

const FAQS = [
  {
    q: "রিফান্ড কত দিনে ফেরত পাব?",
    a: "মার্চেন্ট অনুমোদনের পর গেটওয়ে রিফান্ড সাধারণত ৭–১০ কর্মদিবসে ফেরে। ক্যাশ অন ডেলিভারির ক্ষেত্রে রিফান্ডের ব্যবস্থা মার্চেন্ট নিজে করেন, তাই সময় দোকানের নীতির উপর নির্ভর করে।",
  },
  {
    q: "প্ল্যাটফর্ম ফি কি ফেরত পাব?",
    a: "পুরো অর্ডার বাতিল বা পুরো রিফান্ড হলে ওই অর্ডারের প্ল্যাটফর্ম কমিশন স্বয়ংক্রিয়ভাবে বাতিল হয় এবং মাসিক কোটা ফিরে আসে। আংশিক রিফান্ডে শুধু রিফান্ড হওয়া লাইনের অনুপাতে ফি পুনঃহিসাব হয়। গেটওয়ে চার্জ গেটওয়ের নিজস্ব নীতি অনুযায়ী প্রযোজ্য।",
  },
  {
    q: "সাবস্ক্রিপশন বাতিল করলে ডেটা মুছে যাবে?",
    a: "না। বাতিল বা ডাউনগ্রেড করলে শুধু কোটা ছাড়ানো নতুন তৈরি বন্ধ হয়; পুরোনো প্রোডাক্ট পড়া, এডিট ও এক্সপোর্ট সবসময় খোলা থাকে।",
  },
  {
    q: "ভাঙা বা ভুল পণ্য পেলে কী করব?",
    a: "পণ্য পাওয়ার ৭ দিনের মধ্যে অর্ডার ট্র্যাকিং পেজ থেকে ছবি ও বিবরণসহ রিটার্ন/রিফান্ডের অনুরোধ করুন। পণ্যের গুণমান ও ডেলিভারির সিদ্ধান্ত মার্চেন্টের, প্রয়োজনে প্ল্যাটফর্ম দুই পক্ষের তথ্য নিয়ে মধ্যস্থতা করে।",
  },
  {
    q: "সাথে সাথে সাবস্ক্রিপশন বাতিল করলে কী হয়?",
    a: "পেইড ফিচার বন্ধ হয়ে অ্যাকাউন্ট ফ্রি প্ল্যানে নেমে আসে; ডেটা মুছে যায় না। 'সময় শেষে বাতিল' নির্বাচন করলে চলতি পিরিয়ডের শেষ পর্যন্ত সব ফিচার চালু থাকে।",
  },
];

function SectionHeading({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand-200 bg-brand-50 text-[10px] font-bold text-brand-700">
        {index}
      </span>
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p> : null}
      </div>
    </div>
  );
}

const TONE = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-ink-200 bg-ink-50 text-ink-600",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export default function RefundPolicyPage() {
  return (
    <div className="overflow-hidden bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-brand-50/90 via-white to-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="animate-drift absolute -top-56 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-200/45 blur-3xl" />
          <div className="animate-float-slow absolute -left-28 top-32 h-72 w-72 rounded-full bg-brand-100/80 blur-3xl" />
          <div className="animate-float absolute -right-24 top-10 h-72 w-72 rounded-full bg-accent-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(#d5d9e2_1px,transparent_1px)] [background-size:22px_22px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24">
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-brand-800 shadow-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              রিফান্ড ও বাতিল নীতি
            </div>

            <h1
              className="animate-fade-up mt-5 text-3xl leading-[1.22] font-bold tracking-tight text-ink-900 sm:text-[44px] sm:leading-[1.16]"
              style={{ animationDelay: "80ms" }}
            >
              টাকা ফেরত, অর্ডার বাতিল আর ফি-র হিসাব —{" "}
              <span className="relative inline-block bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 bg-clip-text text-transparent">
                সব পরিষ্কার
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

            <p
              className="animate-fade-up mt-7 max-w-xl text-sm leading-relaxed text-ink-600 sm:text-base"
              style={{ animationDelay: "160ms" }}
            >
              দুই ধরনের রিফান্ড আছে — ক্রেতার অর্ডার এবং মার্চেন্টের প্ল্যাটফর্ম সাবস্ক্রিপশন। দুটোর
              নিয়ম আলাদা, তাই নিচে ধাপে ধাপে আলাদা করে দেওয়া আছে।
            </p>

            <div
              className="animate-fade-up mt-7 flex flex-wrap items-center gap-2"
              style={{ animationDelay: "220ms" }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-medium text-ink-600">
                <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
                সর্বশেষ হালনাগাদ: {LAST_UPDATED}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                প্ল্যাটফর্ম ডিফল্ট নীতি
              </span>
            </div>

            <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "300ms" }}>
              <ButtonLink href="/help" size="lg">
                সহায়তা নিন
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="lg">
                যোগাযোগ করুন
              </ButtonLink>
            </div>
          </div>

          {/* At-a-glance card */}
          <div className="animate-fade-up relative mx-auto w-full max-w-md lg:max-w-none" style={{ animationDelay: "200ms" }}>
            <div aria-hidden="true" className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-200/60 via-white to-accent-400/25 blur-2xl" />

            <div className="relative rounded-3xl border border-white/80 bg-white/85 p-5 shadow-2xl shadow-brand-900/10 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-500 uppercase">এক নজরে</p>
                  <p className="mt-1 text-sm font-semibold text-ink-900">রিফান্ডের তিনটি সময়সীমা</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  হালনাগাদ
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {FACTS.map((fact) => {
                  const Icon = fact.icon;
                  return (
                    <div key={fact.label} className="rounded-2xl border border-ink-100 bg-white p-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="mt-2 text-lg font-bold tracking-tight text-ink-900">{fact.value}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{fact.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-ink-100 bg-ink-50/70 p-4">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-500 uppercase">মনে রাখুন</p>
                <ul className="mt-2.5 space-y-2">
                  {[
                    "পুরো বাতিল বা পুরো রিফান্ডে প্ল্যাটফর্ম ফি ফেরত",
                    "আংশিক রিফান্ডে শুধু রিফান্ড হওয়া লাইনের অনুপাতে সমন্বয়",
                    "গেটওয়ে চার্জ গেটওয়ের নিজস্ব নীতিতে প্রযোজ্য",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-600">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                        <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m2 6 2.5 2.5L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 px-1">
                <Link href="/contact" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800">
                  প্রশ্ন আছে? টিকেট খুলুন
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
                <span className="text-[10px] text-ink-400">BDT · Asia/Dhaka</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audience strip */}
      <section aria-label="কার জন্য এই নীতি" className="border-b border-ink-100 bg-ink-50/45 py-6">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 sm:grid-cols-3">
          {AUDIENCES.map((audience) => {
            const Icon = audience.icon;
            return (
              <a
                key={audience.title}
                href={audience.href}
                className="group flex items-start gap-3 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-xs backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-md"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    {audience.title}
                    <ArrowUpRight className="h-3 w-3 text-ink-300 transition group-hover:text-brand-600" />
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{audience.body}</span>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Document */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14 lg:py-16">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs">
              <p className="px-2 text-[10px] font-semibold tracking-[0.18em] text-ink-500 uppercase">এই নীতিতে</p>
              <nav className="mt-2 space-y-0.5">
                {NAV.map((item, index) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-600 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    <span className="w-4 font-mono text-[9px] text-ink-300 group-hover:text-brand-500">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-brand-700 shadow-xs">
                <MessageSquare className="h-4 w-4" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">নিজে সমাধান হচ্ছে না?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
                ইনভয়েস বা অর্ডার আইডি দিয়ে টিকেট খুলুন — কর্মদিবসে উত্তর পাবেন।
              </p>
              <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800">
                যোগাযোগ করুন
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-14">
          {/* 01 — Buyer order refund */}
          <section id="order-refund" className="scroll-mt-24">
            <SectionHeading
              index="০১"
              title="ক্রেতার অর্ডার রিফান্ড"
              description="প্রতিটি দোকানের নিজস্ব রিটার্ন নীতি থাকে; ATLaS প্রক্রিয়াটি চালায়, সিদ্ধান্তের দায় মার্চেন্টের।"
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="space-y-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-xs sm:p-6">
                <p className="text-sm leading-relaxed text-ink-600">
                  ক্রেতা অর্ডার ট্র্যাকিং পেজ থেকে রিটার্ন বা রিফান্ডের অনুরোধ করতে পারেন। অনুরোধটি
                  মার্চেন্টের অর্ডার ডিটেইলে জমা হয় এবং স্ট্যাটাস{" "}
                  <span className="font-semibold text-ink-800">“রিটার্ন অনুরোধ”</span> হয়।
                </p>
                <p className="text-sm leading-relaxed text-ink-600">
                  মার্চেন্ট অনুমোদন করলে গেটওয়ে দিয়ে রিফান্ড প্রসেস হয়; ক্যাশ অন ডেলিভারিতে রিফান্ডের
                  ব্যবস্থা মার্চেন্ট নিজে করেন।
                </p>
                <p className="text-sm leading-relaxed text-ink-600">
                  পণ্য ভাঙা, ভুল পণ্য বা বর্ণনার সাথে মিল না থাকলে ডেলিভারির ৭ দিনের মধ্যে জানানো উচিত।
                  ব্যবহৃত বা ক্ষতিগ্রস্ত পণ্য সাধারণত ফেরত নেওয়া হয় না, যদি না সমস্যাটি আগে থেকেই ছিল।
                </p>
              </div>

              <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:p-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-700 shadow-xs">
                  <Clock className="h-4 w-4" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-900">৭ দিনের জানানোর উইন্ডো</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                  পণ্য পাওয়ার দিন থেকে ৭ দিনের মধ্যে ছবি ও বিবরণসহ জানালে মার্চেন্টের যাচাই করা সহজ হয়।
                </p>
                <div className="mt-4 rounded-xl border border-brand-100 bg-white/80 p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-brand-700 uppercase">প্রয়োজন হবে</p>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-ink-600">
                    <li>• অর্ডার আইডি</li>
                    <li>• সমস্যার ছবি বা ভিডিও</li>
                    <li>• সংক্ষিপ্ত বিবরণ</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 02 — Process */}
          <section id="process" className="scroll-mt-24">
            <SectionHeading
              index="০২"
              title="রিফান্ড প্রক্রিয়া"
              description="অনুরোধ থেকে টাকা ফেরা পর্যন্ত চারটি ধাপ। প্রতিটি ধাপ অর্ডার টাইমলাইনে দেখা যায়।"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-5 shadow-xs transition duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                  >
                    <span className="absolute -right-2 -top-3 font-mono text-5xl font-bold text-ink-50 transition group-hover:text-brand-50">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="relative mt-3 text-sm font-semibold text-ink-900">{step.title}</h3>
                    <p className="relative mt-1.5 text-[13px] leading-relaxed text-ink-600">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 03 — Platform fee */}
          <section id="platform-fee" className="scroll-mt-24">
            <SectionHeading
              index="০৩"
              title="রিফান্ড হলে প্ল্যাটফর্ম ফি"
              description="কমিশন শুধু সফল অর্ডারের উপর থাকে; বাতিল বা রিফান্ড হলে সেটি স্বয়ংক্রিয়ভাবে সমন্বয় হয়।"
            />

            <div className="mt-5 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/70 text-[10px] font-semibold tracking-[0.12em] text-ink-500 uppercase">
                      <th className="px-5 py-3">পরিস্থিতি</th>
                      <th className="px-5 py-3">প্ল্যাটফর্ম ফি</th>
                      <th className="px-5 py-3">মাসিক কোটা</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {FEE_ROWS.map((row) => (
                      <tr key={row.case} className="align-top transition hover:bg-ink-50/40">
                        <td className="px-5 py-4 text-[13px] font-semibold text-ink-800">{row.case}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONE[row.tone]}`}>
                            {row.fee}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-ink-600">{row.quota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-amber-700 shadow-xs">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              <p className="text-xs leading-relaxed text-amber-900/80">
                গেটওয়ে চার্জ গেটওয়ের নিজস্ব নীতি অনুযায়ী প্রযোজ্য এবং প্ল্যাটফর্ম কমিশনের সাথে মেশানো
                হয় না। তাই গেটওয়ে রিফান্ডে ব্যাংক বা গেটওয়ে কিছু চার্জ কাটতে পারে।
              </p>
            </div>
          </section>

          {/* 04 — Subscription cancel */}
          <section id="subscription" className="scroll-mt-24">
            <SectionHeading
              index="০৪"
              title="সাবস্ক্রিপশন বাতিল"
              description="মার্চেন্ট যেকোনো সময় বিলিং পেজ থেকে বাতিল করতে পারেন — ডেটা মুছে যায় না।"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-200 bg-brand-50/55 p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700 shadow-xs">
                  <BadgeCheck className="h-3 w-3" />
                  প্রস্তাবিত
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">সময় শেষে বাতিল</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                  চলতি পিরিয়ডের শেষ পর্যন্ত সব ফিচার চালু থাকে; এরপর অ্যাকাউন্ট ফ্রি প্ল্যানে নেমে আসে।
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-ink-600">
                  <li>• কোনো তাৎক্ষণিক ফিচার বন্ধ হয় না</li>
                  <li>• চলতি পিরিয়ডের জন্য চার্জ প্রযোজ্য</li>
                  <li>• ডেটা ও এক্সপোর্ট অ্যাক্সেস থাকে</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-semibold text-ink-600">
                  <Timer className="h-3 w-3" />
                  তাৎক্ষণিক
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">সাথে সাথে বাতিল</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                  পেইড ফিচার বন্ধ হয়ে অ্যাকাউন্ট ফ্রি প্ল্যানে নেমে আসে; নতুন তৈরি কোটা অনুযায়ী সীমিত হয়।
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-ink-600">
                  <li>• পুরোনো ডেটা মুছে যায় না</li>
                  <li>• পড়া, এডিট ও এক্সপোর্ট খোলা থাকে</li>
                  <li>• নতুন তৈরি কোটা ছাড়ালে বন্ধ হয়</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-brand-700 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-xs leading-relaxed text-ink-600">
                ৭ দিনের ট্রায়ালে কোনো চার্জ হয় না, তাই ট্রায়াল বাতিলে ফেরত দেওয়ার কিছু থাকে না।
              </p>
            </div>
          </section>

          {/* 05 — Subscription refund */}
          <section id="subscription-refund" className="scroll-mt-24">
            <SectionHeading
              index="০৫"
              title="সাবস্ক্রিপশন ফি ফেরত"
              description="চলতি মাসের ফি সাধারণত ফেরতযোগ্য নয়; তবে নির্দিষ্ট কিছু ক্ষেত্রে সম্পূর্ণ ফেরত বা ক্রেডিট পাওয়া যায়।"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {REFUND_RULES.map((rule) => {
                const Icon = rule.icon;
                return (
                  <div key={rule.title} className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-xs font-semibold text-ink-900">{rule.title}</h3>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-600">{rule.body}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/55 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-700 shadow-xs">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-ink-900">১৪ দিনের অনুরোধ উইন্ডো</p>
                  <p className="mt-0.5 text-[11px] text-ink-600">ইনভয়েস নম্বর ও কারণ লিখে বিলিং → ইনভয়েস → সহায়তা থেকে টিকেট খুলুন।</p>
                </div>
              </div>
              <ButtonLink href="/contact" variant="outline" size="sm" className="shrink-0">
                টিকেট খুলুন
                <ArrowUpRight className="h-3.5 w-3.5" />
              </ButtonLink>
            </div>
          </section>

          {/* 06 — How to request */}
          <section id="request" className="scroll-mt-24">
            <SectionHeading
              index="০৬"
              title="অনুরোধ করবেন যেভাবে"
              description="ক্রেতা ও মার্চেন্ট — দুই পক্ষের জন্য আলাদা পথ।"
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Package className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-ink-900">ক্রেতার জন্য</h3>
                </div>
                <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">01</span> অর্ডার ট্র্যাকিং পেজ খুলুন।</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">02</span> সমস্যাযুক্ত পণ্য ও কারণ নির্বাচন করুন।</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">03</span> ছবি/বিবরণসহ রিটার্ন বা রিফান্ডের অনুরোধ জমা দিন।</li>
                </ol>
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Store className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold text-ink-900">মার্চেন্টের জন্য</h3>
                </div>
                <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">01</span> অর্ডার → রিটার্ন/রিফান্ড অনুরোধ খুলুন।</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">02</span> অনুমোদন বা প্রত্যাখ্যান করুন, কারণ লিখুন।</li>
                  <li className="flex gap-2"><span className="font-mono text-[10px] text-brand-600">03</span> ক্যাশ অন ডেলিভারির রিফান্ড নিজে সম্পন্ন করুন; গেটওয়ে রিফান্ড সিস্টেম সম্পন্ন করে।</li>
                </ol>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
                <FileText className="h-3.5 w-3.5 text-brand-600" />
                সব অনুরোধ অডিট লগে থাকে
              </span>
              <span className="hidden h-3 w-px bg-ink-200 sm:block" />
              <ButtonLink href="/help" variant="ghost" size="sm" className="ml-auto">
                সহায়তা কেন্দ্র
                <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            </div>
          </section>

          {/* 07 — Dispute + FAQ */}
          <section id="dispute" className="scroll-mt-24">
            <SectionHeading
              index="০৭"
              title="বিরোধ ও সচরাচর জিজ্ঞাসা"
              description="ক্রেতা-মার্চেন্ট বিরোধে প্ল্যাটফর্ম মধ্যস্থতা করে; আইনগত ভোক্তা সুরক্ষা বিধি সবসময় এই নীতির উপরে।"
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {[
                  {
                    title: "মধ্যস্থতা",
                    body: "ক্রেতা-মার্চেন্ট বিরোধে প্ল্যাটফর্ম প্রথমে দুই পক্ষের তথ্য নিয়ে মধ্যস্থতা করে; পণ্যের গুণমান বা ডেলিভারির সিদ্ধান্ত মার্চেন্টের।",
                    icon: MessageSquare,
                  },
                  {
                    title: "অ্যাকাউন্ট সাসপেনশন",
                    body: "প্রমাণিত প্রতারণা, বারবার রিফান্ড এড়ানোর অভিযোগ বা নিষিদ্ধ পণ্য বিক্রয় হলে অ্যাকাউন্ট সাসপেন্ড হতে পারে।",
                    icon: ShieldCheck,
                  },
                  {
                    title: "আইনগত অধিকার",
                    body: "আইনগতভাবে প্রযোজ্য ভোক্তা সুরক্ষা বিধি সবসময় এই নীতির উপরে থাকবে।",
                    icon: BadgeCheck,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-3 rounded-2xl border border-ink-200 bg-white p-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-ink-900">{item.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-600">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">সচরাচর জিজ্ঞাসা</h3>
                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-500">{FAQS.length}টি প্রশ্ন</span>
                </div>
                <div className="mt-3 divide-y divide-ink-100">
                  {FAQS.map((faq) => (
                    <details key={faq.q} className="group py-3">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[13px] font-medium text-ink-800 [&::-webkit-details-marker]:hidden">
                        {faq.q}
                        <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400 transition group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 pr-5 text-xs leading-relaxed text-ink-600">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-ink-200 bg-ink-50/60 p-5">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-ink-500 uppercase">শেষ কথা</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
                এই নীতিটি প্ল্যাটফর্মের ডিফল্ট অবস্থান বর্ণনা করে; প্রতিটি দোকানের নিজস্ব রিটার্ন নীতি
                দোকানের পেজে প্রকাশিত থাকে এবং সেটিই ক্রেতার সাথে চুক্তি।
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Support CTA */}
      <section className="relative overflow-hidden border-t border-brand-800/20 bg-ink-900 py-14 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-brand-200 uppercase">সাপোর্ট</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">রিফান্ড নিয়ে প্রশ্ন আছে?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              ইনভয়েস নম্বর বা অর্ডার আইডি দিয়ে টিকেট খুলুন। কোন তথ্য দরকার তা নিচের সহায়তা কেন্দ্রে
              বিস্তারিত আছে।
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/contact" variant="inverse" size="lg">
              টিকেট খুলুন
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink href="/help" variant="inverse-outline" size="lg">
              সহায়তা কেন্দ্র
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
