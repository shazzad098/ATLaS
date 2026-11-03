import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidBdPhone, normalizeOtpCode, normalizePhone } from "./phone.ts";

test("accepts English-digit Bangladesh mobile numbers", () => {
  assert.equal(normalizePhone("01712345678"), "+8801712345678");
  assert.equal(isValidBdPhone("01712345678"), true);
});

test("normalizes Bengali digits to the same canonical phone number", () => {
  assert.equal(normalizePhone("০১৭১২৩৪৫৬৭৮"), "+8801712345678");
  assert.equal(isValidBdPhone("০১৭১২৩৪৫৬৭৮"), true);
});

test("accepts international and formatted Bangladesh phone numbers", () => {
  assert.equal(normalizePhone("+880 1712-345678"), "+8801712345678");
  assert.equal(normalizePhone("8801712345678"), "+8801712345678");
  assert.equal(normalizePhone("008801712345678"), "+8801712345678");
  assert.equal(normalizePhone("+88001712345678"), "+8801712345678");
  assert.equal(normalizePhone("1712345678"), "+8801712345678");
  assert.equal(isValidBdPhone("+880 1712-345678"), true);
});

test("rejects malformed or unsupported Bangladesh mobile numbers", () => {
  assert.equal(isValidBdPhone("0171234567"), false);
  assert.equal(isValidBdPhone("01212345678"), false);
  assert.equal(isValidBdPhone("9876543210"), false);
});

test("normalizes OTP codes typed with Bengali digits or pasted from SMS", () => {
  assert.equal(normalizeOtpCode("১২৩৪৫৬"), "123456");
  assert.equal(normalizeOtpCode(" 12 34 56 "), "123456");
  assert.equal(normalizeOtpCode("ATLaS verification code: 654321."), "654321");
});

test("keeps the code, not trailing digits, when a whole SMS is pasted", () => {
  assert.equal(
    normalizeOtpCode("ATLaS verification code: 654321. ৫ মিনিটের মধ্যে ব্যবহার করুন।"),
    "654321",
  );
  // A seven-digit run is not silently trimmed to six digits.
  assert.equal(normalizeOtpCode("1234567"), "");
});
