/** Admin display theme (light/dark), persisted for the browser in a cookie. */

export const THEME_COOKIE = "atlas_theme";

export type AdminTheme = "light" | "dark";

export function resolveAdminTheme(value: string | undefined | null): AdminTheme {
  return value === "dark" ? "dark" : "light";
}
