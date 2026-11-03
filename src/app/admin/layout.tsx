import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ExternalLink, Bell } from "lucide-react";
import { STORE_COOKIE, getActiveStore, getWorkspace } from "@/lib/tenant";
import { THEME_COOKIE, resolveAdminTheme } from "@/lib/display-theme";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { storePath } from "@/lib/storefront";
import { Alert, Badge } from "@/components/ui/shell";
import { logoutAction } from "@/app/(auth)/actions";
import { formatDateTime } from "@/lib/dates";
import { stopImpersonationAction } from "@/app/super-admin/actions";
import { StoreSwitcher } from "@/app/admin/_components/store-switcher";
import { AdminNav } from "@/app/admin/_components/admin-nav";

/** Merchant admin shell: permission-filtered navigation, store switcher, plan banner. */

// Every dashboard page reads the session/tenant and live data; never prerender
// them at build time (a Docker build has no database).
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const store = await getActiveStore(workspace);
  if (!store) redirect("/onboarding");

  const snapshot = await loadEntitlementSnapshot(workspace.activeTenant.tenantId);
  const jar = await cookies();
  const storeCookie = jar.get(STORE_COOKIE)?.value;
  const darkTheme = resolveAdminTheme(jar.get(THEME_COOKIE)?.value) === "dark";
  const readOnlyRole =
    workspace.actor.permissions.length > 0 &&
    workspace.actor.permissions.every((permission) => permission.endsWith(":read"));

  return (
    <div
      id="admin-shell"
      className={`flex min-h-screen flex-col bg-ink-50${darkTheme ? " admin-dark" : ""}`}
    >
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
      </header>

      <div className="mx-auto flex w-full max-w-[110rem] flex-1 flex-col md:flex-row md:items-stretch">
        <AdminNav permissions={workspace.actor.permissions} />

        <div className="min-w-0 flex-1 px-4 pb-10 pt-6 md:px-6">
        {workspace.impersonation ? (
          <Alert tone="warning" className="mb-4" title="Impersonation — read-only mode">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{workspace.impersonation.tenantName}</strong> · কারণ:{" "}
                {workspace.impersonation.reason} · ticket {workspace.impersonation.reference} · শেষ হবে{" "}
                {formatDateTime(workspace.impersonation.expiresAt)}
              </span>
              <form action={stopImpersonationAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Impersonation বন্ধ করুন
                </button>
              </form>
            </div>
          </Alert>
        ) : null}

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
          {readOnlyRole ? <Badge tone="neutral">Read-only role</Badge> : null}
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
      </div>
    </div>
  );
}
