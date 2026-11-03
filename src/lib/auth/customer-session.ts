import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Storefront buyer session (FR-08).
 *
 * Each store has its own buyer accounts, so the cookie carries the store id and
 * is only accepted on that storefront: the same browser can stay signed in on
 * one merchant site without leaking into another. The token is a small JWT in
 * an HttpOnly cookie — no client-side JS can read it.
 */

const BUYER_COOKIE = "atlas_buyer";
const BUYER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type BuyerIdentity = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

async function signBuyerToken(customerId: string, storeId: string): Promise<string> {
  return new SignJWT({ storeId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(customerId)
    .setIssuedAt()
    .setIssuer("atlas")
    .setAudience("atlas-buyer")
    .setExpirationTime(`${BUYER_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function establishBuyerSession(customerId: string, storeId: string): Promise<void> {
  const token = await signBuyerToken(customerId, storeId);
  const jar = await cookies();
  jar.set(BUYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BUYER_TTL_SECONDS,
  });
}

export async function clearBuyerSession(): Promise<void> {
  const jar = await cookies();
  jar.set(BUYER_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * Resolve the signed-in buyer for one storefront. Deduped per request so the
 * layout and the page share a single query.
 */
export const readBuyerSession = cache(async (storeId: string): Promise<BuyerIdentity | null> => {
  const jar = await cookies();
  const token = jar.get(BUYER_COOKIE)?.value;
  if (!token) return null;

  let customerId: string;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "atlas",
      audience: "atlas-buyer",
    });
    if (typeof payload.sub !== "string") return null;
    if (payload.storeId !== storeId) return null;
    customerId = payload.sub;
  } catch {
    return null;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId, status: "ACTIVE", isBlacklisted: false },
    select: { id: true, name: true, email: true, phone: true },
  });
  return customer;
});
