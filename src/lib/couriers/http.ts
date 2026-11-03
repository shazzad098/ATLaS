import { CourierAdapterError, type CourierProviderName } from "@/lib/couriers/types";

/** JSON request helper with a hard timeout so a stuck courier API can't hang a request. */
export async function courierFetchJson(
  provider: CourierProviderName,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new CourierAdapterError(
      `${provider} API-তে পৌঁছানো যায়নি: ${error instanceof Error ? error.message : "network error"}`,
      provider,
      { url },
    );
  }

  const body = await response.text();
  let parsed: unknown = {};
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    parsed = { raw: body.slice(0, 500) };
  }

  if (!response.ok) {
    throw new CourierAdapterError(
      `${provider} API ${response.status}: ${body.slice(0, 240) || "empty response"}`,
      provider,
      { url, status: response.status, body: parsed },
    );
  }

  return parsed;
}
