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
