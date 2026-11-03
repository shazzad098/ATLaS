/**
 * Structured logging + optional error reporting.
 *
 * No SDK dependency: logs are newline-delimited JSON (ingestible by Vercel,
 * Datadog, Loki, etc.) and `SENTRY_DSN` is used directly through Sentry's store
 * endpoint when configured. Reporting is always best-effort — observability must
 * never fail the request it is describing.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function redact(context: LogContext): LogContext {
  const blocked = /password|secret|token|authorization|cookie|card|otp/i;
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      blocked.test(key) ? "[redacted]" : value,
    ]),
  );
}

export function log(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    service: "atlas",
    ...redact(context),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function sentryEnvelope(error: unknown, context: LogContext) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const url = new URL(dsn);
    const key = url.username;
    const project = url.pathname.replace(/^\//, "");
    if (!key || !project) return;

    const err = error instanceof Error ? error : new Error(String(error));
    const frames = (err.stack ?? "")
      .split("\n")
      .slice(1, 20)
      .map((line) => ({ filename: line.trim() }));

    const payload = {
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      message: err.message,
      exception: {
        values: [
          {
            type: err.name,
            value: err.message,
            stacktrace: { frames },
          },
        ],
      },
      tags: { service: "atlas" },
      extra: redact(context),
    };

    void fetch(`${url.origin}/api/${project}/store/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${key}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    }).catch(() => undefined);
  } catch {
    // Never let telemetry configuration break the app.
  }
}

/** Logs an error and forwards it to Sentry when `SENTRY_DSN` is set. */
export function reportError(error: unknown, context: LogContext = {}): void {
  log("error", error instanceof Error ? error.message : String(error), {
    ...context,
    errorName: error instanceof Error ? error.name : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  });
  sentryEnvelope(error, context);
}

/** Simple timer helper for slow-path logging. */
export function stopwatch() {
  const startedAt = Date.now();
  return {
    elapsed: () => Date.now() - startedAt,
    done: (message: string, context: LogContext = {}) =>
      log("info", message, { ...context, durationMs: Date.now() - startedAt }),
  };
}
