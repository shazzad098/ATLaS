import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { superAdminShellData } from "@/lib/services/platform-service";
import { SuperAdminShell } from "@/app/super-admin/_components/super-admin-shell";
import pkg from "../../../package.json";

/** Platform operator shell (PRD §4.5). Only `isSuperAdmin` users get past the guard. */

export const metadata = { title: "Super Admin" };

// Session-guarded, live platform metrics: never prerender during a build.
export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/admin");

  // Nav badges, cluster latency and the notification dot are live reads.
  const shell = await superAdminShellData();

  return (
    <SuperAdminShell
      user={{
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone,
      }}
      counts={shell.counts}
      health={shell.health}
      initialUnread={shell.audits24h}
      version={pkg.version}
      environment={process.env.NODE_ENV === "production" ? "prod" : "dev"}
    >
      {children}
    </SuperAdminShell>
  );
}
