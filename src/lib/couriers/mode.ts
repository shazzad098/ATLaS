import { env } from "@/lib/env";
import { CourierAdapterError, type CourierMode, type CourierProviderName } from "@/lib/couriers/types";

/**
 * Resolve sandbox vs live for a provider.
 *
 * `COURIER_MODE=auto` (default) goes live only when that provider has
 * credentials. `sandbox` forces simulation; `live` fails loudly if credentials
 * are missing so a production misconfiguration is never silently simulated.
 */
export function resolveCourierMode(provider: CourierProviderName, configured: boolean): CourierMode {
  const forced = env.courier.mode.trim().toLowerCase();
  if (forced === "sandbox") return "sandbox";
  if (forced === "live") {
    if (!configured) {
      throw new CourierAdapterError(
        `${provider} এর live credentials সেট করা নেই। .env-এ API key যোগ করুন অথবা COURIER_MODE=sandbox দিন।`,
        provider,
        { missingCredentials: true },
      );
    }
    return "live";
  }
  return configured ? "live" : "sandbox";
}
