import { redirect } from "next/navigation";
import { LogOut, Search, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import { readSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/(auth)/actions";
import { prisma } from "@/lib/db";
import { AppShell, type AppNavGroup } from "@/components/ui/app-shell";

/** Platform operator shell (PRD §4.5). Only `isSuperAdmin` users get past the guard. */

export const metadata = { title: "Super Admin" };

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/admin");

  const openTickets = await prisma.supportTicket.count({
    where: { status: { in: ["OPEN", "PENDING"] } },
  });

  const nav: AppNavGroup[] = [
    {
      items: [{ href: "/super-admin", label: "ওভারভিউ", icon: "overview" }],
    },
    {
      title: "টেন্যান্ট ম্যানেজমেন্ট",
      items: [
        { href: "/super-admin/tenants", label: "সব টেন্যান্ট", icon: "tenants" },
        { href: "/super-admin/plans", label: "প্ল্যান ও লিমিট", icon: "plans" },
        { href: "/super-admin/fees", label: "ফি লেজার", icon: "fees" },
      ],
    },
    {
      title: "প্ল্যাটফর্ম",
      items: [
        { href: "/super-admin/themes", label: "থিম ক্যাটালগ", icon: "themes" },
        { href: "/super-admin/webhooks", label: "ওয়েবহুক", icon: "webhooks" },
      ],
    },
    {
      title: "অপারেশনস",
      items: [
        { href: "/super-admin/audit", label: "সিকিউরিটি ও অডিট", icon: "audit" },
        {
          href: "/super-admin/tickets",
          label: "সাপোর্ট টিকেট",
          icon: "tickets",
          badge: openTickets > 0 ? String(openTickets) : undefined,
        },
        { href: "/super-admin/announcements", label: "অ্যানাউন্সমেন্ট", icon: "announcements" },
        { href: "/super-admin/jobs", label: "Job Queue", icon: "jobs" },
      ],
    },
  ];

  return (
    <div
      className="admin-themed"
      style={{ "--admin-primary": "#4F46E5", "--admin-deep": "#111C3B" } as CSSProperties}
    >
      <AppShell
        variant="platform"
        brand={{ name: "ATLaS", subtitle: "Platform Control", href: "/super-admin", mark: "A" }}
        nav={nav}
        user={{ name: session.user.name ?? session.user.phone, meta: "Super Admin" }}
        search={
          <form action="/super-admin/tenants" className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              name="q"
              placeholder="টেন্যান্ট, ফোন বা ইমেইল খুঁজুন…"
              className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50/70 pr-3 pl-9 text-[12.5px] text-ink-800 outline-none transition focus:border-brand-400 focus:bg-white"
            />
          </form>
        }
        topbar={
          <>
            <span className="hidden items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[10.5px] font-semibold text-brand-700 md:inline-flex">
              <ShieldCheck className="h-3 w-3" />
              Platform ops
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </form>
          </>
        }
        footerNote="প্ল্যাটফর্ম অপারেশন — সাবস্ক্রিপশন, ফি, থিম ও সিকিউরিটি। প্রতিটি পরিবর্তন audit log-এ সংরক্ষিত থাকে।"
      >
        {children}
      </AppShell>
    </div>
  );
}
