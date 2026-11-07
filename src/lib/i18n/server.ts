import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  messages,
  normalizeLocale,
  type Locale,
  type Messages,
} from "@/lib/i18n/messages";

/** Server-only locale helpers. Client components use `useMessages()`. */

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}

export async function getMessages(): Promise<{ locale: Locale; m: Messages }> {
  const locale = await getLocale();
  return { locale, m: messages[locale] };
}
