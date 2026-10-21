import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

/** Marketing chrome for the public site. */

const NAV = [
  { href: "/", label: "হোম" },
  { href: "/pricing", label: "প্রাইসিং" },
  { href: "/themes", label: "থিম" },
  { href: "/how-it-works", label: "কীভাবে কাজ করে" },
  { href: "/help", label: "হেল্প" },
  { href: "/contact", label: "যোগাযোগ" },
  { href: "/about", label: "আমাদের সম্পর্কে" },
];

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
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              A
            </span>
            <span className="text-ink-900">ATLaS</span>
          </Link>

          <nav className="ml-3 hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/login" variant="outline" size="sm">
              লগইন
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              ফ্রি শুরু করুন
            </ButtonLink>
          </div>
        </div>

        {/* Compact nav for phones — the desktop row is hidden below `md`. */}
        <nav className="flex gap-4 overflow-x-auto border-t border-ink-100 px-4 py-2 no-scrollbar md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 text-xs font-medium whitespace-nowrap text-ink-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

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
            <div className="flex flex-wrap gap-2 pt-1 text-sm">
              <Link href="/store/nokshi-demo" className="text-ink-600 hover:text-ink-900">
                নকশি বুটিক
              </Link>
              <span className="text-ink-300">·</span>
              <Link href="/store/dhaka-bazar" className="text-ink-600 hover:text-ink-900">
                ঢাকা বাজার
              </Link>
            </div>
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
