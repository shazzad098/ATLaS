import Link from "next/link";
import { getAvailableDemoStoreSlugs } from "@/lib/demo-stores";
import { CreditCard, Package, Store, Truck, Users, Wallet, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/shell";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { PLAN_CODES, PLAN_DEFINITIONS, formatLimit, formatRate } from "@/lib/plans";
import { getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/messages";

/** Public landing page (PRD §3). Long-form prose lives with its page. */

export const dynamic = "force-dynamic";

type Feature = { icon: LucideIcon; title: string; body: string };

const COPY = {
  bn: {
    meta: {
      title: "ATLaS — বাংলাদেশের অনলাইন দোকান এক জায়গায়",
      description:
        "ঘণ্টার মধ্যে নিজের দোকান দাঁড় করান — সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট সহ।",
    },
    hero: {
      titleLead: "আপনার অনলাইন দোকান,",
      titleAccent: "এক জায়গায়",
      body: "সাবডোমেইন, থিম, প্রোডাক্ট, অর্ডার, ডেলিভারি চার্জ আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট, সব এক ড্যাশবোর্ডে। কোড লিখতে হবে না, ডিজাইনও দরকার নেই।",
      primary: "ফ্রি শুরু করুন",
      secondary: "ডেমো দোকান দেখুন",
      note: "ফ্রি plan-এ ২৫টি প্রোডাক্ট ও ক্যাশ অন ডেলিভারি, শুরু করতে টাকা লাগে না।",
    },
    themeCard: {
      title: "একই ডেটা, তিন রকম দোকান",
      body: "থিম বদলালেও প্রোডাক্ট, অর্ডার আর কাস্টমার একই থাকে, শুধু দেখতে বদলায়।",
    },
    features: {
      eyebrow: "প্ল্যাটফর্ম",
      title: "যা যা আছে",
      description: "দোকান খোলা থেকে অর্ডার ডেলিভারি পর্যন্ত প্রতিদিনের কাজগুলো এক প্ল্যাটফর্মে।",
      items: [
        {
          title: "নিজের ঠিকানা",
          body: "প্রতিটি দোকান পায় subdomain (যেমন nokshi.atlas.app)। Standard plan-এ নিজের ডোমেইনও জুড়ে দিতে পারবেন।",
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
          body: "প্রতিটি অর্ডারের status, stock movement, রিটার্ন আর COD কালেকশন — সব একসাথে দেখা যায়।",
        },
        {
          title: "টিম ও রিপোর্ট",
          body: "Role অনুযায়ী স্টাফ যোগ করুন। বিক্রি, কমিশন আর ওভারেজ — সব রিপোর্টে স্পষ্ট।",
        },
        {
          title: "কুপন ও ডিসকাউন্ট",
          body: "প্রোডাক্ট, অর্ডার বা ইউজার-লেভেল কুপন, সর্বনিম্ন অর্ডার শর্ত সহ। রিপোর্টে ডিসকাউন্ট-সমন্বিত হিসাব।",
        },
      ],
    },
    payments: {
      eyebrow: "পেমেন্ট ও ডেলিভারি",
      title: "দেশের পেমেন্ট আর ডেলিভারি, এক checkout-এ",
      description:
        "ক্রেতা যেভাবে টাকা দিতে চান, সেভাবেই নিন। ডেলিভারি নিজের লোক দিয়ে হোক বা কুরিয়ারে, চার্জ আর ট্র্যাকিং একই পর্দায়।",
      courierLabel: "কুরিয়ার সংযোগ:",
      courierNote: "তৃতীয় পক্ষের কুরিয়ারে আলাদা ০.৫% ফি, প্ল্যাটফর্ম কমিশনের সাথে দ্বিগুণ হয় না",
      codName: "ক্যাশ অন ডেলিভারি",
      codNote: "প্রথম দিন থেকেই চালু",
      inHouse: "নিজের ডেলিভারি",
    },
    demo: {
      eyebrow: "ডেমো",
      title: "একই প্ল্যাটফর্ম, দুই রকম দোকান",
      description:
        "ডেমো স্টোরগুলো আসল ডেটা দিয়ে চলে, প্রোডাক্ট, স্টক, কুপন আর অর্ডারসহ। সরাসরি ঢুকে checkout পর্যন্ত দেখতে পারেন।",
      all: "সব থিম",
      viewStore: "দোকান দেখুন",
      viewProducts: "প্রোডাক্ট তালিকা",
      themeSuffix: "theme",
      live: "Live demo",
    },
    steps: {
      eyebrow: "শুরু করুন",
      title: "তিন ধাপে দোকান live",
      description: "সাইনআপ থেকে publish, মিনিটে খুলে যাবে দোকান।",
      items: [
        { title: "মোবাইল নম্বর দিয়ে সাইনআপ", body: "OTP বা পাসওয়ার্ড, যেটা সহজ। কোনো কার্ড লাগবে না।" },
        { title: "থিম বেছে দোকান সাজান", body: "নাম, থিম আর প্রথম প্রোডাক্ট যোগ করলেই দোকান তৈরি।" },
        { title: "Publish করে অর্ডার নিন", body: "চেকলিস্ট শেষ হলেই দোকান live, অর্ডার আসবে অ্যাডমিনে।" },
      ],
    },
    gallery: {
      eyebrow: "ডিজাইন",
      title: "থিম গ্যালারি",
      description: "যে ব্যবসা, সেই ডিজাইন, যেকোনো সময় বদলাতে পারবেন।",
      all: "সব থিম দেখুন",
    },
    plans: {
      eyebrow: "প্রাইসিং",
      title: "প্ল্যান",
      description: "ফ্রি plan-এ শুরু করুন। ৫০টি অর্ডারের পরে সামান্য কমিশন, তারপর যত বাড়বেন তত কম খরচ।",
      popular: "সবচেয়ে জনপ্রিয়",
      custom: "কাস্টম",
      perMonth: " /মাস",
      products: "প্রোডাক্ট",
      orders: "মাসিক অর্ডার",
      seats: "স্টাফ seat",
      overage: "ওভারেজ",
      ctaFree: "ফ্রি শুরু করুন",
      ctaPlan: "বিস্তারিত দেখুন",
    },
    testimonials: {
      eyebrow: "অভিজ্ঞতা",
      title: "ডেমো স্টোরের গল্প",
      description: "এই দোকানগুলো প্ল্যাটফর্মেই চলে, নিচের অভিজ্ঞতাগুলো সেই ডেমো ডেটা থেকেই নেওয়া।",
      see: "দেখুন",
      items: [
        {
          quote:
            "আগে শাড়ির অর্ডার নিতাম মেসেজে, ঠিকানা লিখে রাখতাম খাতায়। এখন প্রতিটি অর্ডার নিজের স্ট্যাটাস নিয়ে আসে, কোনটা পাঠানো হয়েছে, কোনটা COD-এ টাকা নেওয়া বাকি, সব এক জায়গায়।",
          name: "নাসরিন আক্তার",
          role: "নকশি বুটিক, ডেমো স্টোর",
        },
        {
          quote:
            "প্রতিদিন ৭০-৮০টি অর্ডার আসে। ডেলিভারি zone আলাদা করে দেওয়ার পর ঢাকার ভিতরে-বাইরের চার্জ আর ম্যানুয়াল হিসাব করতে হয় না।",
          name: "মাহবুব হাসান",
          role: "ঢাকা বাজার, ডেমো স্টোর",
        },
        {
          quote:
            "ঈদের কালেকশনের আগে রাতেই থিম বদলে ব্যানার বসিয়ে দিয়েছি। draft-এ কাজ করেছি, তাই অর্ধেক সাজানো দোকান কেউ দেখেনি।",
          name: "সাদিয়া রহমান",
          role: "কসমেটিক্স ব্র্যান্ড, ডেমো ব্যবহারকারী",
        },
      ],
    },
    faq: {
      eyebrow: "প্রশ্নোত্তর",
      title: "সাধারণ প্রশ্ন",
      moreQuestions: "আরও প্রশ্ন আছে?",
      help: "হেল্প সেন্টার",
      or: "দেখুন বা",
      write: "আমাদের লিখুন",
      items: [
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
      ],
    },
    cta: {
      title: "আজই আপনার দোকান দাঁড় করান",
      body: "মোবাইল নম্বর দিয়েই শুরু, কোনো সেটআপ ফি নেই, কার্ডও লাগবে না।",
      primary: "ফ্রি অ্যাকাউন্ট খুলুন",
      secondary: "প্ল্যান দেখুন",
      note: "কার্ড লাগবে না, ৭ দিনের ট্রায়াল",
      footer:
        "বাংলা ও ইংরেজি, দুটোতেই দোকান চলে। সব মূল্য BDT-তে, সময় Asia/Dhaka অনুযায়ী। প্রশ্ন থাকলে",
      footerLink: "মার্চেন্ট লগইন",
      footerTail: "করে সাপোর্ট টিকিট খুলুন।",
    },
  },
  en: {
    meta: {
      title: "ATLaS — your online store, all in one place",
      description:
        "Stand up your own store within the hour — subdomain, themes, products, orders and bKash/Nagad/SSLCommerz/COD payments.",
    },
    hero: {
      titleLead: "Your online store,",
      titleAccent: "all in one place",
      body: "Subdomain, themes, products, orders, delivery charges and bKash/Nagad/SSLCommerz/COD payments in one dashboard. No code to write, no design work to do.",
      primary: "Start free",
      secondary: "See a demo store",
      note: "The free plan includes 25 products and cash on delivery — no money needed to start.",
    },
    themeCard: {
      title: "One catalogue, three shops",
      body: "Change the theme and the products, orders and customers stay exactly as they are — only the look changes.",
    },
    features: {
      eyebrow: "Platform",
      title: "What you get",
      description: "Everything from opening a shop to delivering an order, on one platform.",
      items: [
        {
          title: "Your own address",
          body: "Every store gets a subdomain (e.g. nokshi.atlas.app). Standard plans can also attach a custom domain.",
        },
        {
          title: "Local payments",
          body: "bKash, Nagad, SSLCommerz and cash on delivery in one checkout — all testable in sandbox.",
        },
        {
          title: "Delivery zones",
          body: "Different charges inside and outside Dhaka, free delivery above a threshold — all yours to set.",
        },
        {
          title: "Orders and stock",
          body: "Order status, stock movements, returns and COD collection — visible together.",
        },
        {
          title: "Team and reports",
          body: "Add staff by role. Sales, commission and overage are clear in every report.",
        },
        {
          title: "Coupons and discounts",
          body: "Product, order or customer-level coupons with a minimum order. Reports account for the discount.",
        },
      ],
    },
    payments: {
      eyebrow: "Payments and delivery",
      title: "Local payments and delivery, in one checkout",
      description:
        "Let shoppers pay the way they already do. Whether delivery is in-house or by courier, charges and tracking sit on the same screen.",
      courierLabel: "Courier integrations:",
      courierNote: "Third-party couriers carry a separate 0.5% fee that does not double up with the platform commission",
      codName: "Cash on delivery",
      codNote: "On from day one",
      inHouse: "In-house delivery",
    },
    demo: {
      eyebrow: "Demo",
      title: "One platform, two very different shops",
      description:
        "The demo stores run on real data — products, stock, coupons and orders. Walk in and follow a checkout end to end.",
      all: "All themes",
      viewStore: "View store",
      viewProducts: "Product list",
      themeSuffix: "theme",
      live: "Live demo",
    },
    steps: {
      eyebrow: "Get started",
      title: "Live in three steps",
      description: "From signup to publish — the shop opens in minutes.",
      items: [
        { title: "Sign up with your mobile number", body: "OTP or password, whichever is easier. No card." },
        { title: "Pick a theme and set the shop up", body: "Add a name, a theme and your first product — that is a store." },
        { title: "Publish and take orders", body: "Finish the checklist and the shop goes live; orders arrive in the admin." },
      ],
    },
    gallery: {
      eyebrow: "Design",
      title: "Theme gallery",
      description: "A design for your business, swappable at any time.",
      all: "Browse all themes",
    },
    plans: {
      eyebrow: "Pricing",
      title: "Plans",
      description: "Start on the free plan. After 50 orders a small commission applies — and it falls as you grow.",
      popular: "Most popular",
      custom: "Custom",
      perMonth: " /mo",
      products: "Products",
      orders: "Orders / month",
      seats: "Staff seats",
      overage: "Overage",
      ctaFree: "Start free",
      ctaPlan: "See details",
    },
    testimonials: {
      eyebrow: "Experience",
      title: "Stories from the demo stores",
      description: "These shops run on the platform itself; the quotes come from that demo data.",
      see: "Visit",
      items: [
        {
          quote:
            "I used to take saree orders in chat and write addresses in a notebook. Now every order arrives with its own status — what shipped, what still needs collecting on delivery — all in one place.",
          name: "Nasrin Akter",
          role: "Nokshi Boutique, demo store",
        },
        {
          quote:
            "Seventy to eighty orders a day. Since we split the delivery zones I no longer work out Dhaka inside and outside charges by hand.",
          name: "Mahbub Hasan",
          role: "Dhaka Bazar, demo store",
        },
        {
          quote:
            "The night before the Eid collection I changed the theme and dropped in a banner. I worked in draft, so nobody saw the half-decorated shop.",
          name: "Sadia Rahman",
          role: "Cosmetics brand, demo user",
        },
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Common questions",
      moreQuestions: "More questions?",
      help: "Help centre",
      or: "or",
      write: "write to us",
      items: [
        {
          q: "Do I need a card or an advance payment to start?",
          a: "No. The free plan carries 25 products and 50 orders a month with no fee. Paid plans start with a 7-day trial, no card required.",
        },
        {
          q: "How do I take payments?",
          a: "Cash on delivery is on by default. Connect bKash, Nagad or SSLCommerz and shoppers see them at checkout. The whole flow can be tested in sandbox mode.",
        },
        {
          q: "Can I add my own domain?",
          a: "Yes on Standard and Pro. Add the TXT and CNAME records and it is verified and activated; Pro runs a custom domain and a subdomain together.",
        },
        {
          q: "What is the platform fee?",
          a: "Each plan includes a fixed number of fee-free orders. Beyond that a commission of 0% to 2.5% applies to the discount-adjusted merchandise value — lower on higher plans.",
        },
        {
          q: "If I change the theme, do I lose products or orders?",
          a: "No. The theme only changes appearance. Products, categories, orders and customers stay exactly as they are.",
        },
        {
          q: "If I downgrade, is my data deleted?",
          a: "No. A downgrade only stops you creating new records beyond the quota; existing data stays readable, editable and exportable to CSV.",
        },
      ],
    },
    cta: {
      title: "Stand your shop up today",
      body: "Start with a mobile number — no setup fee, no card.",
      primary: "Create a free account",
      secondary: "See the plans",
      note: "No card, 7-day trial",
      footer:
        "The shop runs in Bangla and English. All prices are in BDT and times follow Asia/Dhaka. If anything is unclear,",
      footerLink: "log in as a merchant",
      footerTail: "and open a support ticket.",
    },
  },
} as const;

const FEATURE_ICONS: LucideIcon[] = [Store, Wallet, Truck, Package, Users, CreditCard];

const DEMO_STORES = [
  {
    slug: "nokshi-demo",
    theme: "Nokshi",
    gradient: "from-rose-100 via-amber-50 to-orange-100",
    bn: {
      name: "নকশি বুটিক",
      body: "হাতে বোনা শাড়ি, কুর্তি ও ওড়না, বড় ছবি, উষ্ণ রঙ, ফ্যাশনের জন্য সাজানো হোমপেজ।",
    },
    en: {
      name: "Nokshi Boutique",
      body: "Hand-woven sarees, kurtis and scarves — big imagery, warm colours, a home page built for fashion.",
    },
  },
  {
    slug: "dhaka-bazar",
    theme: "Bazar",
    gradient: "from-emerald-100 via-lime-50 to-teal-100",
    bn: {
      name: "ঢাকা বাজার",
      body: "টাটকা সবজি, ফল, মাছ ও মুদি, ঘন প্রোডাক্ট গ্রিড আর ক্যাটাগরি-ফার্স্ট লেআউট।",
    },
    en: {
      name: "Dhaka Bazar",
      body: "Fresh vegetables, fruit, fish and groceries — a dense product grid and a category-first layout.",
    },
  },
] as const;

const TESTIMONIAL_LINKS = ["/store/nokshi-demo", "/store/dhaka-bazar", "/themes"];

const PAYMENT_LOGOS = [
  { image: "/images/payments/bkash_logo.png", bn: "বিকাশ", en: "bKash" },
  { image: "/images/payments/Nagad_Logo.png", bn: "নগদ", en: "Nagad" },
  { image: "/images/payments/sslcommerz_logo.png", bn: "SSLCommerz", en: "SSLCommerz" },
  { image: "/images/payments/cod.svg", bn: "ক্যাশ অন ডেলিভারি", en: "Cash on delivery" },
];

const PAYMENT_NOTES = {
  bn: ["সবচেয়ে বেশি ব্যবহৃত মোবাইল ওয়ালেট", "দ্রুত সেটেলমেন্ট, সহজ রিফান্ড", "কার্ড, ব্যাংক ও ওয়ালেট একসাথে"],
  en: [
    "The most widely used mobile wallet",
    "Fast settlement, easy refunds",
    "Cards, banks and wallets together",
  ],
};

const COURIERS = ["Pathao", "Steadfast", "RedX", "Paperfly"];

/** English blurbs for plan descriptions (the plan matrix itself is data). */
const PLAN_BLURB_EN: Record<string, string> = {
  free: "Your first shop: 25 products, 50 orders a month, cash on delivery and a free subdomain.",
  basic: "A growing catalogue: 250 products, 500 orders, 1 GB storage and more themes.",
  standard: "A serious business: 1,000 products, 2,000 orders, your own domain and staff seats.",
  pro: "No ceilings: unlimited products and orders, priority support and the full theme set.",
};

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

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

export default async function LandingPage() {
  const locale: Locale = await getLocale();
  const t = COPY[locale];
  const demoSlugs = await getAvailableDemoStoreSlugs();
  const demoStores = DEMO_STORES.filter((store) => demoSlugs.has(store.slug));
  const hasNokshiDemo = demoSlugs.has("nokshi-demo");
  const testimonials = t.testimonials.items.filter((_item, index) => {
    const match = /^\/store\/([^/]+)/.exec(TESTIMONIAL_LINKS[index]);
    return !match || demoSlugs.has(match[1]);
  });
  const plans = PLAN_CODES.map((code) => PLAN_DEFINITIONS[code]);
  const paymentNotes = PAYMENT_NOTES[locale];

  const features: Feature[] = t.features.items.map((item, index) => ({
    ...item,
    icon: FEATURE_ICONS[index],
  }));

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
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-ink-900 sm:text-[44px]">
              {t.hero.titleLead}
              <span className="relative inline-block text-brand-700">
                {" "}
                {t.hero.titleAccent}
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
            <p className="max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">{t.hero.body}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink href="/signup" size="lg">
                {t.hero.primary}
              </ButtonLink>
              {hasNokshiDemo ? (
                <ButtonLink href="/store/nokshi-demo" variant="outline" size="lg">
                  {t.hero.secondary}
                </ButtonLink>
              ) : null}
            </div>
            <p className="text-xs text-ink-500">{t.hero.note}</p>
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
                <p className="text-sm font-semibold text-ink-900">{t.themeCard.title}</p>
                <p className="text-xs leading-relaxed text-ink-500">{t.themeCard.body}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PAYMENT_LOGOS.map((method) => (
                    <Badge key={method.image} tone="neutral">
                      {method[locale === "en" ? "en" : "bn"]}
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
            eyebrow={t.features.eyebrow}
            title={t.features.title}
            description={t.features.description}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
            <FeatureCell {...features[0]} className="border-brand-200 bg-brand-50/60 lg:col-span-7" />
            <FeatureCell {...features[1]} className="border-ink-200 bg-white lg:col-span-5" />
            <FeatureCell {...features[2]} className="border-ink-200 bg-white lg:col-span-5" />
            <FeatureCell {...features[3]} className="border-ink-200 bg-white lg:col-span-7" />
            <FeatureCell {...features[4]} className="border-ink-200 bg-white lg:col-span-6" />
            <FeatureCell {...features[5]} className="border-ink-200 bg-white lg:col-span-6" />
          </div>
        </div>
      </section>

      {/* Payments & Delivery */}
      <section className="border-y border-ink-200 bg-ink-50/60">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:py-16">
          <SectionHeading
            eyebrow={t.payments.eyebrow}
            title={t.payments.title}
            description={t.payments.description}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_LOGOS.map((method, index) => {
              const name = method[locale === "en" ? "en" : "bn"];
              const note = index === 3 ? t.payments.codNote : paymentNotes[index];
              return (
                <div
                  key={method.image}
                  className="rounded-xl border border-ink-200 bg-white p-5 transition hover:border-ink-300 hover:shadow-sm"
                >
                  <img src={method.image} alt={name} className="h-10 w-20 object-contain" />
                  <p className="mt-3 text-sm font-semibold text-ink-900">{name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">{note}</p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink-700">{t.payments.courierLabel}</span>
            {[...COURIERS, t.payments.inHouse].map((courier) => (
              <span
                key={courier}
                className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600"
              >
                {courier}
              </span>
            ))}
            <p className="ml-auto text-[11px] text-ink-500">{t.payments.courierNote}</p>
          </div>
        </div>
      </section>

      {/* Demo Stores (only when the seeded fixtures exist) */}
      {demoStores.length > 0 ? (
        <section className="mx-auto max-w-6xl space-y-8 px-4 py-14 sm:py-16">
          <SectionHeading
            eyebrow={t.demo.eyebrow}
            title={t.demo.title}
            description={t.demo.description}
            action={
              <ButtonLink href="/themes" variant="outline">
                {t.demo.all}
              </ButtonLink>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {demoStores.map((store) => {
              const copy = store[locale === "en" ? "en" : "bn"];
              return (
                <div
                  key={store.slug}
                  className="group overflow-hidden rounded-2xl border border-ink-200 bg-white transition hover:border-brand-300 hover:shadow-md"
                >
                  <div className={`relative h-36 bg-gradient-to-br ${store.gradient}`}>
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                      <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-ink-800 backdrop-blur">
                        {store.theme} {t.demo.themeSuffix}
                      </span>
                      <span className="rounded-full bg-ink-900/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                        {t.demo.live}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 p-5">
                    <p className="text-base font-semibold text-ink-900">{copy.name}</p>
                    <p className="text-sm leading-relaxed text-ink-600">{copy.body}</p>
                    <div className="flex flex-wrap gap-4 pt-1 text-sm font-medium">
                      <Link href={`/store/${store.slug}`} className="text-brand-700 hover:underline">
                        {t.demo.viewStore}
                      </Link>
                      <Link
                        href={`/store/${store.slug}/shop`}
                        className="text-ink-500 transition hover:text-ink-900"
                      >
                        {t.demo.viewProducts}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* How to start */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 pb-14 sm:pb-16">
        <SectionHeading
          eyebrow={t.steps.eyebrow}
          title={t.steps.title}
          description={t.steps.description}
        />
        <ol className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {t.steps.items.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                {index < t.steps.items.length - 1 ? (
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
            eyebrow={t.gallery.eyebrow}
            title={t.gallery.title}
            description={t.gallery.description}
            action={
              <ButtonLink href="/themes" variant="outline">
                {t.gallery.all}
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
            eyebrow={t.plans.eyebrow}
            title={t.plans.title}
            description={t.plans.description}
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
                    {t.plans.popular}
                  </span>
                ) : null}
                <p className="text-sm font-semibold text-ink-500">{plan.name}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-ink-900">
                  {plan.monthlyPriceBdt === null
                    ? t.plans.custom
                    : plan.monthlyPriceBdt === 0
                      ? "৳0"
                      : `৳${plan.monthlyPriceBdt.toLocaleString("en-US")}`}
                  {plan.monthlyPriceBdt === 0 ? (
                    <span className="text-xs font-normal text-ink-500">{t.plans.perMonth}</span>
                  ) : null}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">
                  {locale === "en" ? (PLAN_BLURB_EN[plan.code] ?? plan.description) : plan.description}
                </p>
                <ul className="mt-5 space-y-2 border-t border-ink-100 pt-5 text-sm text-ink-600">
                  <li>
                    {t.plans.products}:{" "}
                    <span className="font-semibold text-ink-900">{formatLimit(plan.$limits.products)}</span>
                  </li>
                  <li>
                    {t.plans.orders}:{" "}
                    <span className="font-semibold text-ink-900">{formatLimit(plan.$limits.monthlyOrders)}</span>
                  </li>
                  <li>
                    {t.plans.seats}:{" "}
                    <span className="font-semibold text-ink-900">{formatLimit(plan.$limits.staffSeats)}</span>
                  </li>
                  <li>
                    {t.plans.overage}:{" "}
                    <span className="font-semibold text-ink-900">{formatRate(plan.$limits.overageRate)}</span>
                  </li>
                </ul>
                <div className="mt-auto pt-6">
                  <ButtonLink
                    href={plan.code === "free" ? "/signup" : "/pricing"}
                    variant={plan.code === "standard" ? "primary" : "outline"}
                    className="w-full"
                  >
                    {plan.code === "free" ? t.plans.ctaFree : t.plans.ctaPlan}
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
          eyebrow={t.testimonials.eyebrow}
          title={t.testimonials.title}
          description={t.testimonials.description}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <figure key={item.name} className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-6">
              <span aria-hidden="true" className="font-serif text-4xl leading-none text-brand-300">
                “
              </span>
              <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">{item.quote}</blockquote>
              <figcaption className="mt-4 border-t border-ink-100 pt-4">
                <p className="text-sm font-semibold text-ink-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-ink-500">{item.role}</p>
                <Link
                  href={TESTIMONIAL_LINKS[index]}
                  className="mt-1.5 inline-block text-xs font-medium text-brand-700 hover:underline"
                >
                  {t.testimonials.see}
                </Link>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl space-y-8 px-4 pb-14 sm:pb-16">
        <SectionHeading align="center" eyebrow={t.faq.eyebrow} title={t.faq.title} />
        <div className="space-y-2">
          {t.faq.items.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-ink-200 bg-white px-5 py-4 transition-colors open:bg-ink-50/60"
            >
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
          {t.faq.moreQuestions}{" "}
          <Link href="/help" className="font-medium text-brand-700 hover:underline">
            {t.faq.help}
          </Link>{" "}
          {t.faq.or}{" "}
          <Link href="/contact" className="font-medium text-brand-700 hover:underline">
            {t.faq.write}
          </Link>
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
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t.cta.title}</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-300">{t.cta.body}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/signup" size="lg" variant="inverse">
                {t.cta.primary}
              </ButtonLink>
              <ButtonLink href="/pricing" size="lg" variant="inverse-outline">
                {t.cta.secondary}
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-400">{t.cta.note}</p>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-relaxed text-ink-500">
          {t.cta.footer}{" "}
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            {t.cta.footerLink}
          </Link>{" "}
          {t.cta.footerTail}
        </p>
      </section>
    </div>
  );
}
