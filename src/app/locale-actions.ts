"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE, LOCALE_MAX_AGE_SECONDS } from "@/lib/i18n/messages";

/** Persist the UI language and re-render every server layout with it. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const value = formData.get("locale");
  if (!isLocale(value)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: LOCALE_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath("/", "layout");
}
