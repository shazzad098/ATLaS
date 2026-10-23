import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

/** Marketing chrome for the public site: `/`, `/pricing`, `/themes`. */

const NAV = [
  { href: "/#features", label: "ফিচার" },
  { href: "/pricing", label: "প্রাইসিং" },
  { href: "/themes", label: "থিম" },
  { href: "/store/nokshi-demo", label: "ডেমো দোকান" },
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

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              লগইন
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              ফ্রি শুরু করুন
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                A
              </span>
              <span className="text-ink-900">ATLaS</span>
            </div>
            <p className="text-sm text-ink-500">
              বাংলাদেশের উদ্যোক্তাদের জন্য সম্পূর্ণ ই-কমার্স দোকান — বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন
              ডেলিভারি সহ।
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-ink-900">শুরু করুন</p>
            <Link href="/signup" className="block text-ink-600 hover:text-ink-900">
              ফ্রি অ্যাকাউন্ট
            </Link>
            <Link href="/pricing" className="block text-ink-600 hover:text-ink-900">
              প্ল্যান ও প্রাইসিং
            </Link>
            <Link href="/themes" className="block text-ink-600 hover:text-ink-900">
              থিম গ্যালারি
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-ink-900">ডেমো দোকান</p>
            <Link href="/store/nokshi-demo" className="block text-ink-600 hover:text-ink-900">
              নকশি বুটিক
            </Link>
            <Link href="/store/dhaka-bazar" className="block text-ink-600 hover:text-ink-900">
              ঢাকা বাজার
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-ink-900">প্ল্যাটফর্ম</p>
            <p className="text-ink-500">BDT · Asia/Dhaka</p>
            <p className="text-ink-500">বাংলা ও ইংরেজি</p>
            <Link href="/login" className="block text-ink-600 hover:text-ink-900">
              মার্চেন্ট লগইন
            </Link>
          </div>
        </div>

        <div className="border-t border-ink-200 py-4">
          <p className="mx-auto max-w-6xl px-4 text-xs text-ink-500">
            © {new Date().getFullYear()} ATLaS। বাংলাদেশে তৈরি।
          </p>
        </div>
      </footer>
    </div>
  );
}
