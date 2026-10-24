"use client";

import { useEffect, useState } from "react";

/**
 * Flash-deal countdown.
 *
 * Runs client-side only: the server render shows placeholders and the effect
 * fills in the remaining time until midnight, so there is no hydration
 * mismatch and no per-request cache entry.
 */

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function bn(value: number): string {
  return String(value)
    .padStart(2, "0")
    .replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

export function DealCountdown() {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      setSeconds(Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = seconds ?? 0;
  const parts =
    seconds === null
      ? ["--", "--", "--"]
      : [
          bn(Math.floor(remaining / 3600)),
          bn(Math.floor((remaining % 3600) / 60)),
          bn(remaining % 60),
        ];

  return (
    <span className="inline-flex items-center gap-1" aria-label="অফার শেষ হওয়ার সময়">
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          <span
            className="rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums"
            style={{ background: "var(--store-primary)" }}
          >
            {part}
          </span>
          {index < parts.length - 1 ? <span className="text-[11px] font-bold opacity-50">:</span> : null}
        </span>
      ))}
    </span>
  );
}
