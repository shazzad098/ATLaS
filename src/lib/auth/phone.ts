const NON_LATIN_DIGIT_SETS = ["০১২৩৪৫৬৭৮৯", "٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹"];
const DIGIT_MAP = new Map(
  NON_LATIN_DIGIT_SETS.flatMap((digits) => [...digits].map((digit, index) => [digit, String(index)])),
);

/** Convert common locale digits to ASCII so validation is keyboard/layout agnostic. */
export function toAsciiDigits(input: string): string {
  return input.normalize("NFKC").replace(/[০-৯٠-٩۰-۹]/g, (digit) => DIGIT_MAP.get(digit) ?? digit);
}

/**
 * 6-digit OTP as ASCII, including Bengali/Arabic numerals or a pasted SMS
 * snippet. The SMS text carries other digits (a "৫" in the Bangla sentence,
 * sender references), so the first standalone six-digit group wins instead of
 * blindly keeping the last six digits.
 */
export function normalizeOtpCode(input: string): string {
  const ascii = toAsciiDigits(input);
  const group = /(?<!\d)\d{6}(?!\d)/.exec(ascii);
  if (group) return group[0];
  const digits = ascii.replace(/\D/g, "");
  return digits.length === 6 ? digits : "";
}

/**
 * Normalize Bangladesh mobile formats such as 01712345678,
 * +8801712345678, 8801712345678, or Bengali-digit equivalents.
 */
export function normalizePhone(input: string): string {
  const digits = toAsciiDigits(input).replace(/[^\d+]/g, "");
  const international = digits.replace(/^\+/, "").replace(/^00(?=880)/, "");
  const bare = international.replace(/^8800(?=1[3-9]\d{8}$)/, "880");

  if (/^01[3-9]\d{8}$/.test(bare)) return `+88${bare}`;
  if (/^8801[3-9]\d{8}$/.test(bare)) return `+${bare}`;
  if (/^1[3-9]\d{8}$/.test(bare)) return `+880${bare}`;
  return `+${bare}`;
}

export function isValidBdPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^\+8801[3-9]\d{8}$/.test(normalized);
}
