import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/tenant";
import { THEME_CATALOG } from "@/lib/theme-catalog";
import { OnboardingForm } from "@/app/onboarding/_components/onboarding-form";

/** Onboarding: name the store and pick the first theme (FR-02, FR-06). */

export const metadata: Metadata = { title: "দোকান তৈরি করুন" };

export default async function OnboardingPage() {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  if (workspace.stores.length > 0) redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <OnboardingForm
        ownerName={workspace.user.name ?? ""}
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
