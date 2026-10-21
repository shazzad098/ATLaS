/**
 * Money helpers.
 *
 * PRD §10.7: money columns are fixed-precision numeric and floating point is
 * never used for money. Arithmetic here therefore runs on integer *paisa*
 * (1 BDT = 100 paisa) via BigInt, so no rounding drift can enter a ledger.
 */

export type MoneyInput = number | string | bigint | { toString(): string } | null | undefined;

const PAISA = 100n;

/** Parse any money-ish value into integer paisa, rounding half away from zero. */
export function toPaisa(value: MoneyInput): bigint {
  if (value === null || value === undefined) return 0n;
  const raw = typeof value === "bigint" ? value.toString() : value.toString().trim();
  if (raw === "" || raw === "NaN") return 0n;

  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const [wholeRaw = "0", fracRaw = ""] = digits.split(".");
  const whole = BigInt(wholeRaw === "" ? "0" : wholeRaw);

  // Keep one extra digit purely to decide the rounding direction.
  const frac3 = (fracRaw + "000").slice(0, 3);
  const fracPaisa = BigInt((fracRaw + "00").slice(0, 2) === "" ? "0" : (fracRaw + "00").slice(0, 2));
  const roundUp = Number(frac3[2] ?? "0") >= 5;

  const total = whole * PAISA + fracPaisa + (roundUp ? 1n : 0n);
  return negative ? -total : total;
}

/** Render integer paisa as a fixed 2-decimal string. */
export function fromPaisa(paisa: bigint): string {
  const negative = paisa < 0n;
  const abs = negative ? -paisa : paisa;
  const whole = abs / PAISA;
  const frac = (abs % PAISA).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Decimal string suitable for a Prisma `Decimal` column. */
export function toDecimalString(value: MoneyInput): string {
  return fromPaisa(toPaisa(value));
}

export function toNumber(value: MoneyInput): number {
  return Number(fromPaisa(toPaisa(value)));
}

export function addMoney(...values: MoneyInput[]): string {
  return fromPaisa(values.reduce<bigint>((acc, v) => acc + toPaisa(v), 0n));
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): string {
  return fromPaisa(toPaisa(a) - toPaisa(b));
}

export function isZero(value: MoneyInput): boolean {
  return toPaisa(value) === 0n;
}

export function compareMoney(a: MoneyInput, b: MoneyInput): -1 | 0 | 1 {
  const left = toPaisa(a);
  const right = toPaisa(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Percentage of a money amount, where `rate` is a fraction (0.025 = 2.5%).
 * The multiplication runs in paisa space with 6 decimal places of precision so
 * that rates like 0.005 stay exact before the final 2dp rounding.
 */
export function rateOf(base: MoneyInput, rate: number | string): string {
  const basePaisa = toPaisa(base);
  // Represent the rate as parts-per-million to stay in integer land.
  const ppm = toPpm(rate);
  const numerator = basePaisa * ppm;
  const denominator = 1_000_000n;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return fromPaisa(rounded);
}

function toPpm(rate: number | string): bigint {
  const raw = typeof rate === "number" ? rate.toString() : rate;
  if (!raw || raw === "NaN") return 0n;
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const [whole = "0", frac = ""] = digits.split(".");
  const frac6 = (frac + "000000").slice(0, 6);
  const ppm = BigInt(whole) * 1_000_000n + BigInt(frac6);
  return negative ? -ppm : ppm;
}

/** `৳1,250.00` — BDT is the only MVP currency (PRD §7, NFR Localization). */
export function formatBdt(value: MoneyInput, options: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = options;
  const decimal = toDecimalString(value);
  const [whole, frac] = decimal.split(".");
  const negative = whole.startsWith("-");
  const grouped = (negative ? whole.slice(1) : whole).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
  return `${negative ? "-" : ""}${withSymbol ? "৳" : ""}${grouped}.${frac}`;
}

/**
 * Fee base for platform overage: discount-adjusted merchandise subtotal,
 * excluding delivery and refunded lines (PRD §5.1 + Appendix B).
 */
export function feeBase(subtotal: MoneyInput, discountTotal: MoneyInput): string {
  const base = toPaisa(subtotal) - toPaisa(discountTotal);
  return fromPaisa(base < 0n ? 0n : base);
}
