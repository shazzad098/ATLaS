"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type AdminTheme } from "@/lib/display-theme";

/**
 * Light/dark toggle for the admin shell. Writes the `atlas_theme` cookie for
 * future server renders and flips the `admin-dark` class on the shell wrapper
 * right away, so the change is instant without a reload.
 */
export function ThemeToggle({ initial }: { initial: AdminTheme }) {
  const [theme, setTheme] = useState<AdminTheme>(initial);

  function apply(next: AdminTheme) {
    document.getElementById("admin-shell")?.classList.toggle("admin-dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  }

  const base =
    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition";
  const idle = `${base} text-ink-500 hover:text-ink-800`;

  return (
    <div role="group" aria-label="দেখানোর মোড" className="flex rounded-lg border border-ink-200 bg-ink-50 p-1">
      <button
        type="button"
        aria-pressed={theme === "light"}
        onClick={() => apply("light")}
        className={theme === "light" ? `${base} bg-white text-ink-900 shadow-sm` : idle}
      >
        <Sun className="h-3.5 w-3.5" />
        লাইট
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        onClick={() => apply("dark")}
        className={theme === "dark" ? `${base} bg-white text-ink-900 shadow-sm` : idle}
      >
        <Moon className="h-3.5 w-3.5" />
        ডার্ক
      </button>
    </div>
  );
}
