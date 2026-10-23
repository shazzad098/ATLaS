/* Money: all arithmetic in integer poisha (1/100 BDT). DB decimals are strings. */
export const toP = (v: string | number | null | undefined): number => Math.round(Number(v ?? 0) * 100);
export const fromP = (p: number): string => (Math.round(p) / 100).toFixed(2);
export const pctOf = (baseP: number, ratePercent: number): number => Math.round((baseP * ratePercent) / 100);
export const sumP = (values: (string | number | null | undefined)[]): number => values.reduce<number>((s, v) => s + toP(v), 0);
export function fmtBDT(v: string | number): string {
  return "৳" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* Time: Asia/Dhaka is UTC+06:00 with no DST. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export function dhakaDateStr(d: Date = new Date()): string {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}
export function dhakaDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+06:00`);
}
export function monthPeriod(d: Date = new Date()): { start: string; end: string; startAt: Date; endAt: Date } {
  const local = new Date(d.getTime() + DHAKA_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const startAt = dhakaDayStart(start);
  const endAt = new Date(dhakaDayStart(end).getTime() + DAY_MS);
  return { start, end, startAt, endAt };
}
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}
export function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / DAY_MS);
}

/* Errors with a stable code, mapped to tRPC and REST envelopes. */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "FEATURE_NOT_IN_PLAN"
  | "READ_ONLY"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "OUT_OF_STOCK"
  | "INVALID_STATE"
  | "TWO_FACTOR_REQUIRED"
  | "INTERNAL";

export const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  QUOTA_EXCEEDED: 402,
  FEATURE_NOT_IN_PLAN: 402,
  READ_ONLY: 423,
  RATE_LIMITED: 429,
  PAYMENT_FAILED: 402,
  OUT_OF_STOCK: 409,
  INVALID_STATE: 409,
  TWO_FACTOR_REQUIRED: 401,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function fail(code: ErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new AppError(code, message, details);
}

export function assertFound<T>(v: T | null | undefined, what = "Resource"): T {
  if (v === null || v === undefined) fail("NOT_FOUND", `${what} not found`);
  return v;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "item"
  );
}
