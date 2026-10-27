import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getActiveStore, getWorkspace } from "@/lib/tenant";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Merchant entry gate.
 *
 * The public site's "ড্যাশবোর্ড" button points here instead of straight at the
 * admin panel, so a visitor always goes through authentication first:
 *
 *   signed out              → /login (with ?next=/dashboard)
 *   signed in, no store     → /onboarding (store setup, then the dashboard)
 *   signed in, store exists → /admin
 *
 * Super admins have their own console and never enter a merchant workspace by
 * accident. Signed-in accounts without a merchant membership are told so
 * instead of being bounced between /login and /admin.
 */

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };
export const dynamic = "force-dynamic";

export default async function DashboardGatePage() {
  const session = await readSession();
  if (!session) redirect("/login?next=%2Fdashboard");

  if (session.user.isSuperAdmin) redirect("/super-admin");

  const workspace = await getWorkspace();
  if (!workspace) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-4 py-12">
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-xs">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-ink-100 text-ink-600">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-ink-900">মার্চেন্ট অ্যাকাউন্ট প্রয়োজন</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            এই অ্যাকাউন্টটি কোনো দোকানের সাথে যুক্ত নয়। ড্যাশবোর্ড ব্যবহার করতে মার্চেন্ট হিসেবে
            সাইনআপ করুন, অথবা আপনার দোকানের মালিককে স্টাফ হিসেবে আমন্ত্রণ পাঠাতে বলুন।
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              মার্চেন্ট হিসেবে শুরু করুন
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-10 items-center rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              সহায়তা নিন
            </Link>
          </div>
        </div>

        <form action={logoutAction} className="text-center">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            অন্য অ্যাকাউন্টে লগইন করুন
          </button>
        </form>
      </main>
    );
  }

  const store = await getActiveStore(workspace);
  if (!store) redirect("/onboarding?next=%2Fdashboard");

  redirect("/admin");
}
