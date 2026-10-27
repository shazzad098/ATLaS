import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  ChartColumn,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CreditCard,
  LayoutTemplate,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { PLAN_CODES, PLAN_DEFINITIONS, formatRate } from "@/lib/plans";

/** Public landing page (PRD §3). */

export const metadata = {
  title: "ATLaS — বাংলাদেশের অনলাইন দোকান এক জায়গায়",
  description:
    "ঘণ্টার মধ্যে নিজের দোকান দাঁড় করান — সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট সহ।",
};

/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────── */

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

function limitLabel(value: number | null): string {
  return value === null ? "আনলিমিটেড" : bn(value.toLocaleString("en-US"));
}

const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]";
const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:bg-[#f4f8f6]";

/* ──────────────────────────────────────────────────────────────
 * Copy
 * ────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: ChartColumn,
    title: "বিক্রয় ট্র্যাকিং",
    body: "প্রতিদিনের অর্ডার, আয় আর কমিশন এক নজরে — কোন সপ্তাহে বিক্রি বাড়ছে, গ্রাফেই দেখুন।",
    tile: "bg-[#E7F7F0] text-[#0B8F68]",
  },
  {
    icon: LayoutTemplate,
    title: "পেজ ও কনটেন্ট",
    body: "হোম, প্রোডাক্ট, কাস্টম পেজ আর নোটিশ — কোড ছাড়াই নিজের মতো সাজিয়ে নিন।",
    tile: "bg-[#F1EBFF] text-[#7C3AED]",
  },
  {
    icon: Truck,
    title: "ডেলিভারি ট্র্যাকিং",
    body: "জোনভিত্তিক চার্জ, কুরিয়ার আর COD কালেকশন — কোন অর্ডার কোথায় আছে, সব এক জায়গায়।",
    tile: "bg-[#FFF3E2] text-[#D97706]",
  },
  {
    icon: Users,
    title: "কাস্টমার ম্যানেজমেন্ট",
    body: "কাস্টমারের অর্ডার হিস্ট্রি, সেগমেন্ট আর ব্ল্যাকলিস্ট — রিপিট কাস্টমার চিনে রাখুন।",
    tile: "bg-[#E8F1FF] text-[#2563EB]",
  },
  {
    icon: CreditCard,
    title: "পেমেন্ট ও স্টক",
    body: "বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন ডেলিভারি — স্টক কমার সাথে সাথেই আপডেট।",
    tile: "bg-[#E5F7F5] text-[#0D9488]",
  },
  {
    icon: ChartNoAxesCombined,
    title: "রিপোর্ট ও ইনসাইট",
    body: "মাসিক বিক্রি, ওভারেজ ফি আর CSV এক্সপোর্ট — ব্যবসার সিদ্ধান্তের জন্য দরকারি সংখ্যা।",
    tile: "bg-[#F3E8FF] text-[#9333EA]",
  },
];

const STEPS = [
  {
    title: "মোবাইল নম্বর দিয়ে সাইনআপ",
    body: "OTP বা পাসওয়ার্ড — যেটা সহজ। কোনো কার্ড বা সেটআপ ফি লাগবে না।",
    tone: "bg-[#0BA678]",
    time: "২ মিনিট",
  },
  {
    title: "থিম বেছে দোকান সাজান",
    body: "নাম, থিম আর প্রথম প্রোডাক্ট যোগ করলেই আপনার দোকান দাঁড়িয়ে যাবে।",
    tone: "bg-[#3B82F6]",
    time: "৫ মিনিট",
  },
  {
    title: "Publish করে অর্ডার নিন",
    body: "চেকলিস্ট শেষ হলেই দোকান live — অর্ডার আসবে সরাসরি ড্যাশবোর্ডে।",
    tone: "bg-[#EC4899]",
    time: "সাথে সাথে",
  },
];

const PLAN_BADGE: Record<string, string> = {
  free: "শুরু এখানেই",
  basic: "বাড়ন্ত ব্যবসা",
  standard: "জনপ্রিয়",
  pro: "সব সুবিধা",
};

/** Labels only — the marketing illustration never shows invented sales figures. */
const PREVIEW_MODULES = [
  { name: "ক্যাটালগ", dot: "bg-[#F43F5E]", value: "পণ্য ও ভ্যারিয়েন্ট", meta: "স্টক ট্র্যাকিং" },
  { name: "অর্ডার", dot: "bg-[#10B981]", value: "লাইভ স্টেটাস", meta: "মার্চেন্ট + অ্যাডমিন" },
  { name: "ডেলিভারি", dot: "bg-[#3B82F6]", value: "জোন ও চার্জ", meta: "COD রেকর্ডিং" },
];

/* ──────────────────────────────────────────────────────────────
 * Hero dashboard illustration (no demo data)
 * ────────────────────────────────────────────────────────────── */

function DashboardPreview() {
  return (
    <div className="relative mx-auto mt-12 max-w-[960px] sm:mt-14">
      <div className="rounded-[22px] border border-[#e3ebe7] bg-white p-2 shadow-[0_30px_90px_-45px_rgba(6,60,45,0.55)] sm:p-3">
        {/* Window chrome */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f9f8] px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="hidden items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[10.5px] font-medium text-ink-500 shadow-xs sm:flex">
            <Store className="h-3 w-3 text-[#0B8F68]" /> সব দোকান <ChevronDown className="h-3 w-3" />
          </div>
          <div className="flex items-center gap-2 text-ink-400">
            <Bell className="h-3.5 w-3.5" />
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0BA678] text-[8.5px] font-bold text-white">
              র
            </span>
          </div>
        </div>

        {/* Store switcher */}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {PREVIEW_MODULES.map((module) => (
            <div key={module.name} className="rounded-xl border border-[#e9efec] bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${module.dot}`} />
                <p className="truncate text-[11px] font-semibold text-ink-900">{module.name}</p>
                <span className="ml-auto hidden rounded-full bg-[#E7F7F0] px-1.5 py-0.5 text-[8px] font-semibold text-[#0B8F68] sm:inline">
                  লাইভ
                </span>
              </div>
              <p className="mt-1.5 truncate text-[11px] font-semibold text-ink-800">{module.value}</p>
              <p className="text-[8.5px] text-ink-400">{module.meta}</p>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="mt-2.5 rounded-xl border border-[#e9efec] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9.5px] font-medium text-ink-400">এই মাসের বিক্রি</p>
              <p className="mt-0.5 text-[13px] font-bold tracking-tight text-ink-900">আপনার আসল ডেটা</p>
            </div>
            <span className="rounded-full bg-[#E7F7F0] px-2 py-0.5 text-[9px] font-semibold text-[#0B8F68]">
              লাইভ
            </span>
          </div>
          <svg viewBox="0 0 300 76" className="mt-2 h-[70px] w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="atlas-sales-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0BA678" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0BA678" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,62 C24,58 38,46 62,50 C86,54 96,32 124,36 C152,40 162,26 188,30 C214,34 232,14 258,20 L300,12 L300,76 L0,76 Z"
              fill="url(#atlas-sales-fill)"
            />
            <path
              d="M0,62 C24,58 38,46 62,50 C86,54 96,32 124,36 C152,40 162,26 188,30 C214,34 232,14 258,20 L300,12"
              fill="none"
              stroke="#0BA678"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="mt-1 flex justify-between text-[7.5px] text-ink-400">
            {["সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি", "রবি"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {[
            { label: "নতুন অর্ডার", value: "তাৎক্ষণিক", delta: "লাইভ" },
            { label: "স্টক", value: "স্বয়ংক্রিয়", delta: "লাইভ" },
            { label: "ড্যাশবোর্ড", value: "এক ডেটাবেস", delta: "সিঙ্ক" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-[#e9efec] px-2.5 py-2">
              <p className="truncate text-[8.5px] font-medium text-ink-400">{kpi.label}</p>
              <div className="mt-0.5 flex items-baseline gap-1">
                <p className="truncate text-[13px] font-bold text-ink-900">{kpi.value}</p>
                <span className="text-[8px] font-semibold text-[#0B8F68]">{kpi.delta}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Payments + latest orders */}
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-[#e9efec] p-2.5">
            <p className="text-[9.5px] font-semibold text-ink-800">পেমেন্ট মেথড</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { label: "COD", tone: "bg-[#0F172A]" },
                { label: "bKash", tone: "bg-[#E2136E]" },
                { label: "Nagad", tone: "bg-[#F58220]" },
                { label: "SSLCommerz", tone: "bg-[#1F6FD0]" },
              ].map((method) => (
                <span
                  key={method.label}
                  className={`rounded-md px-1.5 py-1 text-[8px] font-semibold text-white ${method.tone}`}
                >
                  {method.label}
                </span>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[8.5px] text-ink-400">
              <ShieldCheck className="h-3 w-3 text-[#0B8F68]" /> সব পেমেন্ট ভেরিফায়েড
            </p>
          </div>

          <div className="rounded-xl border border-[#e9efec] p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-semibold text-ink-800">সর্বশেষ অর্ডার</p>
              <span className="text-[8.5px] font-medium text-[#0B8F68]">সব দেখুন</span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {[
                { id: "অর্ডার", who: "স্টোরফ্রন্ট থেকে", method: "তাৎক্ষণিক নোটিফিকেশন", badge: "লাইভ" },
                { id: "স্টক", who: "অর্ডার হলে", method: "স্বয়ংক্রিয় ইনভেন্টরি", badge: "সিঙ্ক" },
                { id: "স্টেটাস", who: "মার্চেন্ট প্যানেল", method: "সুপার-অ্যাডমিনেও দেখা যায়", badge: "DB" },
              ].map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#F1F5F3] text-[8px] font-bold text-ink-600">
                      {row.id.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[8.5px] font-semibold text-ink-800">
                        {row.id} · {row.who}
                      </p>
                      <p className="truncate text-[7.5px] text-ink-400">{row.method}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#E7F7F0] px-1.5 py-0.5 text-[7.5px] font-semibold text-[#0B8F68]">
                    {row.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live bar */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#082F29] px-3 py-2.5 text-white">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <p className="text-[10px] font-medium">দোকান এখন লাইভ — নতুন অর্ডার আসছে</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/60">স্টোরফ্রন্ট · মার্চেন্ট প্যানেল · সুপার-অ্যাডমিন</span>
          </div>
        </div>
      </div>

      {/* Floating order toast */}
      <div className="absolute -right-3 bottom-20 hidden w-52 rounded-2xl border border-[#e3ebe7] bg-white p-3 shadow-[0_22px_45px_-22px_rgba(6,60,45,0.45)] lg:block">
        <div className="flex items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E7F7F0] text-[#0BA678]">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10.5px] font-semibold text-ink-900">নতুন অর্ডার এসেছে</p>
            <p className="mt-0.5 text-[9px] text-ink-500">স্টোরফ্রন্ট থেকে · লাইভ নোটিফিকেশন</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const plans = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code]);

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eefaf5] via-[#f8fdfb] to-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_75%_at_50%_0%,#d6f3e8_0%,rgba(255,255,255,0)_70%)]" />
        <div className="relative mx-auto max-w-[1160px] px-4 pt-14 pb-16 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8ede4] bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#0B7A5B] shadow-[0_1px_2px_rgba(13,42,32,0.04)] backdrop-blur">
              <Sparkles className="h-3 w-3" />
              বাংলাদেশের জন্য তৈরি
            </span>

            <h1 className="mt-5 text-[34px] leading-[1.18] font-bold tracking-[-0.02em] text-ink-900 sm:text-[52px] sm:leading-[1.12]">
              আপনার অনলাইন দোকান,
              <br />
              <span className="text-[#0B9A6E]">এক জায়গায়।</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-[13.5px] leading-7 text-ink-500 sm:text-[15px]">
              সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার, ডেলিভারি চার্জ আর বিকাশ/নগদ/SSLCommerz/COD — সব এক
              ড্যাশবোর্ডে। কোড লিখতে হবে না, ডিজাইনও শেখা লাগবে না।
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
              <Link href="/signup" className={primaryButton}>
                শুরু করুন – ফ্রি <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/how-it-works" className={secondaryButton}>
                কীভাবে কাজ করে
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
              <BadgeCheck className="h-3.5 w-3.5 text-[#0BA678]" />
              ফ্রি প্ল্যানে শুরু — কোনো কার্ড লাগবে না, সেটআপ ফি নেই
            </p>
          </div>

          <DashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-[1100px] scroll-mt-24 px-4 pt-16 pb-16 sm:px-6 sm:pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
              কেন ATLaS
            </span>
            <h2 className="mt-3 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
              যা যা আছে
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-ink-500">
              দোকান খোলা থেকে ডেলিভারি পর্যন্ত — প্রতিদিনের কাজগুলো এক প্ল্যাটফর্মে।
            </p>
          </div>
          <Link href="/features" className={secondaryButton}>
            সব ফিচার দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-[#e7eeea] bg-white p-5 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(6,60,45,0.4)]"
            >
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${feature.tile}`}>
                <feature.icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
              </span>
              <p className="mt-4 text-[14px] font-semibold text-ink-900">{feature.title}</p>
              <p className="mt-1.5 text-[12.5px] leading-6 text-ink-500">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
            স্টার্ট গাইড
          </span>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
            কীভাবে শুরু করবেন
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-ink-500">
            তিন ধাপে — আজই আপনার দোকান লাইভ।
          </p>
        </div>

        <ol className="mt-8 grid gap-3.5 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col rounded-2xl border border-[#e7eeea] bg-white p-5 shadow-[0_1px_2px_rgba(13,42,32,0.04)]"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-[12px] font-bold text-white ${step.tone}`}
              >
                {bn(index + 1)}
              </span>
              <p className="mt-4 text-[14px] font-semibold text-ink-900">{step.title}</p>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-6 text-ink-500">{step.body}</p>
              <div className="mt-5 flex items-center justify-between border-t border-[#f0f4f2] pt-3">
                <span className="text-[10.5px] text-ink-400">{step.time}</span>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#0B8F68] transition hover:text-[#086b4f]"
                >
                  শুরু করুন <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Themes */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
              লাইভ ডেমো
            </span>
            <h2 className="mt-3 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
              থিম গ্যালারি
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-ink-500">
              যে ব্যবসা, সেই ডিজাইন — যেকোনো সময় বদলাতে পারবেন।
            </p>
          </div>
          <Link href="/themes" className={secondaryButton}>
            সব থিম দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {THEME_CATALOG.map((theme) => (
            <div
              key={theme.code}
              className="overflow-hidden rounded-2xl border border-[#e7eeea] bg-white shadow-[0_1px_2px_rgba(13,42,32,0.04)]"
            >
              <div className={`relative h-40 bg-gradient-to-br ${theme.preview.gradient}`}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-1.5">
                    {theme.preview.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="h-4 w-4 rounded-full border border-white/70"
                        style={{ background: swatch }}
                      />
                    ))}
                  </div>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-medium text-ink-600 backdrop-blur">
                    {theme.style}
                  </span>
                </div>
                <div className="absolute inset-x-3 bottom-3 flex items-end justify-between">
                  <span className="rounded-md bg-white/65 px-2 py-1 text-[9px] font-semibold text-ink-600 backdrop-blur">
                    Cover preview
                  </span>
                  <span className="rounded-md bg-white/50 px-2 py-1 text-[8.5px] font-medium text-ink-600 backdrop-blur">
                    {theme.industry.split(",")[0]}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13.5px] font-semibold text-ink-900">{theme.name}</p>
                  <span className="rounded-full border border-[#e7eeea] bg-[#f8fbf9] px-2 py-0.5 text-[8.5px] font-medium text-ink-500">
                    v{theme.version}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-5 text-ink-500">
                  {theme.description}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    href="/themes"
                    className="inline-flex items-center justify-center rounded-lg border border-[#e2ebe6] bg-white px-2 py-1.5 text-[10.5px] font-semibold text-ink-700 transition hover:bg-[#f4f8f6]"
                  >
                    থিম দেখুন
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center rounded-lg bg-[#E7F7F0] px-2 py-1.5 text-[10.5px] font-semibold text-[#0B7A5B] transition hover:bg-[#d9f1e7]"
                  >
                    এই থিমে শুরু
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
              প্ল্যান ও দাম
            </span>
            <h2 className="mt-3 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
              প্ল্যান
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-ink-500">
              ফ্রি দিয়ে শুরু করুন — বাড়লে প্ল্যান বদলান, কমিশন কমবে।
            </p>
          </div>
          <Link href="/pricing" className={secondaryButton}>
            সব প্ল্যান দেখুন <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-9 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const featured = plan.code === "standard";
            const price =
              plan.monthlyPriceBdt === null
                ? "কাস্টম"
                : plan.monthlyPriceBdt === 0
                  ? "৳০"
                  : `৳${plan.monthlyPriceBdt.toLocaleString("en-US")}`;
            const priceHint =
              plan.monthlyPriceBdt === null
                ? "আপনার প্রয়োজন অনুযায়ী"
                : plan.monthlyPriceBdt === 0
                  ? "চিরকাল ফ্রি"
                  : "প্রতি মাসে";

            const features = [
              `প্রোডাক্ট: ${limitLabel(plan.$limits.products)}`,
              `মাসিক অর্ডার: ${limitLabel(plan.$limits.monthlyOrders)}`,
              `স্টাফ seat: ${bn(plan.$limits.staffSeats)} জন`,
              plan.$limits.customDomain ? "নিজের ডোমেইন + সাবডোমেইন" : "সাবডোমেইন",
              `ওভারেজ: ${bn(formatRate(plan.$limits.overageRate))}`,
            ];

            return (
              <div
                key={plan.code}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 ${
                  featured
                    ? "border-[#0BA678] shadow-[0_20px_45px_-28px_rgba(11,166,120,0.55)] ring-1 ring-[#0BA678]/15"
                    : "border-[#e7eeea] shadow-[0_1px_2px_rgba(13,42,32,0.04)]"
                }`}
              >
                {featured ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#0BA678] px-2.5 py-0.5 text-[8.5px] font-bold text-white">
                    জনপ্রিয়
                  </span>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-ink-900">{plan.name}</p>
                  {featured ? null : (
                    <span className="rounded-full bg-[#E7F7F0] px-2 py-0.5 text-[8.5px] font-semibold text-[#0B7A5B]">
                      {PLAN_BADGE[plan.code]}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[27px] font-bold tracking-tight text-ink-900">{price}</p>
                <p className="text-[9.5px] text-ink-400">{priceHint}</p>

                <ul className="mt-4 flex-1 space-y-2 border-t border-[#f0f4f2] pt-4 text-[11.5px] text-ink-600">
                  {features.map((item) => (
                    <li key={item} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0BA678]" strokeWidth={2.8} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`mt-5 inline-flex items-center justify-center rounded-[9px] px-3 py-2 text-[11.5px] font-semibold transition ${
                    featured
                      ? "bg-[#0BA678] text-white shadow-[0_10px_22px_-12px_rgba(11,166,120,0.95)] hover:bg-[#099569]"
                      : "border border-[#dfe8e4] bg-white text-ink-800 hover:bg-[#f4f8f6]"
                  }`}
                >
                  {plan.monthlyPriceBdt === 0 ? "শুরু করুন – ফ্রি" : "কথা বলুন"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-[24px] bg-[#072e28] px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_130%_at_12%_0%,#0f8a67_0%,rgba(7,46,40,0)_60%)] opacity-80" />
          <div className="pointer-events-none absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-[#0BA678]/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <h2 className="text-[22px] font-bold tracking-tight text-white sm:text-[28px]">
                আজই আপনার দোকান শুরু করুন
              </h2>
              <p className="text-[12.5px] leading-6 text-white/65 sm:text-[13px]">
                মোবাইল নম্বর দিয়েই শুরু — কোনো সেটআপ ফি নেই, কার্ডও লাগবে না।
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_26px_-14px_rgba(11,166,120,0.9)] transition hover:bg-[#099569]"
              >
                শুরু করুন – ফ্রি <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-white/20 bg-white/5 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/10"
              >
                ফিচার দেখুন
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10.5px] text-ink-400">
          কোনো ক্রেডিট কার্ড লাগবে না · যেকোনো সময় বাতিল · বাংলা সাপোর্ট
        </p>
      </section>
    </div>
  );
}
