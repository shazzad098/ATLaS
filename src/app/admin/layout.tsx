import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Bell, ExternalLink, LogOut, Palette, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { STORE_COOKIE, getActiveStore, getWorkspace } from "@/lib/tenant";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { resolveStoreTheme } from "@/lib/services/theme-service";
import { storePath } from "@/lib/storefront";
import { prisma } from "@/lib/db";
import { Alert, Badge, Meter } from "@/components/ui/shell";
import { AppShell, type AppNavGroup, type NavIcon } from "@/components/ui/app-shell";
import { logoutAction } from "@/app/(auth)/actions";
import { StoreSwitcher } from "@/app/admin/_components/store-switcher";

/**
 * Merchant admin shell.
 *
 * The panel wears its own storefront's identity: the primary colour of the
 * active theme drives `--admin-primary`, which re-derives the whole `brand-*`
 * ramp inside `.admin-themed`. Dhaka Bazar therefore works in green and Nokshi
 * in maroon, while the layout, navigation and data stay identical.
 */

type NavItem = { href: string; label: string; icon: NavIcon; permission: string };

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "মূল",
    items: [
      { href: "/admin", label: "ড্যাশবোর্ড", icon: "dashboard", permission: "store:read" },
      { href: "/admin/orders", label: "অর্ডার", icon: "orders", permission: "orders:read" },
      { href: "/admin/customers", label: "কাস্টমার", icon: "customers", permission: "customers:read" },
    ],
  },
  {
    title: "ক্যাটালগ",
    items: [
      { href: "/admin/products", label: "পণ্য", icon: "products", permission: "catalog:read" },
      { href: "/admin/inventory", label: "ইনভেন্টরি", icon: "inventory", permission: "catalog:read" },
      { href: "/admin/categories", label: "ক্যাটাগরি", icon: "categories", permission: "catalog:read" },
    ],
  },
  {
    title: "মার্কেটিং",
    items: [
      { href: "/admin/design", label: "ডিজাইন", icon: "design", permission: "design:read" },
      { href: "/admin/discounts", label: "ডিসকাউন্ট", icon: "discounts", permission: "discounts:read" },
    ],
  },
  {
    title: "অপারেশনস",
    items: [
      { href: "/admin/delivery", label: "ডেলিভারি", icon: "delivery", permission: "delivery:read" },
      { href: "/admin/payments", label: "পেমেন্ট", icon: "payments", permission: "payments:read" },
      { href: "/admin/reports", label: "রিপোর্ট", icon: "reports", permission: "reports:read" },
      { href: "/admin/staff", label: "স্টাফ", icon: "staff", permission: "staff:read" },
    ],
  },
  {
    title: "অ্যাকাউন্ট",
    items: [
      { href: "/admin/billing", label: "বিলিং ও প্ল্যান", icon: "billing", permission: "billing:read" },
      { href: "/admin/support", label: "সাপোর্ট", icon: "support", permission: "store:read" },
      { href: "/admin/settings", label: "সেটিংস", icon: "settings", permission: "settings:read" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const store = await getActiveStore(workspace);
  if (!store) redirect("/onboarding");

  const [snapshot, theme, unread, jar] = await Promise.all([
    loadEntitlementSnapshot(workspace.activeTenant.tenantId),
    resolveStoreTheme(store.id),
    prisma.notification.count({ where: { userId: workspace.user.id, readAt: null } }),
    cookies(),
  ]);

  const storeCookie = jar.get(STORE_COOKIE)?.value;
  const primary = theme.config.colors.primary;
  const deep = `color-mix(in srgb, ${primary} 68%, #07110c)`;
  const pageTint = `color-mix(in srgb, ${primary} 4%, #f6f7f9)`;

  const nav: AppNavGroup[] = NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items
      .filter((item) => workspace.actor.permissions.includes(item.permission))
      .map((item) => ({ href: item.href, label: item.label, icon: item.icon })),
  })).filter((group) => group.items.length > 0);

  return (
    <div
      className="admin-themed"
      style={
        {
          "--admin-primary": primary,
          "--admin-deep": deep,
          "--admin-page": pageTint,
        } as CSSProperties
      }
    >
      <AppShell
        variant="merchant"
        brand={{
          name: store.name,
          subtitle: `${theme.name} থিম · ${workspace.activeTenant.tenantName}`,
          href: "/admin",
          mark: store.name.slice(0, 1).toUpperCase(),
        }}
        nav={nav}
        user={{
          name: workspace.user.name ?? workspace.user.phone,
          meta: `${workspace.activeTenant.roleName} · ${snapshot.planName}`,
        }}
        topbar={
          <>
            <StoreSwitcher
              stores={workspace.stores.map((item) => ({ id: item.id, name: item.name }))}
              activeId={storeCookie ?? store.id}
            />

            {store.status === "PUBLISHED" ? (
              <Link
                href={storePath(store.slug)}
                target="_blank"
                className="hidden h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-[11.5px] font-medium text-ink-700 hover:bg-ink-50 sm:inline-flex"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                দোকান দেখুন
              </Link>
            ) : (
              <Badge tone="warning">Draft</Badge>
            )}

            <Link
              href="/admin/notifications"
              className="relative inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium text-ink-600 hover:bg-ink-100"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden md:inline">নোটিফিকেশন</span>
              {unread > 0 ? (
                <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? "৯+" : unread}
                </span>
              ) : null}
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </form>
          </>
        }
        banner={
          <div className="mb-5 space-y-3">
            {snapshot.suspended ? (
              <Alert tone="danger" title="অ্যাকাউন্ট সাময়িক বন্ধ">
                সাবস্ক্রিপশন সমস্যার কারণে দোকান বন্ধ আছে। বিলিং পেজে গিয়ে পেমেন্ট সম্পন্ন করুন।
              </Alert>
            ) : snapshot.readOnly ? (
              <Alert tone="warning" title="Read-only মোড">
                নতুন অর্ডার নেওয়া বন্ধ আছে। বিলিং আপডেট করলে আবার চালু হবে।
              </Alert>
            ) : null}

            <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{snapshot.planName} প্ল্যান</Badge>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500">
                  <Palette className="h-3 w-3" />
                  {theme.name} থিম
                </span>
                <span className="hidden items-center gap-1 text-[11px] text-ink-400 sm:inline-flex">
                  <Sparkles className="h-3 w-3" />
                  মার্চেন্ট প্যানেল আপনার স্টোরফ্রন্টের রঙে
                </span>
                <Link
                  href="/admin/billing"
                  className="ml-auto text-[11.5px] font-semibold text-brand-700 hover:underline"
                >
                  প্ল্যান ও বিলিং →
                </Link>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Meter label="পণ্য" used={snapshot.usage.products} limit={snapshot.limits.products} />
                <Meter
                  label="এই মাসের অর্ডার"
                  used={snapshot.usage.ordersThisPeriod}
                  limit={snapshot.limits.monthlyOrders}
                />
                <Meter label="স্টোরেজ" used={snapshot.usage.storageMb} limit={snapshot.limits.storageMb} unit=" MB" />
                <Meter label="স্টাফ সিট" used={snapshot.usage.staffSeats} limit={snapshot.limits.staffSeats} />
              </div>
            </div>
          </div>
        }
        footerNote={`${workspace.activeTenant.tenantName} · ${store.name} — সাবস্ক্রিপশন, অর্ডার ও ক্যাটালগ একই ডেটাবেস থেকে।`}
      >
        {children}
      </AppShell>
    </div>
  );
}
