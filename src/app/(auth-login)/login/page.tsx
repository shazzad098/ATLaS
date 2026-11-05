import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { sandboxMode } from "@/lib/env";
import { LoginForm } from "@/app/(auth)/_components/login-form";

/** Login (FR-01). */

export const metadata: Metadata = { title: "লগইন" };

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect(session.user.isSuperAdmin ? "/super-admin" : "/admin");

  const devHint = sandboxMode.sms
    ? "ডেমো: +8801700000000 (super admin) বা +8801711111111 (merchant) — পাসওয়ার্ড Atlas#2017"
    : undefined;

  return <LoginForm devHint={devHint} />;
}
