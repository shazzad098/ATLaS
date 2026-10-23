import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { InitiateContext, PaymentProviderName } from "@/lib/payments/types";

/**
 * Sandbox gateway simulator.
 *
 * With no provider credentials configured, `initiate()` sends the shopper to
 * `/pay/sandbox`, which posts a *real* callback to the *real* webhook endpoint
 * signed with a sandbox secret. This keeps the callback, idempotency and
 * reconciliation paths under test before live credentials exist (PRD §17).
 */

export const SANDBOX_SIGNATURE_HEADER = "x-atlas-sandbox-signature";

export function signSandboxPayload(rawBody: string): string {
  return createHmac("sha256", env.authSecret).update(`sandbox:${rawBody}`).digest("hex");
}

export function verifySandboxSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signSandboxPayload(rawBody), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length === 0 || expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function sandboxCheckoutUrl(
  context: InitiateContext,
  provider: PaymentProviderName,
): string {
  const origin = new URL(context.successUrl).origin;
  const url = new URL("/pay/sandbox", origin);
  url.searchParams.set("provider", provider);
  url.searchParams.set("orderNo", context.orderNo);
  url.searchParams.set("amount", context.amount);
  url.searchParams.set("callback", context.callbackUrl);
  url.searchParams.set("return", context.successUrl);
  return url.toString();
}

export function sandboxTxnId(prefix: string, orderNo: string): string {
  return `${prefix}SBX${orderNo.replace(/[^A-Za-z0-9]/g, "")}${Date.now().toString(36).toUpperCase()}`;
}
