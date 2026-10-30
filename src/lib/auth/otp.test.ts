import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOtpCode, verifyOtp } from "./otp.ts";

test("normalizes English and Bengali OTP digits", () => {
  assert.equal(normalizeOtpCode("012345"), "012345");
  assert.equal(normalizeOtpCode("০১২৩৪৫"), "012345");
});

test("rejects OTPs that are not exactly six digits", async () => {
  assert.deepEqual(await verifyOtp("+8801712345678", "12345", { purpose: "SIGNUP" }), {
    ok: false,
    reason: "MISMATCH",
  });
});
