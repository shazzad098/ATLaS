import Link from "next/link";
import { ArrowRight, BookOpen, CreditCard, LayoutTemplate, Package, Settings, ShoppingBag, Truck, Users } from "lucide-react";

/** Help center index page (PRD §4.1). */

export const metadata = {
  title: "Help Center — ATLaS",
  description: "ATLaS ব্যবহারের সম্পূর্ণ গাইড। Account থেকে শুরু করে payment, courier, theme ও billing — সব বিষয়ে সাহায্য পান।",
};

const CATEGORIES = [
  {
    icon: BookOpen,
    title: "শুরু করা",
    description: "Account, store তৈরি, subdomain ও প্রথম product",
    color: "bg-[#E8F1FF] text-[#2563EB]",
    articles: [
      "কীভাবে account তৈরি করবেন",
      "Store slug বেছে নেওয়া",
      "Onboarding checklist সম্পূর্ণ করা",
      "প্রথম product যোগ করা",
      "Store publish করা",
    ],
  },
  {
    icon: LayoutTemplate,
    title: "Theme ও Design",
    description: "Theme selection, settings ও publish",
    color: "bg-[#F1EBFF] text-[#7C3AED]",
    articles: [
      "Theme বেছে নেওয়ার নিয়ম",
      "Theme settings কাস্টমাইজ করা",
      "Homepage sections সাজানো",
      "Logo ও favicon সেট করা",
      "Basic plan-এ theme lock কী",
    ],
  },
  {
    icon: Package,
    title: "Product ও Inventory",
    description: "Product, variant, stock ও CSV import",
    color: "bg-[#E7F7F0] text-[#0B8F68]",
    articles: [
      "Product তৈরি ও ভেরিয়েন্ট যোগ করা",
      "Stock ম্যানেজমেন্ট",
      "CSV দিয়ে bulk import",
      "SEO metadata সেট করা",
      "Low stock alert কনফিগার করা",
    ],
  },
  {
    icon: ShoppingBag,
    title: "Order ম্যানেজমেন্ট",
    description: "Order status, refund ও return",
    color: "bg-[#FFF3E2] text-[#D97706]",
    articles: [
      "Order status কী কী আছে",
      "COD order confirm করার নিয়ম",
      "Refund request প্রক্রিয়া",
      "Return ম্যানেজমেন্ট",
      "Order invoice download করা",
    ],
  },
  {
    icon: CreditCard,
    title: "Payment ও বিলিং",
    description: "Gateway, subscription, invoice ও fee",
    color: "bg-[#FFF1F2] text-[#E11D48]",
    articles: [
      "বিকাশ gateway কানেক্ট করা",
      "নগদ payment সেট করা",
      "SSLCommerz কনফিগার করা",
      "Subscription upgrade করা",
      "Invoice ও fee ledger বোঝা",
    ],
  },
  {
    icon: Truck,
    title: "Delivery ও Courier",
    description: "Zone, courier API ও COD reconciliation",
    color: "bg-[#F0FDF4] text-[#16A34A]",
    articles: [
      "Delivery zone ও charge সেট করা",
      "RedX courier কানেক্ট করা",
      "COD cash reconciliation",
      "Return ও failed delivery handling",
      "Courier status tracking",
    ],
  },
  {
    icon: Users,
    title: "Customer ও Discount",
    description: "Customer management ও coupon",
    color: "bg-[#FFF7ED] text-[#EA580C]",
    articles: [
      "Customer profile দেখা",
      "Customer segment কী",
      "Blacklist কীভাবে করবেন",
      "Coupon কোড তৈরি করা",
      "Discount campaign সেটআপ",
    ],
  },
  {
    icon: Settings,
    title: "Settings ও Domain",
    description: "Business profile, custom domain ও API",
    color: "bg-[#F8FAFC] text-[#475569]",
    articles: [
      "Business profile আপডেট করা",
      "Custom domain কানেক্ট করা",
      "DNS verification প্রক্রিয়া",
      "Staff ও role ম্যানেজমেন্ট",
      "API key তৈরি করা",
    ],
  },
];

const POPULAR_QUESTIONS = [
  {
    q: "আমার দোকান publish হচ্ছে না — কী করব?",
    a: "Onboarding checklist সম্পূর্ণ হয়েছে কিনা দেখুন। অন্তত একটি product, একটি delivery zone ও একটি payment method থাকতে হবে। Store settings-এ সব তথ্য দিন।",
  },
  {
    q: "Free plan-এ কতটি product যোগ করা যাবে?",
    a: "Free plan-এ ২৫টি product যোগ করা যাবে। এরপর নতুন product create বা import block হবে। Upgrade করলে সাথে সাথে quota বাড়বে।",
  },
  {
    q: "Payment callback কাজ করছে না — কেন?",
    a: "Sandbox mode-এ থাকলে demo gateway ব্যবহার করুন। Production-এ gateway-এর Webhook URL ঠিকমতো দেওয়া হয়েছে কিনা যাচাই করুন। Payment-এ secret key encrypted থাকে।",
  },
  {
    q: "COD order-এর fee কখন charge হয়?",
    a: "Merchant-confirmed COD order-এ fee eligible হয়। Cancelled বা fully refunded order-এ fee void হয়। Fee = discount-adjusted merchandise subtotal, delivery ও refunded items বাদে।",
  },
  {
    q: "Subscription grace period-এ কী হয়?",
    a: "Payment failure-এ 7-day grace period মিলবে। এই সময়ে store চালু থাকবে, owner-কে alert যাবে। Grace period-এর পরে store read-only হয় ও পরে suspend হতে পারে। Data delete হয় না।",
  },
];

export default function HelpPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-[#e8eeeb] bg-gradient-to-b from-[#f0faf6] to-white py-14 sm:py-16">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Help Center
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-ink-600">
            ATLaS ব্যবহারের সব প্রশ্নের উত্তর এখানে। বিষয় বেছে নিন বা সাধারণ প্রশ্নোত্তর দেখুন।
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
            >
              Support টিম-এর সাথে কথা বলুন <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:bg-[#f4f8f6]"
            >
              কীভাবে কাজ করে দেখুন
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <h2 className="mb-8 text-xl font-bold text-ink-900">বিষয় অনুযায়ী সাহায্য</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.title}
                  className="rounded-xl border border-[#e8eeeb] bg-white p-5 shadow-[0_1px_3px_rgba(13,42,32,0.04)] transition hover:border-[#c3e9d8] hover:shadow-md"
                >
                  <div className={`mb-3 inline-flex rounded-lg ${cat.color} p-2.5`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-ink-900">{cat.title}</h3>
                  <p className="mt-1 text-[12.5px] text-ink-500">{cat.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {cat.articles.map((article) => (
                      <li key={article}>
                        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-[#0BA678]" />
                          {article}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Questions */}
      <section className="border-t border-[#e8eeeb] bg-[#f7faf9] py-14 sm:py-16">
        <div className="mx-auto max-w-[860px] px-4 sm:px-6">
          <h2 className="mb-8 text-xl font-bold text-ink-900">সাধারণ প্রশ্নোত্তর</h2>
          <div className="space-y-3">
            {POPULAR_QUESTIONS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-[#e2ebe6] bg-white px-5 py-4 shadow-[0_1px_3px_rgba(13,42,32,0.04)]"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[14px] font-semibold text-ink-800 marker:content-none">
                  {faq.q}
                  <span className="shrink-0 text-[#0B7A5B] transition-transform group-open:rotate-180">▼</span>
                </summary>
                <p className="mt-3 text-[13.5px] leading-6 text-ink-600">{faq.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-[#c3e9d8] bg-[#e7f7f0] p-6">
            <p className="text-[14px] font-semibold text-ink-800">প্রশ্নের উত্তর পাননি?</p>
            <p className="mt-1.5 text-[13px] text-ink-600">
              আমাদের support team সাহায্য করতে প্রস্তুত। Merchant হলে admin panel-এর Support পেজ
              থেকে টিকেট খুলুন — দ্রুত সাড়া পাবেন।
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#099569]"
              >
                Support-এ যোগাযোগ করুন <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#9ED8C1] bg-white px-4 py-2 text-[13px] font-semibold text-ink-700 transition hover:bg-[#f0faf6]"
              >
                Getting Started Guide
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
