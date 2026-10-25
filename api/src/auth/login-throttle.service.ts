import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window login throttle.
 *
 * Keyed by source IP + identifier so one account cannot be brute-forced from a
 * single host, and a single host cannot spray many accounts. In-memory means it
 * resets on deploy and is per-replica; the Redis/BullMQ step replaces this with
 * a shared store for multi-instance deployments.
 */
@Injectable()
export class LoginThrottleService {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  consume(key: string, max: number, windowMs: number): void {
    const now = Date.now();
    this.sweep(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
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
  }

  /** Called after a successful login so a valid user is not blocked by the budget. */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Drop expired buckets periodically so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
