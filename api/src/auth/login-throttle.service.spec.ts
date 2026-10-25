import { HttpException } from "@nestjs/common";
import { LoginThrottleService } from "./login-throttle.service";

describe("LoginThrottleService", () => {
  let throttle: LoginThrottleService;

  beforeEach(() => {
    throttle = new LoginThrottleService();
  });

  it("allows exactly the configured number of attempts", () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(() => throttle.consume("k", 3, 60_000)).not.toThrow();
    }
  });

  it("rejects the next attempt with 429 and a retry hint", () => {
    for (let attempt = 0; attempt < 3; attempt += 1) throttle.consume("k", 3, 60_000);

    try {
      throttle.consume("k", 3, 60_000);
      throw new Error("expected the throttle to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const http = error as HttpException;
      expect(http.getStatus()).toBe(429);
      expect(http.getResponse()).toMatchObject({
        message: expect.stringContaining("Too many sign-in attempts"),
      });
    }
  });

  it("resets the budget after a successful login", () => {
    throttle.consume("k", 1, 60_000);
    throttle.reset("k");
    expect(() => throttle.consume("k", 1, 60_000)).not.toThrow();
  });

  it("starts a fresh window once the old one expires", async () => {
    throttle.consume("k", 1, 30);
    expect(() => throttle.consume("k", 1, 30)).toThrow(HttpException);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(() => throttle.consume("k", 1, 30)).not.toThrow();
  });

  it("keeps budgets separate per key", () => {
    throttle.consume("a", 1, 60_000);
    expect(() => throttle.consume("b", 1, 60_000)).not.toThrow();
  });
});
