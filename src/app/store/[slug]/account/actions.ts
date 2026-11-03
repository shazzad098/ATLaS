"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/api";
import { normalizePhone } from "@/lib/auth/phone";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import {
  clearBuyerSession,
  establishBuyerSession,
  readBuyerSession,
} from "@/lib/auth/customer-session";
import { getStorefrontContext, storePath } from "@/lib/storefront";
import {
  addReviewComment,
  authenticateBuyer,
  buyerLoginSchema,
  buyerProfileSchema,
  buyerSignupSchema,
  changeBuyerPassword,
  createBuyerAccount,
  deleteBuyerReview,
  reviewSchema,
  saveBuyerReview,
  toggleWishlist,
  updateBuyerProfile,
} from "@/lib/services/customer-account";
import type { BuyerState } from "@/app/store/[slug]/account/state";

/**
 * Buyer account server actions.
 *
 * Every mutation resolves the store from the trusted slug and the buyer from the
 * signed session cookie — never from a form field. Signup proves ownership of
 * the phone number with the same OTP pipeline the merchant login uses, so a
 * guest's order history cannot be claimed by someone else.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function message(error: unknown, fallback: string): BuyerState {
  if (error instanceof AppError) return { ok: false, message: error.message };
  if (error instanceof Error && error.message) return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

/** Only allow redirects back into this storefront (no open redirects). */
function safeNext(slug: string, next: string): string {
  const fallback = storePath(slug, "/account");
  if (!next.startsWith(storePath(slug, "/"))) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}

async function clientIp(): Promise<string | undefined> {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    undefined
  );
}

export async function buyerSignupAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const context = await getStorefrontContext(slug);
  if (!context) return { ok: false, message: "দোকান পাওয়া যায়নি।" };

  const parsed = buyerSignupSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "তথ্যগুলো যাচাই করুন।" };
  }

  const code = text(formData, "code").trim();
  const storeId = context.store.id;
  const purpose = `BUYER_SIGNUP:${storeId}`;
  const phone = normalizePhone(parsed.data.phone);

  try {
    if (!code) {
      rateLimit(`buyer-signup:${storeId}:${phone}`, 5);
      const existing = await authenticateGuard(storeId, phone);
      if (existing) {
        return {
          ok: false,
          message: "এই নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে। লগইন করুন।",
        };
      }

      const otp = await requestOtp(phone, { purpose, ip: await clientIp() });
      return {
        ok: true,
        stage: "code",
        message: `OTP পাঠানো হয়েছে (${otp.sentVia === "sms" ? "SMS" : "ডেমো মোড"})। ৫ মিনিটের মধ্যে কোড দিন।`,
        devCode: otp.devCode,
      };
    }

    const verified = await verifyOtp(phone, code, { purpose });
    if (!verified.ok) {
      return {
        ok: false,
        stage: "code",
        message:
          verified.reason === "EXPIRED"
            ? "OTP-এর সময় শেষ। আবার কোড পাঠান।"
            : verified.reason === "LOCKED"
              ? "অনেকবার ভুল হয়েছে। আবার কোড পাঠান।"
              : "OTP মেলেনি। আবার চেষ্টা করুন।",
      };
    }

    const account = await createBuyerAccount(storeId, parsed.data);
    await establishBuyerSession(account.id, storeId);
  } catch (error) {
    return message(error, "অ্যাকাউন্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।");
  }

  redirect(storePath(slug, "/account"));
}

/** Login-only guard used to avoid sending an SMS for an existing account. */
async function authenticateGuard(storeId: string, phone: string): Promise<boolean> {
  const existing = await prisma.customer.findUnique({
    where: { storeId_phone: { storeId, phone } },
    select: { passwordHash: true },
  });
  return Boolean(existing?.passwordHash);
}

export async function buyerLoginAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const context = await getStorefrontContext(slug);
  if (!context) return { ok: false, message: "দোকান পাওয়া যায়নি।" };

  const parsed = buyerLoginSchema.safeParse({
    identifier: text(formData, "identifier"),
    password: text(formData, "password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "তথ্যগুলো যাচাই করুন।" };
  }

  const storeId = context.store.id;
  const next = safeNext(slug, text(formData, "next"));

  try {
    rateLimit(`buyer-login:${storeId}:${parsed.data.identifier.toLowerCase()}`, 10);
    const account = await authenticateBuyer(storeId, parsed.data.identifier, parsed.data.password);
    await establishBuyerSession(account.id, storeId);
  } catch (error) {
    return message(error, "লগইন করা যায়নি। আবার চেষ্টা করুন।");
  }

  redirect(next);
}

export async function buyerLogoutAction(formData: FormData): Promise<void> {
  const slug = text(formData, "slug");
  await clearBuyerSession();
  redirect(storePath(slug, "/account/login"));
}

async function requireBuyer(slug: string) {
  const context = await getStorefrontContext(slug);
  if (!context) throw new AppError("NOT_FOUND", "দোকান পাওয়া যায়নি।", 404);
  const buyer = await readBuyerSession(context.store.id);
  if (!buyer) {
    redirect(storePath(slug, "/account/login"));
  }
  return { context, buyer };
}

export async function updateBuyerProfileAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const { context, buyer } = await requireBuyer(slug);

  const parsed = buyerProfileSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    address: {
      line1: text(formData, "line1"),
      line2: text(formData, "line2"),
      area: text(formData, "area"),
      city: text(formData, "city"),
      district: text(formData, "district"),
      postcode: text(formData, "postcode"),
    },
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "তথ্যগুলো যাচাই করুন।" };
  }

  try {
    await updateBuyerProfile(context.store.id, buyer.id, parsed.data);
    revalidatePath(storePath(slug, "/account/profile"));
    revalidatePath(storePath(slug, "/account"));
    return { ok: true, message: "প্রোফাইল সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "প্রোফাইল সংরক্ষণ করা যায়নি।");
  }
}

export async function changeBuyerPasswordAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const { context, buyer } = await requireBuyer(slug);

  try {
    await changeBuyerPassword(
      context.store.id,
      buyer.id,
      text(formData, "currentPassword"),
      text(formData, "newPassword"),
    );
    return { ok: true, message: "পাসওয়ার্ড বদলানো হয়েছে।" };
  } catch (error) {
    return message(error, "পাসওয়ার্ড বদলানো যায়নি।");
  }
}

export async function saveReviewAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const productSlug = text(formData, "productSlug");
  const { context, buyer } = await requireBuyer(slug);

  const parsed = reviewSchema.safeParse({
    rating: text(formData, "rating"),
    title: text(formData, "title"),
    body: text(formData, "body"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "রিভিউ যাচাই করুন।" };
  }

  try {
    await saveBuyerReview(context.store.id, buyer.id, text(formData, "productId"), parsed.data);
    revalidatePath(storePath(slug, `/product/${productSlug}`));
    revalidatePath(storePath(slug, "/account/reviews"));
    return { ok: true, message: "আপনার মন্তব্য যোগ হয়েছে।" };
  } catch (error) {
    return message(error, "মন্তব্য যোগ করা যায়নি।");
  }
}

export async function deleteReviewAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const productSlug = text(formData, "productSlug");
  const { context, buyer } = await requireBuyer(slug);

  try {
    await deleteBuyerReview(context.store.id, buyer.id, text(formData, "reviewId"));
    revalidatePath(storePath(slug, `/product/${productSlug}`));
    revalidatePath(storePath(slug, "/account/reviews"));
    return { ok: true, message: "মন্তব্য মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "মন্তব্য মোছা যায়নি।");
  }
}

export async function addCommentAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const productSlug = text(formData, "productSlug");
  const { context, buyer } = await requireBuyer(slug);

  try {
    await addReviewComment(
      context.store.id,
      { id: buyer.id, name: buyer.name },
      text(formData, "reviewId"),
      text(formData, "body"),
    );
    revalidatePath(storePath(slug, `/product/${productSlug}`));
    return { ok: true, message: "মন্তব্য যোগ হয়েছে।" };
  } catch (error) {
    return message(error, "মন্তব্য যোগ করা যায়নি।");
  }
}

export async function toggleWishlistAction(
  _prev: BuyerState,
  formData: FormData,
): Promise<BuyerState> {
  const slug = text(formData, "slug");
  const productSlug = text(formData, "productSlug");
  const { context, buyer } = await requireBuyer(slug);

  try {
    const result = await toggleWishlist(
      context.store.id,
      buyer.id,
      text(formData, "productId"),
    );
    revalidatePath(storePath(slug, `/product/${productSlug}`));
    revalidatePath(storePath(slug, "/account/wishlist"));
    return {
      ok: true,
      saved: result.saved,
      message: result.saved ? "উইশলিস্টে যোগ হয়েছে।" : "উইশলিস্ট থেকে সরানো হয়েছে।",
    };
  } catch (error) {
    return message(error, "উইশলিস্ট হালনাগাদ করা যায়নি।");
  }
}
