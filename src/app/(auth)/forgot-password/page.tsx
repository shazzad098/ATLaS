import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { ForgotPasswordForm } from "@/app/(auth)/_components/forgot-password-form";

/** Forgotten password (FR-01). */

export const metadata: Metadata = { title: "পাসওয়ার্ড রিসেট" };

export default async function ForgotPasswordPage() {
  const session = await readSession();
  if (session) redirect(session.user.isSuperAdmin ? "/super-admin" : "/admin");

  return <ForgotPasswordForm />;
}
