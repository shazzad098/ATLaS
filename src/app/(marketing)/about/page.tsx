import Link from "next/link";
import { ArrowRight, Heart, ShieldCheck, Sparkles, Target, Users } from "lucide-react";

/** About ATLaS page (PRD §4.1). */

export const metadata = {
  title: "আমাদের সম্পর্কে — ATLaS",
  description: "ATLaS বাংলাদেশের ক্ষুদ্র ও মাঝারি ব্যবসার জন্য তৈরি। জানুন কীভাবে আমরা Facebook/WhatsApp-নির্ভর ব্যবসাকে branded online store-এ রূপান্তরিত করতে সাহায্য করছি।",
};

const VALUES = [
  {
    icon: Target,
    title: "বাংলাদেশ-ফার্স্ট",
    body: "বিকাশ, নগদ, COD, কুরিয়ার — বাংলাদেশের payment ও delivery workflow সম্পূর্ণভাবে built-in। Global platform-এর মতো workaround নয়।",
    color: "bg-[#E8F1FF] text-[#2563EB]",
  },
  {
    icon: Sparkles,
    title: "Code ছাড়াই",
    body: "Technical knowledge ছাড়াই professional online store। Theme selection, product upload, order management — সব কিছু সহজ ও সরল।",
    color: "bg-[#F1EBFF] text-[#7C3AED]",
  },
  {
    icon: ShieldCheck,
    title: "নিরাপদ ও স্বচ্ছ",
    body: "Gateway secret encrypted, tenant isolation, immutable fee ledger। প্রতিটি পরিবর্তন audit log-এ সংরক্ষিত। কোনো লুকানো চার্জ নেই।",
    color: "bg-[#E7F7F0] text-[#0B8F68]",
  },
  {
    icon: Heart,
    title: "Merchant-এর সাফল্য",
    body: "শুধু platform নয় — merchant-এর প্রথম real order, COD reconciliation ও week-8 retention আমাদের success metric।",
    color: "bg-[#FFF3E2] text-[#D97706]",
  },
];

const TEAM_ROLES = [
  "Product Manager / Founder",
  "Tech Lead",
  "Full-stack Engineers",
  "Frontend / Theme Engineer",
  "QA Engineer",
  "UI/UX Designer",
  "DevOps",
  "Support / Operations",
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-[#e8eeeb] bg-gradient-to-b from-[#f0faf6] to-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#c3e9d8] bg-[#e7f7f0] px-3 py-1 text-[12px] font-semibold text-[#0b7a5b]">
            আমাদের সম্পর্কে
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl lg:text-5xl">
            বাংলাদেশের উদ্যোক্তাদের জন্য
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-600">
            ATLaS হলো Bangladesh-এর ছোট ও মাঝারি ব্যবসার জন্য একটি multi-tenant SaaS e-commerce platform।
            আমাদের লক্ষ্য: Facebook/WhatsApp-নির্ভর ব্যবসাকে branded, professional online store-এ
            রূপান্তরিত করা — COD, বিকাশ/নগদ, courier ও reconciliation সহ।
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold text-ink-900 sm:text-3xl">আমাদের promise</h2>
              <blockquote className="mt-5 border-l-4 border-[#0BA678] pl-5">
                <p className="text-xl font-medium italic text-ink-700">
                  "আপনার ব্যবসার জন্য professional online store — code ছাড়াই, Bangladesh-এর payment ও
                  delivery workflow সহ।"
                </p>
              </blockquote>
              <p className="mt-6 text-[15px] leading-7 text-ink-600">
                আমরা বিশ্বাস করি প্রযুক্তি সবার জন্য হওয়া উচিত। Dhaka-র boutique থেকে শুরু করে গ্রামের
                কারিগর পর্যন্ত — প্রত্যেক উদ্যোক্তার নিজের branded online store থাকার অধিকার আছে।
              </p>
              <p className="mt-4 text-[15px] leading-7 text-ink-600">
                আমাদের platform Bangladesh-এর বাস্তবতা বুঝে: COD-heavy market, WhatsApp-নির্ভর customer
                communication, কুরিয়ার return complexity আর MFS payment reconciliation।
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {VALUES.map((value) => {
                const Icon = value.icon;
                return (
                  <div key={value.title} className="rounded-xl border border-[#e8eeeb] bg-white p-5 shadow-[0_1px_3px_rgba(13,42,32,0.04)]">
                    <div className={`mb-3 inline-flex rounded-lg ${value.color} p-2.5`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-ink-900">{value.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-5.5 text-ink-500">{value.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Goals */}
      <section className="border-t border-[#e8eeeb] bg-[#f7faf9] py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-ink-900">আমাদের লক্ষ্য</h2>
            <p className="mt-2 text-[14px] text-ink-500">প্রথম ১২ মাসের জন্য</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e8eeeb] bg-white p-6 text-center shadow-[0_1px_3px_rgba(13,42,32,0.04)]">
              <p className="text-4xl font-bold text-[#0BA678]">১০০+</p>
              <p className="mt-2 text-[14px] font-medium text-ink-700">Active Stores</p>
              <p className="mt-1 text-[12px] text-ink-500">প্রথম বছরে</p>
            </div>
            <div className="rounded-xl border border-[#e8eeeb] bg-white p-6 text-center shadow-[0_1px_3px_rgba(13,42,32,0.04)]">
              <p className="text-4xl font-bold text-[#0BA678]">১০K+</p>
              <p className="mt-2 text-[14px] font-medium text-ink-700">Registered Users</p>
              <p className="mt-1 text-[12px] text-ink-500">Merchant ও Shopper</p>
            </div>
            <div className="rounded-xl border border-[#e8eeeb] bg-white p-6 text-center shadow-[0_1px_3px_rgba(13,42,32,0.04)]">
              <p className="text-4xl font-bold text-[#0BA678]">৳৫L+</p>
              <p className="mt-2 text-[14px] font-medium text-ink-700">Monthly GMV</p>
              <p className="mt-1 text-[12px] text-ink-500">প্ল্যাটফর্ম জিএমভি লক্ষ্য</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 className="text-2xl font-bold text-ink-900">টিম</h2>
              <p className="mt-4 text-[15px] leading-7 text-ink-600">
                ATLaS একটি focused founding team তৈরি করেছে যারা Bangladesh-এর e-commerce বাস্তবতা
                বোঝেন। Product থেকে DevOps পর্যন্ত প্রতিটি role-এ dedicated focus।
              </p>
              <ul className="mt-5 space-y-2">
                {TEAM_ROLES.map((role) => (
                  <li key={role} className="flex items-center gap-2.5 text-[14px] text-ink-700">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0BA678]" />
                    {role}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-[#c3e9d8] bg-[#e7f7f0] p-8">
              <Users className="mb-4 h-8 w-8 text-[#0B7A5B]" />
              <h3 className="text-lg font-bold text-ink-900">আমাদের সাথে যোগ দিন</h3>
              <p className="mt-2 text-[14px] leading-6 text-ink-600">
                আমরা Bangladesh-এর e-commerce ecosystem গড়তে passionate builder খুঁজছি। যদি আপনি
                merchant-এর সমস্যা সমাধানে আগ্রহী হন, আমাদের সাথে কথা বলুন।
              </p>
              <Link
                href="/contact"
                className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
              >
                যোগাযোগ করুন <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#e8eeeb] bg-gradient-to-b from-[#f7faf9] to-white py-14">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-ink-900">আমাদের mission-এ যুক্ত হন</h2>
          <p className="mx-auto mt-3 max-w-lg text-[14px] text-ink-500">
            আপনার দোকান দিয়ে Bangladesh-এর digital commerce revolution-এর অংশ হন।
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-6 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
            >
              ফ্রিতে শুরু করুন <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-6 py-3 text-[13px] font-semibold text-ink-800 shadow-[0_1px_2px_rgba(13,42,32,0.04)] transition hover:bg-[#f4f8f6]"
            >
              যোগাযোগ করুন
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
