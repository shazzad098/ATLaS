import type { CSSProperties } from "react";
import type { ThemeConfig } from "@/lib/theme-catalog";

/**
 * Maps a merchant `ThemeConfig` onto the `--store-*` custom properties that the
 * section kit and `globals.css` read. Applied once on the storefront shell, so
 * every section inherits the active theme without prop drilling.
 */

export function themeStyle(config: ThemeConfig): CSSProperties {
  const radius =
    config.buttons.style === "pill"
      ? "9999px"
      : config.buttons.style === "square"
        ? "0.125rem"
        : "0.75rem";

  return {
    "--store-primary": config.colors.primary,
    "--store-accent": config.colors.accent,
    "--store-background": config.colors.background,
    "--store-surface": config.colors.surface,
    "--store-text": config.colors.text,
    "--store-muted": config.colors.muted,
    "--store-button-radius": radius,
    "--store-heading-font": config.typography.headingFont === "serif" ? "var(--font-serif)" : "var(--font-sans)",
    "--store-body-font": config.typography.bodyFont === "serif" ? "var(--font-serif)" : "var(--font-sans)",
  } as CSSProperties;
}

/** Section order for the homepage. Falls back to the canonical order. */
export function orderedSections(config: ThemeConfig): ThemeConfig["sections"] {
  return config.sections.filter((section) => section.enabled);
}
