"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

const LINKS = [
  { href: "/features", label: "ফিচার", hint: "সব মডিউলের বিস্তারিত" },
  { href: "/pricing", label: "দাম", hint: "প্ল্যান ও ফি তুলনা" },
  { href: "/themes", label: "থিম", hint: "Nokshi · Bazar · Studio" },
  { href: "/how-it-works", label: "কীভাবে কাজ করে", hint: "ধাপে ধাপে গাইড" },
  { href: "/help", label: "Help Center", hint: "সাহায্য ও FAQ" },
  { href: "/signup", label: "ফ্রি সাইনআপ", hint: "৫ মিনিটে নিজের দোকান চালু করুন" },
];

/** Mobile navigation: hamburger + slide-down panel. Desktop nav lives in the layout. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Keep the page behind the panel from scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="marketing-mobile-nav"
        aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
        className="grid h-10 w-10 place-items-center rounded-[10px] border border-[#e2ebe6] bg-white text-ink-700 transition active:bg-[#f2f8f5]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="মেনু বন্ধ করুন"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full z-40 h-[calc(100dvh-4rem)] bg-ink-900/30"
          />

          <div
            id="marketing-mobile-nav"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[#e8eeeb] bg-white shadow-[0_24px_48px_-24px_rgba(6,60,45,0.35)]"
          >
            <nav className="mx-auto max-w-[1160px] px-4 py-3 sm:px-6">
              <ul className="divide-y divide-[#f1f5f3]">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-3 py-3.5 text-[14px] font-semibold text-ink-800"
                    >
                      <span className="flex flex-col">
                        {link.label}
                        <span className="mt-0.5 text-[11px] font-normal text-ink-400">{link.hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-300" />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid gap-2 pb-4">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#0BA678] text-[13px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(11,166,120,0.95)]"
                >
                  ড্যাশবোর্ডে যান <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#dfe8e4] bg-white text-[13px] font-semibold text-ink-800"
                  >
                    লগইন
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white text-[13px] font-semibold text-ink-800"
                  >
                    ফ্রি শুরু করুন <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
