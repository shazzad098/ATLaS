import { HttpException } from "@nestjs/common";
import { LoginThrottleService } from "./login-throttle.service";

describe("LoginThrottleService", () => {
  const savedUrl = process.env.REDIS_URL;
  const savedEnabled = process.env.QUEUE_ENABLED;
  let throttle: LoginThrottleService;
  let sequence = 0;
  const key = () => `unit-${Date.now()}-${++sequence}`;

  beforeAll(() => {
    // Exercise the deterministic in-memory path; the Redis path is covered by
    // the e2e suite, which runs against a real Redis.
    delete process.env.REDIS_URL;
    process.env.QUEUE_ENABLED = "false";
  });

  afterAll(() => {
    if (savedUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = savedUrl;
    if (savedEnabled === undefined) delete process.env.QUEUE_ENABLED;
    else process.env.QUEUE_ENABLED = savedEnabled;
  });

  beforeEach(() => {
    throttle = new LoginThrottleService();
  });

  afterEach(async () => {
    await throttle.onModuleDestroy();
  });

  it("allows exactly the configured number of attempts", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(throttle.consume(key(), 3, 60_000)).resolves.toBeUndefined();
    }
  });

  it("rejects the next attempt with 429 and a retry hint", async () => {
    const k = key();
    for (let attempt = 0; attempt < 3; attempt += 1) await throttle.consume(k, 3, 60_000);

    try {
      await throttle.consume(k, 3, 60_000);
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

  it("resets the budget after a successful login", async () => {
    const k = key();
    await throttle.consume(k, 1, 60_000);
    throttle.reset(k);
    await expect(throttle.consume(k, 1, 60_000)).resolves.toBeUndefined();
  });

  it("starts a fresh window once the old one expires", async () => {
    const k = key();
    await throttle.consume(k, 1, 30);
    await expect(throttle.consume(k, 1, 30)).rejects.toBeInstanceOf(HttpException);

    await new Promise((resolve) => setTimeout(resolve, 40));
    await expect(throttle.consume(k, 1, 30)).resolves.toBeUndefined();
  });

  it("keeps budgets separate per key", async () => {
    await throttle.consume(key(), 1, 60_000);
    await expect(throttle.consume(key(), 1, 60_000)).resolves.toBeUndefined();
  });
});
