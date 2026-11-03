import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { readChallengeToken } from "@/lib/auth/two-factor";
import { TwoFactorLoginForm } from "@/app/(auth)/_components/two-factor-login-form";

/** Second-factor step (FR-01). Reachable only with a live challenge cookie. */
export const metadata: Metadata = { title: "দুই-ধাপ যাচাই" };

export default async function TwoFactorLoginPage() {
  const session = await readSession();
  if (session) redirect(session.user.isSuperAdmin ? "/super-admin" : "/admin");

  const token = await readChallengeToken();
  if (!token) redirect("/login");

  return <TwoFactorLoginForm />;
}
