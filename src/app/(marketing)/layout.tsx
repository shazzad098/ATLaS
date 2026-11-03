import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";

/** Marketing chrome for the public site. */

const FOOTER_GROUPS = [
  {
    title: "শুরু করুন",
    links: [
      { href: "/signup", label: "ফ্রি অ্যাকাউন্ট" },
      { href: "/pricing", label: "প্ল্যান ও প্রাইসিং" },
      { href: "/themes", label: "থিম গ্যালারি" },
      { href: "/how-it-works", label: "শুরুর ছয় ধাপ" },
    ],
  },
  {
    title: "সাপোর্ট",
    links: [
      { href: "/help", label: "হেল্প সেন্টার" },
      { href: "/contact", label: "যোগাযোগ" },
      { href: "/developers", label: "ডেভেলপার API" },
      { href: "/login", label: "মার্চেন্ট লগইন" },
    ],
  },
  {
    title: "আইনি",
    links: [
      { href: "/terms", label: "শর্তাবলী" },
      { href: "/privacy", label: "প্রাইভেসি পলিসি" },
      { href: "/refund-policy", label: "রিফান্ড নীতি" },
      { href: "/about", label: "আমাদের সম্পর্কে" },
    ],
  },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="min-w-0 flex-1">{children}</main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2 lg:col-span-2">
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                A
              </span>
              <span className="text-ink-900">ATLaS</span>
            </div>
            <p className="max-w-xs text-sm text-ink-500">
              বাংলাদেশের উদ্যোক্তাদের জন্য সম্পূর্ণ ই-কমার্স দোকান — বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন
              ডেলিভারি সহ।
            </p>
            <p className="text-xs text-ink-400">BDT · Asia/Dhaka · বাংলা ও ইংরেজি</p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2 text-sm">
              <p className="font-semibold text-ink-900">{group.title}</p>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className="block text-ink-600 hover:text-ink-900">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="border-t border-ink-200 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-ink-500">
            <p>© {new Date().getFullYear()} ATLaS। বাংলাদেশে তৈরি।</p>
            <Link href="/developers" className="hover:text-ink-900">
              API v1 · OpenAPI 3.1
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
