"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CART_COOKIE, CART_TTL_DAYS, addItem, removeItem, setCoupon, updateItem } from "@/lib/services/cart-service";
import { checkoutInputSchema, placeOrder, CheckoutError } from "@/lib/services/checkout-service";
import { AppError } from "@/lib/errors";
import { storePath } from "@/lib/storefront";
import type { ActionState } from "@/app/store/[slug]/state";

/**
 * Storefront server actions (PRD §3.3, FR-05).
 *
 * Cart mutations live here because a Server Action is the only place that may
 * write the cart session cookie. Every action returns a plain result object so
 * client components can show a Bengali message without throwing.
 */

async function cartSessionKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CART_COOKIE)?.value;
  if (existing) return existing;

  const key = randomUUID();
  jar.set(CART_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_TTL_DAYS * 86_400,
  });
  return key;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function refreshStorefront(slug: string, path = "/cart") {
  revalidatePath(storePath(slug, path));
  revalidatePath(storePath(slug, "/cart"));
}

export async function addToCartAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const variantId = text(formData, "variantId");
  const quantity = Number.parseInt(text(formData, "quantity") || "1", 10);

  const storeId = text(formData, "storeId");
  if (!storeId || !variantId) return { ok: false, message: "পণ্য নির্বাচন করা যায়নি।" };

  try {
    const sessionKey = await cartSessionKey();
    await addItem(storeId, sessionKey, { variantId, quantity: Number.isFinite(quantity) ? quantity : 1 });
    refreshStorefront(slug, "/product");
    return { ok: true, message: "কার্টে যোগ হয়েছে।" };
  } catch (error) {
    return { ok: false, message: error instanceof AppError ? error.message : "কার্টে যোগ করা যায়নি।" };
  }
}

export async function updateCartLineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const storeId = text(formData, "storeId");
  const itemId = text(formData, "itemId");
  const quantity = Number.parseInt(text(formData, "quantity") || "1", 10);

  try {
    const sessionKey = await cartSessionKey();
    await updateItem(storeId, sessionKey, itemId, Number.isFinite(quantity) ? quantity : 1);
    refreshStorefront(slug);
    return { ok: true, message: "কার্ট হালনাগাদ হয়েছে।" };
  } catch (error) {
    return { ok: false, message: error instanceof AppError ? error.message : "হালনাগাদ করা যায়নি।" };
  }
}

export async function removeCartLineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const storeId = text(formData, "storeId");
  const itemId = text(formData, "itemId");

  try {
    const sessionKey = await cartSessionKey();
    await removeItem(storeId, sessionKey, itemId);
    refreshStorefront(slug);
    return { ok: true, message: "কার্ট থেকে সরানো হয়েছে।" };
  } catch (error) {
    return { ok: false, message: error instanceof AppError ? error.message : "সরানো যায়নি।" };
  }
}

export async function applyCouponAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");
  const storeId = text(formData, "storeId");
  const code = text(formData, "couponCode").trim();

  try {
    const sessionKey = await cartSessionKey();
    await setCoupon(storeId, sessionKey, code || null);
    refreshStorefront(slug);
    return { ok: true, message: code ? "কুপন প্রয়োগের চেষ্টা হয়েছে।" : "কুপন সরানো হয়েছে।" };
  } catch (error) {
    return { ok: false, message: error instanceof AppError ? error.message : "কুপন প্রয়োগ করা যায়নি।" };
  }
}

/**
 * Progressive-enhancement variants used by Server Component forms (the cart
 * page works with JavaScript disabled). They take only `FormData`.
 */
export async function setLineQuantityFormAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const storeId = text(formData, "storeId");
  const itemId = text(formData, "itemId");
  const quantity = Number.parseInt(text(formData, "quantity") || "1", 10);
  const sessionKey = await cartSessionKey();
  await updateItem(storeId, sessionKey, itemId, Number.isFinite(quantity) ? quantity : 1);
  refreshStorefront(slug);
}

export async function removeLineFormAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const storeId = text(formData, "storeId");
  const itemId = text(formData, "itemId");
  const sessionKey = await cartSessionKey();
  await removeItem(storeId, sessionKey, itemId);
  refreshStorefront(slug);
}

export async function applyCouponFormAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  const storeId = text(formData, "storeId");
  const code = text(formData, "couponCode").trim();
  const sessionKey = await cartSessionKey();
  await setCoupon(storeId, sessionKey, code || null);
  refreshStorefront(slug);
}

export async function submitCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = text(formData, "slug");

  const parsed = checkoutInputSchema.safeParse({
    customerName: text(formData, "customerName"),
    customerPhone: text(formData, "customerPhone"),
    customerEmail: text(formData, "customerEmail"),
    address: {
      line1: text(formData, "addressLine1"),
      line2: text(formData, "addressLine2"),
      area: text(formData, "addressArea"),
      city: text(formData, "addressCity"),
      district: text(formData, "addressDistrict"),
      postcode: text(formData, "addressPostcode"),
    },
    notes: text(formData, "notes"),
    zoneId: text(formData, "zoneId") || null,
    paymentProvider: text(formData, "paymentProvider") || "COD",
    acceptTerms: formData.get("acceptTerms") === "on" ? true : undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "তথ্যগুলো আবার যাচাই করুন।" };
  }

  const sessionKey = await cartSessionKey();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  let redirectTo: string | null = null;

  try {
    const result = await placeOrder({
      storeSlug: slug,
      sessionKey,
      payload: parsed.data,
      idempotencyKey: text(formData, "idempotencyKey") || randomUUID(),
      baseUrl,
    });

    redirectTo = result.payment.redirectUrl ?? storePath(slug, `/order/${result.orderNo}`);
  } catch (error) {
    if (error instanceof CheckoutError || error instanceof AppError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "অর্ডার সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" };
  }

  // A new order must appear immediately in the merchant panel and the platform
  // console, and the customer's order page must show its live status.
  revalidatePath("/store", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/super-admin", "layout");
  redirect(redirectTo);
}
