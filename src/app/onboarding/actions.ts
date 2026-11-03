"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { STORE_COOKIE, getWorkspace } from "@/lib/tenant";
import { createStore } from "@/lib/services/store-service";
import { getThemeEntry } from "@/lib/theme-catalog";
import { recordAudit } from "@/lib/audit";
import type { OnboardingState } from "@/app/onboarding/state";

/** First-store creation, the last step of signup (FR-02). */

const TERMS_VERSION = "v1";

export async function createFirstStoreAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const themeCode = String(formData.get("themeCode") ?? "nokshi");
  const locale = formData.get("locale") === "en" ? "en" : "bn";
  const acceptedTerms = formData.get("acceptTerms") === "on";

  // The checkbox is a real consent gate, not decoration: direct action calls
  // without it must not create a store.
  if (!acceptedTerms) {
    return { ok: false, message: "দোকান তৈরি করতে শর্তাবলীতে সম্মতি দিন।" };
  }

  let storeId: string;
  try {
    const store = await createStore(workspace.actor, {
      name,
      slug: slug || undefined,
      description,
      themeCode: getThemeEntry(themeCode) ? themeCode : "nokshi",
      locale,
    });
    storeId = store.id;
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    return { ok: false, message: "দোকান তৈরি করা যায়নি। আবার চেষ্টা করুন।" };
  }

  await recordAudit({
    action: "store.terms_accepted",
    tenantId: workspace.actor.tenantId,
    actorId: workspace.actor.userId,
    resourceType: "Store",
    resourceId: storeId,
    metadata: { termsVersion: TERMS_VERSION, acceptedAt: new Date().toISOString() },
  });

  const jar = await cookies();
  jar.set(STORE_COOKIE, storeId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });

  redirect("/admin");
}
