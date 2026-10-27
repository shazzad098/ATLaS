import { HttpException, HttpStatus, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import { queueEnv } from "../config/env";

type Bucket = { count: number; resetAt: number };

// Atomic fixed-window increment: INCR, and PEXPIRE only on the first hit so the
// window never extends past its original expiry.
const INCR_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n
`;

/**
 * Fixed-window login throttle.
 *
 * Backed by Redis when `REDIS_URL` is configured (so the budget is shared across
 * horizontally-scaled API replicas) and falls back to an in-memory map otherwise,
 * which keeps tests and Redis-less deployments working. Keyed by source IP +
 * identifier so one account cannot be brute-forced from a single host and one
 * host cannot spray many accounts.
 */
@Injectable()
export class LoginThrottleService implements OnModuleDestroy {
  private readonly logger = new Logger(LoginThrottleService.name);
  private readonly redis: IORedis | null;
  private readonly memory = new Map<string, Bucket>();
  private lastSweep = Date.now();

  constructor() {
    this.redis = queueEnv.enabled
      ? new IORedis(queueEnv.url, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
      : null;
    this.redis?.on("error", () => {
      // A dead Redis must not take login down; `consume` falls back to memory.
    });
  }

  async consume(key: string, max: number, windowMs: number): Promise<void> {
    if (this.redis) {
      try {
        const count = (await this.redis.eval(INCR_SCRIPT, 1, key, windowMs)) as number;
        if (count > max) this.reject(windowMs);
        return;
      } catch (error) {
        if (error instanceof HttpException) throw error;
        this.logger.warn(`Redis rate limit unavailable, using in-memory fallback: ${String(error)}`);
      }
    }
    this.consumeMemory(key, max, windowMs);
  }

  /** Called after a successful login so a valid user is not blocked by the budget. */
  reset(key: string): void {
    this.memory.delete(key);
    if (this.redis) void this.redis.del(key).catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    this.redis?.disconnect();
  }

  private reject(windowMs: number): never {
    const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: "Too Many Requests",
        message: "Too many sign-in attempts. Please wait a few minutes and try again.",
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private consumeMemory(key: string, max: number, windowMs: number): void {
    const now = Date.now();
    this.sweep(now);

    const bucket = this.memory.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) this.reject(windowMs);
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.memory) {
      if (bucket.resetAt <= now) this.memory.delete(key);
    }
  }
}
