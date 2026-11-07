"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  Code2,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Palette,
  Percent,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserSquare2,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMessages } from "@/components/locale-provider";
import type { Messages } from "@/lib/i18n/messages";

/**
 * Merchant admin section navigation.
 *
 * Desktop: permission-filtered links in a sticky left sidebar. Small screens:
 * a hamburger bar opens the same links in a slide-in drawer. A section is
 * active on its own route and on sub-pages beneath it; the drawer closes
 * automatically on navigation.
 */

type NavItem = {
  href: string;
  key: keyof Messages["admin"]["nav"];
  icon: LucideIcon;
  permission: string;
};

const NAV: NavItem[] = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, permission: "store:read" },
  { href: "/admin/orders", key: "orders", icon: ShoppingCart, permission: "orders:read" },
  { href: "/admin/products", key: "products", icon: Boxes, permission: "catalog:read" },
  { href: "/admin/inventory", key: "inventory", icon: Warehouse, permission: "catalog:read" },
  { href: "/admin/customers", key: "customers", icon: Users, permission: "customers:read" },
  { href: "/admin/design", key: "design", icon: Palette, permission: "design:read" },
  { href: "/admin/pages", key: "pages", icon: FileText, permission: "design:read" },
  { href: "/admin/delivery", key: "delivery", icon: Truck, permission: "delivery:read" },
  { href: "/admin/payments", key: "payments", icon: Wallet, permission: "payments:read" },
  { href: "/admin/discounts", key: "discounts", icon: Percent, permission: "discounts:read" },
  { href: "/admin/reports", key: "reports", icon: BarChart3, permission: "reports:read" },
  { href: "/admin/developers", key: "developers", icon: Code2, permission: "settings:read" },
  { href: "/admin/staff", key: "staff", icon: UserSquare2, permission: "staff:read" },
  { href: "/admin/billing", key: "billing", icon: Receipt, permission: "billing:read" },
  { href: "/admin/support", key: "support", icon: LifeBuoy, permission: "store:read" },
  { href: "/admin/settings", key: "settings", icon: Settings, permission: "settings:read" },
];

/** A section is active on its own route and on sub-pages beneath it. */
function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Route changes close the mobile drawer (state adjusted during render).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  const items = NAV.filter((item) => permissions.includes(item.permission)).map((item) => ({
    ...item,
    label: m.admin.nav[item.key],
  }));
  const active = items.find((item) => isActive(item.href, pathname));

  const itemClass = (activated: boolean) =>
    activated
      ? "bg-brand-600 text-white shadow-sm hover:bg-brand-600"
      : "text-ink-700 hover:bg-ink-100 hover:text-ink-900";

  return (
    <>
      {/* ── Desktop: sticky left sidebar ─────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-white px-3 md:sticky md:top-14 md:flex md:h-[calc(100vh-3.5rem)] md:flex-col">
        <nav aria-label={m.admin.sections} className="flex flex-col gap-0.5 overflow-y-auto pb-6 pt-6">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href, pathname) ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${itemClass(isActive(item.href, pathname))}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── Mobile: hamburger bar + drawer ───────────────────────────────────── */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="admin-nav-drawer"
          className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-ink-50 shadow-sm">
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </span>
          {m.admin.menu}
          {active ? (
            <span className="ml-auto flex items-center gap-1.5 text-xs font-normal text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
              {active.label}
            </span>
          ) : null}
        </button>

        {open ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <div aria-hidden className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div
              id="admin-nav-drawer"
              className="absolute inset-y-0 left-0 w-64 max-w-[80vw] overflow-y-auto bg-white p-3 shadow-2xl"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-ink-900">{m.admin.menu}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={m.common.close}
                  className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav aria-label={m.admin.sections} className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href, pathname) ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${itemClass(isActive(item.href, pathname))}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
