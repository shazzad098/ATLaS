/**
 * Next.js instrumentation hook (server runtime).
 *
 * Two jobs:
 *
 *  1. `register()` validates the mandatory secrets once at boot, so a
 *     misconfigured deployment fails immediately instead of throwing inside the
 *     first payment or login request.
 *  2. `onRequestError()` catches errors thrown while rendering a Server
 *     Component, a route handler or a server action that the per-route
 *     `route()` wrapper never saw. They are logged as structured JSON and
 *     forwarded to Sentry when `SENTRY_DSN` is set.
 */

import { env, sandboxMode } from "@/lib/env";
import { log, reportError } from "@/lib/logger";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (env.isProduction) {
    // Throws when a required secret is missing; the container then restarts
    // with a clear boot error instead of serving broken requests.
    void env.authSecret;
    void env.otpHashSecret;
    void env.secretsKey;
    if (!env.cronSecret) {
      log("warn", "CRON_SECRET is not set; scheduled jobs will reject every call");
    }
  }

  log("info", "atlas.boot", {
    node: process.version,
    env: process.env.NODE_ENV ?? "development",
    sandbox: {
      sms: sandboxMode.sms,
      email: sandboxMode.email,
      bkash: sandboxMode.bkash,
      nagad: sandboxMode.nagad,
      sslcommerz: sandboxMode.sslcommerz,
    },
  });
}

type RequestInfo = {
  path: string;
  method: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  context: ErrorContext,
): Promise<void> {
  reportError(error, {
    scope: "next.request",
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    routeType: context?.routeType,
  });
}
