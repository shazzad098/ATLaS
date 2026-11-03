import { addDays, addMonths, endOfMonth, startOfMonth } from "date-fns";

/** Platform timezone/currency defaults (PRD Appendix B). */
export const PLATFORM_TIMEZONE = "Asia/Dhaka";
export const PLATFORM_CURRENCY = "BDT";

export { addDays, addMonths, startOfMonth, endOfMonth };

export function monthBounds(reference: Date = new Date()) {
  return { start: startOfMonth(reference), end: endOfMonth(reference) };
}

/** Billing periods advance in whole months from the subscription anchor day. */
export function nextPeriodEnd(from: Date, months = 1): Date {
  return addMonths(from, months);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

export function daysRemaining(target: Date | null | undefined): number | null {
  if (!target) return null;
  return daysBetween(new Date(), target);
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PLATFORM_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** "২ মিনিট আগে" — used by the Super Admin sync badge. */
export function formatRelativeBn(value: Date | string | null | undefined, now: Date = new Date()): string {
  if (!value) return "কখনো সিঙ্ক হয়নি";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = now.getTime() - date.getTime();
  if (Number.isNaN(diffMs)) return "—";
  if (diffMs < 60_000) return "এইমাত্র";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${bnNumber(minutes)} মিনিট আগে`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${bnNumber(hours)} ঘণ্টা আগে`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${bnNumber(days)} দিন আগে`;

  return formatDate(date);
}

// ── Chart label helpers (Asia/Dhaka buckets) ─────────────────────────────────

const dhakaDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PLATFORM_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-22" style key for Asia/Dhaka — chart day-bucketing. */
export function dhakaDateKey(value: Date): string {
  return dhakaDayFormatter.format(value);
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const BN_MONTHS_SHORT = [
  "জানু",
  "ফেব্রু",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টে",
  "অক্টো",
  "নভে",
  "ডিসে",
];

export function bnNumber(value: number): string {
  return String(value).replace(/[0-9]/g, (digit) => BN_DIGITS[Number(digit)]);
}

/** "2026-10-22" → "২২ অক্টো" */
export function bnDayLabel(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${bnNumber(Number(day))} ${BN_MONTHS_SHORT[Number(month) - 1]}`;
}

/** Order number: stable, sortable, and unique per store (PRD §10.7). */
export function buildOrderNo(date: Date = new Date()): string {
  const stamp = date.toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `AT-${stamp}-${random}`;
}

/** Invoice numbers are sequential per platform, not per tenant. */
export function buildInvoiceNumber(sequence: number, date: Date = new Date()): string {
  return `INV-${date.getFullYear()}-${sequence.toString().padStart(6, "0")}`;
}
