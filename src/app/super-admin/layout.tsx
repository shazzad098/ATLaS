import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { logoutAction } from "@/app/(auth)/actions";

/** Platform operator shell (PRD §4.5). Only `isSuperAdmin` users get past the guard. */

export const metadata = { title: "Super Admin" };

const NAV = [
  { href: "/super-admin", label: "ওভারভিউ" },
  { href: "/super-admin/tenants", label: "টেন্যান্ট" },
  { href: "/super-admin/plans", label: "প্ল্যান" },
  { href: "/super-admin/fees", label: "ফি লেজার" },
  { href: "/super-admin/themes", label: "থিম ক্যাটালগ" },
  { href: "/super-admin/webhooks", label: "ওয়েবহুক" },
  { href: "/super-admin/audit", label: "সিকিউরিটি" },
  { href: "/super-admin/tickets", label: "সাপোর্ট" },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/admin");

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-ink-900 text-white">
        <div className="mx-auto flex max-w-[110rem] items-center gap-3 px-4 py-2.5">
          <Link href="/super-admin" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">ATLaS · Super Admin</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-white/70 lg:inline">
              {session.user.name ?? session.user.phone}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                লগআউট
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-[110rem] gap-1 overflow-x-auto px-4 pb-2 no-scrollbar">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-ink-200 bg-white py-6">
        <div className="mx-auto max-w-[110rem] px-4 text-xs text-ink-500">
          প্ল্যাটফর্ম অপারেশন — সাবস্ক্রিপশন, ফি ও থিম ক্যাটালগ। প্রতিটি পরিবর্তন audit log-এ থাকে।
        </div>
      </footer>
    </div>
  );
}
