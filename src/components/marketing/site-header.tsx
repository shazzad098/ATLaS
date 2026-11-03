"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Sticky marketing navigation with active-route state and a mobile menu. */

const NAV = [
  { href: "/", label: "হোম" },
  { href: "/pricing", label: "প্রাইসিং" },
  { href: "/themes", label: "থিম" },
  { href: "/how-it-works", label: "কীভাবে কাজ করে" },
  { href: "/help", label: "হেল্প" },
  { href: "/contact", label: "যোগাযোগ" },
  { href: "/about", label: "আমাদের সম্পর্কে" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-300",
        scrolled
          ? "border-ink-200/80 bg-white/85 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl"
          : "border-transparent bg-white/70 backdrop-blur-md",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center gap-3 px-4 transition-[height] duration-300",
          scrolled ? "h-14" : "h-16",
        )}
      >
        {/* Brand */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="ATLaS — হোম">
          <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-sm font-bold text-white shadow-sm shadow-brand-900/25 ring-1 ring-white/40 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.45),transparent_58%)]"
            />
            <span className="relative">A</span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-ink-900">ATLaS</span>
            <span className="mt-1 hidden text-[8px] font-semibold tracking-[0.18em] text-ink-400 uppercase sm:block">
              স্টোর বিল্ডার
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="প্রধান মেনু">
          {NAV.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-200",
                  active ? "text-brand-800" : "text-ink-600 hover:text-ink-900",
                )}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-2.5 -bottom-px h-0.5 origin-left rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-transform duration-300",
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <span aria-hidden="true" className="hidden h-5 w-px bg-ink-200 sm:block" />
          <ButtonLink
            href="/login"
            variant="ghost"
            size="sm"
            className="hidden text-ink-600 hover:text-ink-900 sm:inline-flex"
          >
            লগইন
          </ButtonLink>
          <ButtonLink
            href="/signup"
            size="sm"
            className="group relative overflow-hidden shadow-sm shadow-brand-900/15 transition-shadow duration-300 hover:shadow-md hover:shadow-brand-900/20"
          >
            <span className="relative z-10">ফ্রি শুরু করুন</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </ButtonLink>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
            className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-700 transition duration-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 lg:hidden"
          >
            <span aria-hidden="true" className="relative block h-4 w-5">
              <span
                className={cn(
                  "absolute top-0.5 left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300",
                  open && "top-2 rotate-45",
                )}
              />
              <span
                className={cn(
                  "absolute top-2 left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute top-3.5 left-0 h-0.5 w-5 rounded-full bg-current transition-all duration-300",
                  open && "top-2 -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open ? (
        <div
          id="mobile-nav"
          className="animate-fade-up border-t border-ink-100 bg-white/95 [animation-duration:0.3s] backdrop-blur-xl lg:hidden"
        >
          <nav className="mx-auto grid max-w-6xl gap-0.5 px-4 py-3" aria-label="মোবাইল মেনু">
            {NAV.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    active
                      ? "bg-brand-50 text-brand-800"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                  )}
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      active ? "bg-brand-600" : "bg-transparent",
                    )}
                  />
                </Link>
              );
            })}

            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3">
              <ButtonLink href="/login" variant="outline" size="sm" onClick={() => setOpen(false)}>
                লগইন
              </ButtonLink>
              <ButtonLink href="/signup" size="sm" onClick={() => setOpen(false)}>
                ফ্রি শুরু করুন
              </ButtonLink>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
