import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { SignupForm } from "@/app/(auth)/_components/signup-form";

/** Signup (FR-01). */

export const metadata: Metadata = { title: "সাইনআপ" };

export default async function SignupPage() {
  const session = await readSession();
  if (session) redirect(session.user.isSuperAdmin ? "/super-admin" : "/admin");

  return <SignupForm />;
}
