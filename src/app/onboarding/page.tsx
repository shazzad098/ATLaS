import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/tenant";
import { readSession } from "@/lib/auth/session";
import { onboardingPath, safeNextPath } from "@/lib/auth/landing";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { OnboardingForm } from "@/app/onboarding/_components/onboarding-form";

/** Onboarding: name the store and pick the first theme (FR-02, FR-06). */

export const metadata: Metadata = { title: "দোকান তৈরি করুন" };

type OnboardingPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;
  const next = safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next);

  // Store setup is a merchant-only step: signed-out visitors authenticate first,
  // and signed-in accounts without a merchant workspace get the gate message.
  const session = await readSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(onboardingPath(next))}`);
  if (session.user.isSuperAdmin) redirect("/super-admin");

  const workspace = await getWorkspace();
  if (!workspace) redirect("/dashboard");
  if (workspace.stores.length > 0) redirect(next);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <OnboardingForm
        ownerName={workspace.user.name ?? ""}
        next={next}
        themes={THEME_CATALOG.map((theme) => ({
          code: theme.code,
          name: theme.name,
          description: theme.description,
          style: theme.style,
          gradient: theme.preview.gradient,
          swatches: theme.preview.swatches,
        }))}
      />
    </div>
  );
}
