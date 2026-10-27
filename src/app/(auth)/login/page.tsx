import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { resolveLandingPath, safeNextPath } from "@/lib/auth/landing";
import { sandboxMode } from "@/lib/env";
import { LoginForm } from "@/app/(auth)/_components/login-form";

/** Login (FR-01). */

export const metadata: Metadata = { title: "লগইন" };

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);

  const session = await readSession();
  if (session) {
    redirect(await resolveLandingPath(session.user.id, session.user.isSuperAdmin, next));
  }

  const devHint = sandboxMode.sms
    ? "ডেভেলপমেন্ট: +8801700000000 (super admin) — পাসওয়ার্ড Atlas#2017"
    : undefined;

  return <LoginForm devHint={devHint} next={next} />;
}
