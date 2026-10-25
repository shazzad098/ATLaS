"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Boxes,
  ChartColumn,
  ClipboardList,
  FolderTree,
  Gauge,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Menu,
  Palette,
  Percent,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Ticket,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Shared application shell for both operator surfaces.
 *
 * `platform` is the super-admin identity (navy rail, indigo accents) and
 * `merchant` borrows the active storefront's colour through the `--admin-*`
 * variables the merchant layout sets. Nav icons travel as string keys because a
 * Server Component cannot hand a component reference to a Client Component.
 */

const ICONS = {
  activity: Activity,
  announcements: Megaphone,
  audit: ShieldCheck,
  auditLog: ScrollText,
  billing: Receipt,
  categories: FolderTree,
  customers: Users,
  dashboard: LayoutDashboard,
  delivery: Truck,
  design: Palette,
  discounts: Percent,
  fees: Receipt,
  inventory: Warehouse,
  jobs: ListChecks,
  marketing: Megaphone,
  notifications: Bell,
  orders: ShoppingCart,
  overview: Gauge,
  payments: Wallet,
  plans: Layers,
  products: Boxes,
  reports: ChartColumn,
  settings: Settings,
  staff: UserRound,
  store: Store,
  support: LifeBuoy,
  tasks: ClipboardList,
  tenants: Store,
  themes: Palette,
  tickets: Ticket,
  webhooks: Webhook,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export type AppNavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: string;
};

export type AppNavGroup = {
  title?: string;
  items: AppNavItem[];
};

export type AppShellProps = {
  variant: "platform" | "merchant";
  brand: { name: string; subtitle?: string; href: string; mark?: string };
  nav: AppNavGroup[];
  user: { name: string; meta?: string };
  children: React.ReactNode;
  search?: React.ReactNode;
  topbar?: React.ReactNode;
  banner?: React.ReactNode;
  footerNote?: string;
};

function isActive(pathname: string, href: string): boolean {
  const root = href === "/admin" || href === "/super-admin";
  if (root) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0)).join("").toUpperCase() || "A";
}

export function AppShell({
  variant,
  brand,
  nav,
  user,
  children,
  search,
  topbar,
  banner,
  footerNote,
}: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Keep the page behind the drawer from scrolling while it is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const railClass =
    variant === "platform"
      ? "bg-[#0B1220]"
      : "bg-[linear-gradient(180deg,var(--admin-deep,#0f172a)_0%,var(--admin-primary,#0f766e)_100%)]";

  const markClass =
    variant === "platform"
      ? "bg-[linear-gradient(135deg,#6366F1_0%,#4338CA_100%)]"
      : "bg-white/18 ring-1 ring-white/25";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4">
        <Link href={brand.href} onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white shadow-sm",
              markClass,
            )}
          >
            {brand.mark ?? initials(brand.name)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13.5px] font-semibold tracking-tight text-white">
              {brand.name}
            </span>
            {brand.subtitle ? (
              <span className="block truncate text-[10px] font-medium tracking-wide text-white/55">
                {brand.subtitle}
              </span>
            ) : null}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="মেনু বন্ধ করুন"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {nav.map((group, index) => (
          <div key={group.title ?? `group-${index}`}>
            {group.title ? (
              <p className="px-2.5 pb-1.5 text-[9.5px] font-semibold tracking-[0.16em] text-white/35 uppercase">
                {group.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                // Unknown keys must never blank the whole panel (a missing map
                // entry is a runtime crash in React, not a harmless blank icon).
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition",
                        active
                          ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "text-white/65 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition",
                          active ? "text-white" : "text-white/60 group-hover:text-white",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-white/18 px-1.5 py-0.5 text-[9.5px] font-bold text-white tabular-nums">
                          {item.badge}
                        </span>
                      ) : active ? (
                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-white/6 px-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/16 text-[10.5px] font-bold text-white ring-1 ring-white/15">
            {initials(user.name)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[11.5px] font-semibold text-white">{user.name}</span>
            {user.meta ? (
              <span className="block truncate text-[10px] text-white/50">{user.meta}</span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-ink-50 lg:flex"
      style={{ background: "var(--admin-page, #f6f7f9)" }}
    >
      <aside className={cn("sticky top-0 hidden h-screen w-64 shrink-0 lg:block xl:w-[17rem]", railClass)}>
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="মেনু বন্ধ করুন"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]"
          />
          <div className={cn("absolute inset-y-0 left-0 w-[17.5rem] shadow-2xl", railClass)}>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-8">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 lg:hidden"
              aria-label="মেনু খুলুন"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">{search}</div>

            <div className="flex items-center gap-1.5 sm:gap-2">{topbar}</div>

            <div className="hidden items-center gap-2 border-l border-ink-200 pl-3 xl:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-[10.5px] font-bold text-brand-700 ring-1 ring-brand-100">
                {initials(user.name)}
              </span>
              <span className="leading-tight">
                <span className="block max-w-36 truncate text-[11.5px] font-semibold text-ink-800">
                  {user.name}
                </span>
                {user.meta ? (
                  <span className="block max-w-36 truncate text-[10px] text-ink-400">{user.meta}</span>
                ) : null}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">
          {banner}
          {children}
        </main>

        <footer className="border-t border-ink-200 bg-white px-4 py-4 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-500">
            <p className="max-w-2xl">{footerNote}</p>
            <p className="font-medium text-ink-400">ATLaS · BDT / Asia/Dhaka</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
