"use client";

import { useTransition } from "react";
import { useLocale, useMessages } from "@/components/locale-provider";
import { setLocaleAction } from "@/app/locale-actions";
import { LOCALES, type Locale } from "@/lib/i18n/messages";
import { cn } from "@/lib/cn";

/**
 * Bangla/English UI switch (FR-10).
 *
 * Two submit buttons in one form: the server action stores the choice in the
 * `atlas_locale` cookie and revalidates the root layout, so the whole shell
 * re-renders in the new language without a client-side dictionary.
 */

const LABELS: Record<Locale, string> = { bn: "বাংলা", en: "EN" };

export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const m = useMessages();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => setLocaleAction(formData))}
      className={cn(
        "inline-flex items-center rounded-lg border border-ink-200 bg-white p-0.5",
        pending && "opacity-60",
        className,
      )}
      role="group"
      aria-label={m.common.switchLanguage}
    >
      {LOCALES.map((value) => (
        <button
          key={value}
          type="submit"
          name="locale"
          value={value}
          aria-pressed={locale === value}
          disabled={pending}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
            locale === value
              ? "bg-brand-600 text-white"
              : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
          )}
        >
          {LABELS[value]}
        </button>
      ))}
    </form>
  );
}
