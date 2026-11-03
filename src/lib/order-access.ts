import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Capability link for the public order-tracking page.
 *
 * An order number is short and guessable, so it must never be enough on its own
 * to read a customer's name, phone and delivery address. The confirmation URL
 * issued at checkout carries an HMAC-signed token bound to the store, order id
 * and order number; the tracking page also accepts the phone number as a
 * fallback for a customer who lost the link.
 */

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type OrderAccessClaims = {
  storeId: string;
  orderId: string;
  orderNo: string;
  expiresAt: number;
};

type SerializedClaims = {
  v: number;
  sid: string;
  oid: string;
  ono: string;
  exp: number;
};

function sign(payload: string): Buffer {
  return createHmac("sha256", env.authSecret).update(`order-access:${payload}`).digest();
}

export function signOrderAccessToken(input: {
  storeId: string;
  orderId: string;
  orderNo: string;
  expiresInSeconds?: number;
}): string {
  const claims: SerializedClaims = {
    v: TOKEN_VERSION,
    sid: input.storeId,
    oid: input.orderId,
    ono: input.orderNo,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign(payload).toString("base64url");
  return `${payload}.${signature}`;
}

export function verifyOrderAccessToken(token: string | null | undefined): OrderAccessClaims | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = sign(payload);
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SerializedClaims;
    if (claims.v !== TOKEN_VERSION) return null;
    if (
      typeof claims.sid !== "string" ||
      typeof claims.oid !== "string" ||
      typeof claims.ono !== "string" ||
      typeof claims.exp !== "number"
    ) {
      return null;
    }
    if (claims.exp * 1000 < Date.now()) return null;

    return {
      storeId: claims.sid,
      orderId: claims.oid,
      orderNo: claims.ono,
      expiresAt: claims.exp * 1000,
    };
  } catch {
    return null;
  }
}

/** True when the token is valid and belongs to exactly this storefront order. */
export function orderAccessTokenMatches(
  token: string | null | undefined,
  input: { storeId: string; orderNo: string },
): boolean {
  const claims = verifyOrderAccessToken(token);
  return Boolean(claims && claims.storeId === input.storeId && claims.orderNo === input.orderNo);
}
