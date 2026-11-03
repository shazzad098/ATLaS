"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Palette,
  Receipt,
  ShieldCheck,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import { SuperAdminNotificationBell } from "@/app/super-admin/_components/platform-notifications";

/**
 * Super Admin shell: dark platform chrome (top bar + sidebar) around the pages.
 *
 * Lives in one client component so the mobile drawer and the top bar share the
 * open state. Everything it shows is passed in from the server layout — the
 * counts, cluster latency and 24h audit volume are live reads.
 */

type ShellUser = { name: string | null; email: string | null; phone: string };

export type SuperAdminShellProps = {
  children: React.ReactNode;
  user: ShellUser;
  counts: { tenants: number; themesLive: number };
  health: { ok: boolean; latencyMs: number };
  initialUnread: number;
  version: string;
  environment: string;
};

const NAV: Array<{ href: string; label: string; icon: LucideIcon; badge?: "tenants" | "themes" }> = [
  { href: "/super-admin", label: "ওভারভিউ", icon: LayoutDashboard },
  { href: "/super-admin/notifications", label: "নোটিফিকেশন", icon: Bell },
  { href: "/super-admin/tenants", label: "টেন্যান্ট", icon: Building2, badge: "tenants" },
  { href: "/super-admin/plans", label: "প্ল্যান", icon: CreditCard },
  { href: "/super-admin/billing", label: "সাবস্ক্রিপশন বিলিং", icon: Receipt },
  { href: "/super-admin/fees", label: "ফি লেজার", icon: BarChart3 },
  { href: "/super-admin/themes", label: "থিম ক্যাটালগ", icon: Palette, badge: "themes" },
  { href: "/super-admin/webhooks", label: "ওয়েবহুক", icon: Webhook },
  { href: "/super-admin/audit", label: "সিকিউরিটি", icon: ShieldCheck },
  { href: "/super-admin/tickets", label: "সাপোর্ট", icon: LifeBuoy },
];

const SEGMENT_LABEL: Record<string, string> = {
  "super-admin": "ড্যাশবোর্ড",
  notifications: "নোটিফিকেশন",
  tenants: "টেন্যান্ট",
  plans: "প্ল্যান",
  billing: "সাবস্ক্রিপশন বিলিং",
  fees: "ফি লেজার",
  themes: "থিম ক্যাটালগ",
  webhooks: "ওয়েবহুক",
  audit: "সিকিউরিটি",
  tickets: "সাপোর্ট",
};

function isActive(href: string, pathname: string): boolean {
  if (href === "/super-admin") return pathname === "/super-admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string | null, phone: string): string {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0)).join("").toUpperCase();
  }
  return phone.replace(/\D/g, "").slice(-2) || "SA";
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function SuperAdminShell({
  children,
  user,
  counts,
  health,
  initialUnread,
  version,
  environment,
}: SuperAdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean).slice(1);
  const crumb = [
    "ড্যাশবোর্ড",
    ...segments.map((segment) => SEGMENT_LABEL[segment] ?? segment.toUpperCase()),
  ];
  const currentLabel = crumb[crumb.length - 1];

  const badgeValue = (badge: "tenants" | "themes") =>
    badge === "tenants" ? compactNumber(counts.tenants) : `${counts.themesLive} Live`;

  const navLinks = (onNavigate?: () => void) => (
    <nav aria-label="Super Admin sections" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition",
              active
                ? "bg-indigo-600 font-medium text-white shadow-sm shadow-indigo-950/40"
                : "text-white/60 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white/90"
              />
            ) : null}
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                  item.badge === "themes"
                    ? active
                      ? "bg-white/20 text-white"
                      : "border border-indigo-400/25 bg-indigo-400/10 text-indigo-200"
                    : active
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.08] text-white/55",
                )}
              >
                {badgeValue(item.badge)}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-white/10 px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-[11px] font-bold text-white">
          N
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-white">Admin Console</p>
          <p className="truncate font-mono text-[10px] text-white/35">
            v{version} · {environment}
          </p>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {health.ok ? "Ready" : "Degraded"}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="sticky top-0 z-40 bg-[#0b1220] text-white">
        <div className="flex h-16 items-center">
          <Link
            href="/super-admin"
            className="flex h-full w-auto shrink-0 items-center gap-2.5 px-3 md:w-60 md:border-r md:border-white/10 md:px-4"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-950/50">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-tight">
                ATLaS <span className="text-white/35">·</span>
              </span>
              <span className="block text-[9px] font-semibold tracking-[0.24em] text-white/40 uppercase">
                Super Admin
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 px-5 text-xs md:flex">
            {crumb.slice(0, -1).map((label, index) => (
              <span key={`${label}-${index}`} className="flex items-center gap-2 text-white/35">
                {label}
                <ChevronRight className="h-3.5 w-3.5 text-white/20" />
              </span>
            ))}
            <span className="font-semibold text-white">{currentLabel}</span>
          </div>

          <div className="ml-auto flex h-full items-center gap-1 pr-3 md:ml-6">
            <SuperAdminNotificationBell initialUnread={initialUnread} />

            <span className="mx-1.5 hidden h-6 w-px bg-white/10 sm:block" />

            <div className="hidden items-center gap-2 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-[10px] font-bold text-white">
                {initials(user.name, user.phone)}
              </span>
              <span className="leading-tight">
                <span className="block max-w-[10rem] truncate text-[11px] font-semibold text-white">
                  {user.name ?? "ATLaS Super Admin"}
                </span>
                <span className="block max-w-[10rem] truncate text-[10px] text-white/35">
                  {user.email ?? user.phone}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-white/25" />
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </form>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="মেনু খুলুন"
              aria-expanded={drawerOpen}
              className="grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/5 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[110rem] items-stretch">
        <aside className="hidden w-60 shrink-0 bg-[#0b1220] md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)] md:flex-col">
          <div className="px-5 pt-6 pb-4">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-white/35 uppercase">
              Platform control
            </p>
            <p className="mt-1.5 text-xs text-white/50">সুপার অ্যাডমিন নেভিগেশন</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">{navLinks()}</div>
          {sidebarFooter}
        </aside>

        <div className="min-w-0 flex-1">
          <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
          <footer className="border-t border-ink-200 bg-white py-6">
            <div className="px-4 text-xs text-ink-500 md:px-6">
              প্ল্যাটফর্ম অপারেশন — সাবস্ক্রিপশন, ফি ও থিম ক্যাটালগ। প্রতিটি পরিবর্তন audit log-এ থাকে।
            </div>
          </footer>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#0b1220] shadow-2xl">
            <div className="flex items-start justify-between px-5 pt-5 pb-4">
              <div>
                <p className="text-sm font-bold text-white">ATLaS Super Admin</p>
                <p className="mt-0.5 text-[10px] tracking-[0.2em] text-white/35 uppercase">
                  Platform control
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="মেনু বন্ধ করুন"
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">{navLinks(() => setDrawerOpen(false))}</div>
            {sidebarFooter}
          </div>
        </div>
      ) : null}
    </div>
  );
}
