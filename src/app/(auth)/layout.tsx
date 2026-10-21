import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

/** Auth shell: marketing panel on the left, form on the right (PRD §3.1). */

const HIGHLIGHTS = [
  "বিকাশ, নগদ, SSLCommerz আর ক্যাশ অন ডেলিভারি — সব একসাথে",
  "নিজের সাবডোমেইন আর ৩টি তৈরি থিম",
  "প্রোডাক্ট, অর্ডার আর ডেলিভারি ম্যানেজমেন্ট সহজ ড্যাশবোর্ডে",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-ink-900 p-10 text-white lg:flex">
        <Link href="/" className="text-lg font-semibold">
          ATLaS
        </Link>

        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-snug">
            বাংলাদেশের জন্য তৈরি ই-কমার্স স্টোর — মিনিটেই চালু।
          </h1>
          <ul className="space-y-3 text-sm text-white/80">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          bKash · Nagad · SSLCommerz · COD · BDT · Asia/Dhaka
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-block text-lg font-semibold lg:hidden">
            ATLaS
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
