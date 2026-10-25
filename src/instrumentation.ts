/**
 * Next.js server instrumentation.
 *
 * Runs once per server process, before the app starts handling requests:
 *  1. `assertRuntimeEnv()` refuses to boot production with dev defaults
 *     (weak/missing secrets, sandbox SMS, http app URL).
 *  2. Sentry initialises when `SENTRY_DSN` is set; without a DSN every call is a
 *     no-op, so local development never needs an account.
 */

export async function register(): Promise<void> {
  const { assertRuntimeEnv } = await import("@/lib/env");
  assertRuntimeEnv();

  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    // Errors are always captured; tracing is sampled so it stays affordable.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  });
}

/** Forward unhandled server request errors to Sentry (no-op without a DSN). */
export async function onRequestError(
  ...args: Parameters<NonNullable<import("next").Instrumentation.onRequestError>>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
