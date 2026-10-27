import Link from "next/link";
import { MobileNav } from "./mobile-nav";

/** Marketing chrome for the public site: `/`, `/features`, `/pricing`, `/themes`. */

const NAV = [
  { href: "/features", label: "ফিচার" },
  { href: "/pricing", label: "দাম" },
  { href: "/themes", label: "থিম" },
  { href: "/how-it-works", label: "কীভাবে কাজ করে" },
  { href: "/signup", label: "ফ্রি সাইনআপ" },
];

const FOOTER_COLUMNS = [
  {
    title: "প্রোডাক্ট",
    links: [
      { href: "/features", label: "ফিচার" },
      { href: "/pricing", label: "দাম" },
      { href: "/themes", label: "থিম" },
      { href: "/how-it-works", label: "কীভাবে কাজ করে" },
      { href: "/signup", label: "ফ্রি সাইনআপ" },
    ],
  },
  {
    title: "রিসোর্স",
    links: [
      { href: "/help", label: "Help Center" },
      { href: "/developers", label: "Developers / API" },
      { href: "/demo-sms", label: "ডেমো SMS ইনবক্স" },
      { href: "/how-it-works", label: "স্টার্ট গাইড" },
    ],
  },
  {
    title: "কোম্পানি",
    links: [
      { href: "/about", label: "আমাদের সম্পর্কে" },
      { href: "/contact", label: "যোগাযোগ" },
      { href: "/signup", label: "ফ্রি সাইনআপ" },
      { href: "/account", label: "অ্যাকাউন্ট" },
    ],
  },
  {
    title: "আইনি",
    links: [
      { href: "/terms", label: "ব্যবহারের শর্তাবলী" },
      { href: "/privacy", label: "প্রাইভেসি পলিসি" },
      { href: "/refund-policy", label: "রিফান্ড নীতি" },
    ],
  },
];

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

function BrandMark({ size = "md" }: { size?: "md" | "sm" }) {
  const box = size === "md" ? "h-9 w-9 rounded-[11px] text-[15px]" : "h-8 w-8 rounded-[10px] text-[13px]";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`grid place-items-center bg-[#0BA678] font-bold text-white shadow-[0_6px_14px_-8px_rgba(11,166,120,0.9)] ${box}`}
      >
        A
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-tight text-ink-900">ATLaS</span>
        <span className="mt-1 text-[9px] font-semibold tracking-[0.18em] text-ink-400">বাংলাদেশ</span>
      </span>
    </span>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-[#e8eeeb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-2 px-4 sm:px-6">
          <Link href="/" aria-label="ATLaS হোম">
            <BrandMark />
          </Link>

          <nav className="ml-7 hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-600 transition hover:bg-[#f2f8f5] hover:text-ink-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-600 transition hover:bg-[#f2f8f5] hover:text-ink-900 md:inline-flex"
            >
              লগইন
            </Link>
            <Link
              href="/dashboard"
              className="hidden items-center justify-center rounded-[10px] bg-[#0BA678] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(11,166,120,0.95)] transition hover:bg-[#099569] md:inline-flex"
            >
              ড্যাশবোর্ড
            </Link>
            <MobileNav />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#e8eeeb] bg-[#f7faf9]">
        <div className="mx-auto grid max-w-[1160px] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr]">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Link href="/" aria-label="ATLaS হোম">
              <BrandMark size="sm" />
            </Link>
            <p className="max-w-[300px] text-[13px] leading-6 text-ink-500">
              বাংলাদেশের উদ্যোক্তাদের জন্য সম্পূর্ণ ই-কমার্স দোকান — থিম, প্রোডাক্ট, অর্ডার,
              ডেলিভারি আর বিকাশ/নগদ/SSLCommerz/COD পেমেন্ট এক জায়গায়।
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-ink-500">
              <span className="rounded-full border border-[#e2ebe6] bg-white px-2.5 py-1">BDT · Asia/Dhaka</span>
              <span className="rounded-full border border-[#e2ebe6] bg-white px-2.5 py-1">বাংলা ও English</span>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3 text-[13px]">
              <p className="text-xs font-semibold tracking-wide text-ink-900">{column.title}</p>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-ink-500 transition hover:text-[#0B7A5B]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#e8eeeb]">
          <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[11.5px] text-ink-500 sm:px-6">
            <p>© {bn(new Date().getFullYear())} ATLaS · সর্বস্বত্ব সংরক্ষিত</p>
            <div className="flex items-center gap-5">
              <Link href="/terms" className="hover:text-[#0B7A5B]">ব্যবহারের শর্তাবলী</Link>
              <Link href="/privacy" className="hover:text-[#0B7A5B]">প্রাইভেসি পলিসি</Link>
              <Link href="/refund-policy" className="hover:text-[#0B7A5B]">রিফান্ড নীতি</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
