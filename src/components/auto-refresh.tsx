"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EDITABLE = "input, textarea, select, [contenteditable='true']";

/**
 * Keeps DB-backed screens live without a websocket: re-renders the current
 * server component tree on an interval. A purchase made on the storefront then
 * shows up in the merchant panel (and in the platform console) without a manual
 * reload. The tick is skipped while the user is editing a field or the tab is
 * hidden, so auto-refresh can never wipe half-typed input.
 */
export function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest(EDITABLE)) return;
      if (document.querySelector("[data-live-pause='true']")) return;
      router.refresh();
    };

    const timer = window.setInterval(tick, intervalMs);
    // Switching back to the tab should show new orders immediately, not after
    // the next interval tick.
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, router]);

  return null;
}
