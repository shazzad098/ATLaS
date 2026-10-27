import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { resolveLandingPath, safeNextPath } from "@/lib/auth/landing";
import { SignupForm } from "@/app/(auth)/_components/signup-form";

/** Merchant signup (FR-01). */

export const metadata: Metadata = { title: "মার্চেন্ট সাইনআপ" };

type SignupPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);

  const session = await readSession();
  if (session) {
    redirect(await resolveLandingPath(session.user.id, session.user.isSuperAdmin, next));
  }

  return <SignupForm next={next} />;
}
