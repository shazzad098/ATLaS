import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Percent,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserSquare2,
  Wallet,
  Warehouse,
} from "lucide-react";
import { STORE_COOKIE, getActiveStore, getWorkspace } from "@/lib/tenant";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { storePath } from "@/lib/storefront";
import { Alert, Badge } from "@/components/ui/shell";
import { logoutAction } from "@/app/(auth)/actions";
import { StoreSwitcher } from "@/app/admin/_components/store-switcher";

/** Merchant admin shell: permission-filtered sidebar, store switcher, plan banner. */

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: string;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, permission: "store:read" },
  { href: "/admin/orders", label: "অর্ডার", icon: ShoppingCart, permission: "orders:read" },
  { href: "/admin/products", label: "পণ্য", icon: Boxes, permission: "catalog:read" },
  { href: "/admin/inventory", label: "ইনভেন্টরি", icon: Warehouse, permission: "catalog:read" },
  { href: "/admin/categories", label: "ক্যাটাগরি", icon: FolderTree, permission: "catalog:read" },
  { href: "/admin/customers", label: "কাস্টমার", icon: Users, permission: "customers:read" },
  { href: "/admin/design", label: "ডিজাইন", icon: Palette, permission: "design:read" },
  { href: "/admin/delivery", label: "ডেলিভারি", icon: Truck, permission: "delivery:read" },
  { href: "/admin/payments", label: "পেমেন্ট", icon: Wallet, permission: "payments:read" },
  { href: "/admin/discounts", label: "ডিসকাউন্ট", icon: Percent, permission: "discounts:read" },
  { href: "/admin/reports", label: "রিপোর্ট", icon: BarChart3, permission: "reports:read" },
  { href: "/admin/staff", label: "স্টাফ", icon: UserSquare2, permission: "staff:read" },
  { href: "/admin/billing", label: "বিলিং", icon: Receipt, permission: "billing:read" },
  { href: "/admin/support", label: "সাপোর্ট", icon: LifeBuoy, permission: "store:read" },
  { href: "/admin/settings", label: "সেটিংস", icon: Settings, permission: "settings:read" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const store = await getActiveStore(workspace);
  if (!store) redirect("/onboarding");

  const snapshot = await loadEntitlementSnapshot(workspace.activeTenant.tenantId);
  const jar = await cookies();
  const storeCookie = jar.get(STORE_COOKIE)?.value;

  const visible = NAV.filter((item) => workspace.actor.permissions.includes(item.permission));

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-[110rem] items-center gap-3 px-4 py-2.5">
          <Link href="/admin" className="flex items-center gap-2 font-semibold" aria-label="ATLaS admin">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              A
            </span>
            <span className="hidden sm:inline">ATLaS</span>
          </Link>

          <StoreSwitcher
            stores={workspace.stores.map((item) => ({ id: item.id, name: item.name }))}
            activeId={storeCookie ?? store.id}
          />

          <div className="ml-auto flex items-center gap-2">
            {store.status === "PUBLISHED" ? (
              <Link
                href={storePath(store.slug)}
                target="_blank"
                className="hidden items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 sm:inline-flex"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                দোকান দেখুন
              </Link>
            ) : (
              <Badge tone="warning">Draft</Badge>
            )}

            <Link
              href="/admin/notifications"
              className="relative inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">নোটিফিকেশন</span>
            </Link>

            <Link
              href="/account"
              className="hidden text-xs text-ink-500 hover:text-ink-900 lg:inline"
            >
              {workspace.user.name ?? workspace.user.phone} · {workspace.activeTenant.roleName}
            </Link>

            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100"
              >
                লগআউট
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[110rem] gap-1 overflow-x-auto px-4 pb-2 no-scrollbar">
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-6">
        {snapshot.suspended ? (
          <Alert tone="danger" className="mb-4" title="অ্যাকাউন্ট সাময়িক বন্ধ">
            সাবস্ক্রিপশন সমস্যার কারণে দোকান বন্ধ আছে। বিলিং পেজে গিয়ে পেমেন্ট সম্পন্ন করুন।
          </Alert>
        ) : snapshot.readOnly ? (
          <Alert tone="warning" className="mb-4" title="Read-only মোড">
            নতুন অর্ডার নেওয়া বন্ধ আছে। বিলিং আপডেট করলে আবার চালু হবে।
          </Alert>
        ) : null}

        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <Badge tone="brand">{snapshot.planName} প্ল্যান</Badge>
          <span>
            পণ্য {snapshot.usage.products}
            {snapshot.limits.products === null ? "" : ` / ${snapshot.limits.products}`}
          </span>
          <span aria-hidden>·</span>
          <span>
            এই মাসে অর্ডার {snapshot.usage.ordersThisPeriod}
            {snapshot.limits.monthlyOrders === null ? "" : ` / ${snapshot.limits.monthlyOrders}`}
          </span>
        </div>

        {children}
      </div>

      <footer className="border-t border-ink-200 bg-white py-6">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-2 px-4 text-xs text-ink-500">
          <p>প্ল্যাটফর্ম ফি ও সাবস্ক্রিপশন মডেল — BDT / Asia/Dhaka</p>
          <p>{workspace.activeTenant.tenantName}</p>
        </div>
      </footer>
    </div>
  );
}
