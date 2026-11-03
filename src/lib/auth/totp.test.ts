import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hotp,
  normalizeRecoveryCode,
  totp,
  verifyTotp,
} from "./totp.ts";

/** RFC 4226 test secret: the ASCII string "12345678901234567890". */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("base32 round-trips binary data", () => {
  const buffer = Buffer.from("atlas-2fa-secret", "utf8");
  assert.deepEqual(base32Decode(base32Encode(buffer)), buffer);
  assert.equal(base32Encode(Buffer.from("f")), "MY");
  assert.equal(base32Encode(Buffer.from("fo")), "MZXQ");
  assert.equal(base32Encode(Buffer.from("foo")), "MZXW6");
});

test("HOTP matches the RFC 4226 vectors", () => {
  assert.equal(hotp(RFC_SECRET, 0), "755224");
  assert.equal(hotp(RFC_SECRET, 1), "287082");
  assert.equal(hotp(RFC_SECRET, 2), "359152");
});

test("TOTP uses 30-second steps and matches the 8-digit RFC 6238 vector", () => {
  assert.equal(hotp(RFC_SECRET, 1, 8), "94287082");
  assert.equal(totp(RFC_SECRET, new Date(59_000)), "287082");
  assert.equal(totp(RFC_SECRET, new Date(59_000)), hotp(RFC_SECRET, 1));
});

test("verifyTotp accepts one step of clock drift and rejects the rest", () => {
  const at = new Date(59_000);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, 1), { at }), true);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, 0), { at }), true);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, 2), { at }), true);
  assert.equal(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, 3), { at }), false);
  assert.equal(verifyTotp(RFC_SECRET, "000000", { at }), false);
  assert.equal(verifyTotp(RFC_SECRET, "12345", { at }), false);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", { at }), false);
});

test("generated secrets decode to 20 bytes of entropy", () => {
  const secret = generateTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(secret).length, 20);
  assert.notEqual(generateTotpSecret(), secret);
});

test("recovery codes are unique xxxx-xxxx tokens", () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    assert.match(code, /^[a-z2-9]{4}-[a-z2-9]{4}$/);
  }
});

test("recovery-code normalisation ignores case and separators", () => {
  assert.equal(normalizeRecoveryCode(" ABcd-EF23 "), "abcdef23");
  assert.equal(normalizeRecoveryCode("abcd ef23"), "abcdef23");
});
