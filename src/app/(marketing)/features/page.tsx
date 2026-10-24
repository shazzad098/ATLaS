import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChartColumn,
  Check,
  ChevronDown,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

/** Public feature tour. Deliberately laid out as a module index + detail rows,
 *  so it reads as a product tour rather than a second landing page. */

export const metadata = {
  title: "ফিচার",
  description:
    "অর্ডার, পেমেন্ট, ডেলিভারি, স্টক, কাস্টমার, থিম আর রিপোর্ট — ATLaS-এর সব ফিচার এক নজরে।",
};

const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]";
const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:bg-[#f4f8f6]";

const CATEGORIES = [
  {
    id: "orders",
    icon: ShoppingBag,
    kicker: "অর্ডার ম্যানেজমেন্ট",
    title: "অর্ডার আসুক, আপনি শুধু এগিয়ে দিন",
    body: "প্লেসড থেকে ডেলিভারড — প্রতিটি অর্ডারের স্ট্যাটাস, পেমেন্ট আর হিস্ট্রি এক জায়গায়।",
    tile: "bg-[#E7F7F0] text-[#0B8F68]",
    points: [
      {
        title: "অর্ডার লিস্ট ও ফিল্টার",
        body: "স্ট্যাটাস, তারিখ, পেমেন্ট আর কাস্টমার দিয়ে যেকোনো অর্ডার খুঁজে নিন।",
      },
      {
        title: "স্ট্যাটাস ফ্লো",
        body: "প্রতিটি ধাপে বৈধ ট্রানজিশন — ভুল স্ট্যাটাসে অর্ডার আটকে যাবে না।",
      },
      {
        title: "ইনভয়েস ও রিফান্ড",
        body: "ইনভয়েস ডাউনলোড, রিফান্ড রিকোয়েস্ট আর অ্যাপ্রুভাল এক প্যানেলে।",
      },
      {
        title: "কুপন ও ডিসকাউন্ট",
        body: "শতাংশ বা নির্দিষ্ট ছাড়, ব্যবহারের সীমা ও মেয়াদ — সব নিয়ন্ত্রণে।",
      },
    ],
  },
  {
    id: "payments",
    icon: Wallet,
    kicker: "পেমেন্ট",
    title: "দেশীয় পেমেন্ট, একই চেকআউটে",
    body: "বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন ডেলিভারি — কাস্টমার যা পছন্দ, সেটাই।",
    tile: "bg-[#FFF3E2] text-[#D97706]",
    points: [
      {
        title: "৪টি পেমেন্ট মেথড",
        body: "COD সহ দেশীয় জনপ্রিয় গেটওয়ে — এক ক্লিকে চালু বা বন্ধ করুন।",
      },
      {
        title: "স্যান্ডবক্স টেস্ট",
        body: "লাইভ ক্রেডেনশিয়াল ছাড়াই সম্পূর্ণ পেমেন্ট ফ্লো টেস্ট করুন।",
      },
      {
        title: "ওয়েবহুক ভেরিফিকেশন",
        body: "সিগনেচার যাচাই ও আইডেম্পোটেন্ট ক্লেইম — ডাবল পেমেন্ট হবে না।",
      },
      {
        title: "প্ল্যাটফর্ম ফি",
        body: "প্রতি অর্ডারের কমিশন স্বয়ংক্রিয়ভাবে ফি লেজারে জমা হয়।",
      },
    ],
  },
  {
    id: "delivery",
    icon: Truck,
    kicker: "ডেলিভারি",
    title: "কোথায় কত চার্জ, আপনি ঠিক করবেন",
    body: "এলাকাভিত্তিক ডেলিভারি চার্জ, ফ্রি ডেলিভারি সীমা আর কুরিয়ার ট্র্যাকিং — সব একসাথে।",
    tile: "bg-[#E8F1FF] text-[#2563EB]",
    points: [
      {
        title: "ডেলিভারি জোন",
        body: "ঢাকার ভিতরে ও বাইরে আলাদা চার্জ — এলাকা বেছে নিন।",
      },
      {
        title: "ফ্রি ডেলিভারি",
        body: "নির্দিষ্ট অর্ডার মূল্যের উপরে চার্জ শূন্য — নিজেই সেট করুন।",
      },
      {
        title: "কুরিয়ার ইন্টিগ্রেশন",
        body: "থার্ড-পার্টি কুরিয়ারে শিপমেন্ট তৈরি ও স্ট্যাটাস আপডেট।",
      },
      {
        title: "COD কালেকশন",
        body: "ক্যাশ কালেকশন রেকর্ড করে অর্ডার স্বয়ংক্রিয়ভাবে ক্লোজ হয়।",
      },
    ],
  },
  {
    id: "catalog",
    icon: Boxes,
    kicker: "ক্যাটালগ ও স্টক",
    title: "প্রোডাক্ট যোগ করুন, স্টক নিজেই হিসাব রাখুক",
    body: "ভ্যারিয়েন্ট, ক্যাটাগরি, ছবি আর স্টক — বাল্ক ইমপোর্ট থেকে লো-স্টক অ্যালার্ট পর্যন্ত।",
    tile: "bg-[#F1EBFF] text-[#7C3AED]",
    points: [
      {
        title: "ভ্যারিয়েন্ট ও ক্যাটাগরি",
        body: "সাইজ/রঙ আলাদা স্টকসহ, ক্যাটাগরি দিয়ে গোছানো ক্যাটালগ।",
      },
      {
        title: "CSV ইমপোর্ট/এক্সপোর্ট",
        body: "এক ফাইলে শত শত প্রোডাক্ট যোগ করুন বা ব্যাকআপ রাখুন।",
      },
      {
        title: "স্টক লেজার",
        body: "প্রতিটি স্টক মুভমেন্টের হিসাব — কে, কখন, কেন বদলাল।",
      },
      {
        title: "লো-স্টক অ্যালার্ট",
        body: "স্টক কমে গেলে ড্যাশবোর্ডে সতর্কতা — আগেই রিস্টক করুন।",
      },
    ],
  },
  {
    id: "customers",
    icon: Users,
    kicker: "কাস্টমার",
    title: "কাস্টমারকে চিনুন, আবার ফিরিয়ে আনুন",
    body: "প্রতিটি কাস্টমারের অর্ডার হিস্ট্রি, সেগমেন্ট আর যোগাযোগ — এক প্রোফাইলে।",
    tile: "bg-[#E5F7F5] text-[#0D9488]",
    points: [
      {
        title: "কাস্টমার প্রোফাইল",
        body: "ফোন, ঠিকানা, মোট খরচ আর সব অর্ডার — এক পাতায়।",
      },
      {
        title: "সেগমেন্ট",
        body: "নতুন, রিপিট, VIP আর নিষ্ক্রিয় — নিজে থেকেই ভাগ হয়ে যায়।",
      },
      {
        title: "ব্ল্যাকলিস্ট",
        body: "সমস্যাযুক্ত কাস্টমারকে চেকআউট থেকে আটকান।",
      },
      {
        title: "নোটিফিকেশন",
        body: "অর্ডার আপডেট SMS/ইমেইলে — ডেমো ইনবক্সে যাচাই করুন।",
      },
    ],
  },
  {
    id: "themes",
    icon: Palette,
    kicker: "থিম ও ডিজাইন",
    title: "ডিজাইনার ছাড়াই দোকান সাজান",
    body: "তিনটি রেডিমেড থিম, কাস্টম রঙ আর পেজ এডিটর — কোড ছাড়াই আপনার ব্র্যান্ড।",
    tile: "bg-[#FDF2F8] text-[#DB2777]",
    points: [
      {
        title: "৩টি তৈরি থিম",
        body: "Nokshi, Bazar, Studio — যেকোনো সময় বদলাতে পারবেন।",
      },
      {
        title: "লাইভ প্রিভিউ",
        body: "Publish করার আগেই দেখে নিন দোকান কেমন দেখাবে।",
      },
      {
        title: "কাস্টম পেজ",
        body: "হোম, রিটার্ন পলিসি, যোগাযোগ — নিজের কনটেন্টে সাজান।",
      },
      {
        title: "সাবডোমেইন ও ডোমেইন",
        body: "প্রতিটি দোকান পায় নিজের ঠিকানা, উপরের প্ল্যানে কাস্টম ডোমেইন।",
      },
    ],
  },
  {
    id: "team",
    icon: ChartColumn,
    kicker: "টিম ও রিপোর্ট",
    title: "টিম চালান, সংখ্যায় সিদ্ধান্ত নিন",
    body: "রোলভিত্তিক অ্যাক্সেস, অডিট লগ আর মাসিক রিপোর্ট — ব্যবসা বড় হলেও নিয়ন্ত্রণে।",
    tile: "bg-[#F3E8FF] text-[#9333EA]",
    points: [
      {
        title: "রোল ও পারমিশন",
        body: "মালিক, ম্যানেজার, স্টাফ — প্রত্যেকে শুধু নিজের কাজ দেখবে।",
      },
      {
        title: "অডিট লগ",
        body: "কে কী বদলাল, কখন — সব রেকর্ড থেকে যায়।",
      },
      {
        title: "রিপোর্ট",
        body: "বিক্রি, ফি, স্টক আর কাস্টমার — CSV এক্সপোর্টসহ।",
      },
      {
        title: "সাবস্ক্রিপশন",
        body: "প্ল্যান, ইনভয়েস আর ওভারেজ ফি এক জায়গায়।",
      },
    ],
  },
];

const STATS = [
  { value: "৭টি", label: "টুল, এক ড্যাশবোর্ডে" },
  { value: "৪টি", label: "পেমেন্ট মেথড" },
  { value: "৩টি", label: "রেডিমেড থিম" },
  { value: "০", label: "লাইন কোড লিখতে হবে" },
];

const FAQ = [
  {
    q: "সব ফিচার কি সব প্ল্যানে পাওয়া যায়?",
    a: "মূল ফিচারগুলো সব প্ল্যানে আছে। কিছু অ্যাডভান্সড সুবিধা — কাস্টম ডোমেইন, বাল্ক টুলস, অ্যাডভান্সড রিপোর্ট ও অটোমেশন — উপরের প্ল্যানে খোলে। বিস্তারিত তুলনা প্রাইসিং পাতায় দেখুন।",
  },
  {
    q: "নিজের ডোমেইন কখন যোগ করতে পারব?",
    a: "Standard ও Pro প্ল্যানে সাবডোমেইনের সাথে নিজের ডোমেইনও যোগ করা যায়। DNS ভেরিফিকেশন ধাপে ধাপে দেখানো হয়, তাই আলাদা টেকনিক্যাল সহায়তা লাগে না।",
  },
  {
    q: "পেমেন্ট গেটওয়ে কি এখনই লাইভ?",
    a: "বিকাশ, নগদ ও SSLCommerz-এর স্যান্ডবক্স ফ্লো এখনই কাজ করে। মার্চেন্ট অনবোর্ডিং শেষে লাইভ ক্রেডেনশিয়াল বসালেই আসল পেমেন্ট চালু হবে।",
  },
  {
    q: "ডেটা এক্সপোর্ট করা যাবে?",
    a: "অর্ডার, প্রোডাক্ট ও কাস্টমার CSV-তে এক্সপোর্ট করা যায় — নিজের ব্যাকআপ বা হিসাবরক্ষকের কাছে পাঠানোর জন্য।",
  },
];

function SectionAnchor({ id }: { id: string }) {
  return <span id={id} className="block scroll-mt-28" aria-hidden />;
}

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#e8eeeb] bg-gradient-to-b from-[#eefaf5] to-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(55%_80%_at_20%_0%,#d9f4e9_0%,rgba(255,255,255,0)_75%)]" />
        <div className="relative mx-auto grid max-w-[1100px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <nav className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
              <Link href="/" className="transition hover:text-ink-700">
                হোম
              </Link>
              <span>/</span>
              <span className="font-medium text-ink-600">ফিচার</span>
            </nav>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
              <Sparkles className="h-3 w-3" />
              প্রোডাক্ট ট্যুর
            </span>

            <h1 className="mt-3 text-[30px] leading-[1.2] font-bold tracking-[-0.015em] text-ink-900 sm:text-[42px] sm:leading-[1.15]">
              আপনার দোকানের <span className="text-[#0B9A6E]">সব ফিচার</span>,
              <br className="hidden sm:block" /> এক ড্যাশবোর্ডে
            </h1>

            <p className="mt-4 max-w-xl text-[13px] leading-7 text-ink-500 sm:text-[14px]">
              অর্ডার, পেমেন্ট, ডেলিভারি, স্টক, কাস্টমার, থিম আর রিপোর্ট — প্রতিদিনের প্রতিটি কাজের
              জন্য আলাদা মডিউল। নিচে প্রতিটি অংশে ঢুকে দেখুন কী কী আছে।
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link href="/signup" className={primaryButton}>
                ফ্রি শুরু করুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/store/nokshi-demo" className={secondaryButton}>
                ডেমো স্টোর <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#0BA678]" strokeWidth={2.6} /> কোডিং লাগবে না
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#0BA678]" strokeWidth={2.6} /> বাংলা সাপোর্ট
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0BA678]" /> টেন্যান্ট-আইসোলেটেড ডেটা
              </span>
            </div>
          </div>

          {/* Module index card */}
          <div className="rounded-2xl border border-[#e3ebe7] bg-white p-4 shadow-[0_24px_60px_-40px_rgba(6,60,45,0.5)]">
            <div className="flex items-center justify-between border-b border-[#eef3f0] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0BA678] text-[11px] font-bold text-white">
                  A
                </span>
                <div>
                  <p className="text-[11.5px] font-semibold text-ink-900">আপনার ড্যাশবোর্ড</p>
                  <p className="text-[9px] text-ink-400">৭টি টুল চালু</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F7F0] px-2 py-0.5 text-[9px] font-semibold text-[#0B8F68]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0BA678]" /> লাইভ
              </span>
            </div>

            <div className="mt-1 divide-y divide-[#f2f6f4]">
              {CATEGORIES.map((category) => (
                <a key={category.id} href={`#${category.id}`} className="group flex items-center gap-2.5 py-2.5">
                  <span className={`grid h-7 w-7 place-items-center rounded-lg ${category.tile}`}>
                    <category.icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-[11.5px] font-medium text-ink-700 transition group-hover:text-ink-900">
                    {category.title}
                  </span>
                  <ArrowRight className="h-3 w-3 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-[#0BA678]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Module detail */}
      <div className="mx-auto max-w-[1100px] px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[236px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-[#e7eeea] bg-[#fbfdfc] p-4">
              <p className="text-[10px] font-semibold tracking-[0.12em] text-ink-400">এই পাতায়</p>
              <nav className="mt-3 space-y-0.5">
                {CATEGORIES.map((category) => (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] font-medium text-ink-600 transition hover:bg-white hover:text-ink-900 hover:shadow-xs"
                  >
                    <category.icon className="h-3.5 w-3.5 text-ink-400" strokeWidth={2} />
                    {category.kicker}
                  </a>
                ))}
              </nav>
              <div className="mt-3 border-t border-[#eef3f0] pt-3">
                <p className="text-[10.5px] leading-5 text-ink-500">
                  কোন প্ল্যানে কী আছে — এক পাতায় তুলনা করুন।
                </p>
                <Link
                  href="/pricing"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B8F68] transition hover:text-[#086b4f]"
                >
                  প্ল্যান তুলনা <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Mobile chip nav */}
            <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
              {CATEGORIES.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e2ebe6] bg-white px-3 py-1.5 text-[10.5px] font-medium text-ink-600"
                >
                  <category.icon className="h-3 w-3 text-[#0B8F68]" />
                  {category.kicker}
                </a>
              ))}
            </div>

            <div className="space-y-12">
              {CATEGORIES.map((category, index) => (
                <section key={category.id} className="border-t border-[#eef3f0] pt-10 first:border-0 first:pt-0">
                  <SectionAnchor id={category.id} />

                  <div className="flex items-start gap-3.5">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${category.tile}`}>
                      <category.icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <div>
                      <p className="text-[10.5px] font-semibold tracking-[0.08em] text-[#0B8F68]">
                        {String(index + 1).padStart(2, "0")} · {category.kicker}
                      </p>
                      <h2 className="mt-1 text-[20px] font-bold tracking-tight text-ink-900 sm:text-[22px]">
                        {category.title}
                      </h2>
                      <p className="mt-1.5 text-[12.5px] leading-6 text-ink-500">{category.body}</p>
                    </div>
                  </div>

                  <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {category.points.map((point) => (
                      <li
                        key={point.title}
                        className="flex gap-2 rounded-xl border border-[#edf2ef] bg-white p-3.5"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0BA678]" strokeWidth={2.8} />
                        <div>
                          <p className="text-[12px] font-semibold text-ink-800">{point.title}</p>
                          <p className="mt-0.5 text-[11px] leading-5 text-ink-500">{point.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats band */}
      <section className="border-y border-[#e8eeeb] bg-[#f7faf9]">
        <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-[26px] font-bold tracking-tight text-[#0B7A5B]">{stat.value}</p>
              <p className="mt-1 text-[11.5px] leading-5 text-ink-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7F0] px-2.5 py-1 text-[10.5px] font-semibold text-[#0B7A5B]">
            প্রশ্নোত্তর
          </span>
          <h2 className="mt-3 text-[26px] font-bold tracking-tight text-ink-900 sm:text-[30px]">
            সাধারণ প্রশ্ন
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-ink-500">
            ফিচার নিয়ে যা সবচেয়ে বেশি জিজ্ঞাসা করা হয়।
          </p>
        </div>

        <div className="mt-7 grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-[#e7eeea] bg-white px-4 py-3.5 open:bg-[#fbfdfc]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12.5px] font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-400 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-[11.5px] leading-6 text-ink-500">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
        <div className="overflow-hidden rounded-[24px] border border-[#d8ede4] bg-gradient-to-br from-[#eefaf5] via-[#f7fdfb] to-white px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl space-y-2">
              <h2 className="text-[22px] font-bold tracking-tight text-ink-900 sm:text-[26px]">
                আপনার ব্যবসার জন্য কোনটা দরকার?
              </h2>
              <p className="text-[12.5px] leading-6 text-ink-500">
                ফ্রি প্ল্যানে শুরু করুন — বাড়লে যেকোনো সময় প্ল্যান বদলান।
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/signup" className={primaryButton}>
                ফ্রি শুরু করুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className={secondaryButton}>
                প্ল্যান দেখুন
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
