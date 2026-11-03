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

/** Sandbox checkout links expire so an old URL cannot settle an order later. */
const SANDBOX_TOKEN_TTL_SECONDS = 60 * 60;

type SandboxClaims = {
  v: number;
  oid: string;
  ono: string;
  provider: PaymentProviderName;
  exp: number;
};

export type SandboxOrderClaims = {
  orderId: string;
  orderNo: string;
  provider: PaymentProviderName;
  expiresAt: number;
};

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

function signSandboxToken(payload: string): Buffer {
  return createHmac("sha256", env.authSecret).update(`sandbox-order:${payload}`).digest();
}

/**
 * Short-lived, unguessable token embedded in the simulated checkout URL. The
 * simulator only accepts an order that was actually routed here by `initiate()`
 * for an unconfigured provider, which keeps the public action from being a
 * "mark any order paid" endpoint.
 */
export function signSandboxOrderToken(input: {
  orderId: string;
  orderNo: string;
  provider: PaymentProviderName;
  expiresInSeconds?: number;
}): string {
  const claims: SandboxClaims = {
    v: 1,
    oid: input.orderId,
    ono: input.orderNo,
    provider: input.provider,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? SANDBOX_TOKEN_TTL_SECONDS),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signSandboxToken(payload).toString("base64url")}`;
}

export function verifySandboxOrderToken(
  token: string | null | undefined,
): SandboxOrderClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = signSandboxToken(payload);
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SandboxClaims;
    if (claims.v !== 1 || typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) {
      return null;
    }
    if (typeof claims.oid !== "string" || typeof claims.ono !== "string") return null;
    if (claims.provider !== "BKASH" && claims.provider !== "NAGAD" && claims.provider !== "SSLCOMMERZ") {
      return null;
    }
    return {
      orderId: claims.oid,
      orderNo: claims.ono,
      provider: claims.provider,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    return null;
  }
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
  url.searchParams.set(
    "t",
    signSandboxOrderToken({
      orderId: context.orderId,
      orderNo: context.orderNo,
      provider,
    }),
  );
  return url.toString();
}

export function sandboxTxnId(prefix: string, orderNo: string): string {
  return `${prefix}SBX${orderNo.replace(/[^A-Za-z0-9]/g, "")}${Date.now().toString(36).toUpperCase()}`;
}
