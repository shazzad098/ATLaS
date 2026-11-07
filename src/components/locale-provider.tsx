"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, messages, type Locale, type Messages } from "@/lib/i18n/messages";

/**
 * Locale context for client components. The provider receives only the locale
 * string from the server layout (serialisable); dictionaries are imported
 * directly by the client bundle.
 */

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return messages[useContext(LocaleContext)];
}
