import {
  generateCsrfToken,
  generateRefreshToken,
  hashRefreshToken,
  normalizePhone,
} from "./tokens";

describe("auth tokens", () => {
  it("normalises Bangladeshi phone numbers to E.164", () => {
    expect(normalizePhone("01700000000")).toBe("+8801700000000");
    expect(normalizePhone("+8801700000000")).toBe("+8801700000000");
    expect(normalizePhone("8801700000000")).toBe("+8801700000000");
    expect(normalizePhone("1700000000")).toBe("+8801700000000");
    expect(normalizePhone("01700-000000")).toBe("+8801700000000");
  });

  it("generates unique, URL-safe refresh tokens", () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first).not.toBe(second);
    expect(first).toHaveLength(43);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateCsrfToken()).toHaveLength(32);
  });

  it("hashes refresh tokens deterministically as sha256 hex", () => {
    const token = generateRefreshToken();
    const hash = hashRefreshToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken(token)).toBe(hash);
    expect(hashRefreshToken(`${token}x`)).not.toBe(hash);
  });
});
