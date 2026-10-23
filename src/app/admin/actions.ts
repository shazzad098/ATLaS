"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { STORE_COOKIE, getWorkspace } from "@/lib/tenant";
import type { ActorContext } from "@/lib/rbac";
import {
  archiveStore,
  createDeliveryZone,
  deleteDeliveryZone,
  publishStore,
  togglePaymentMethod,
  unpublishStore,
  updateDeliveryZone,
  updateStoreSettings,
} from "@/lib/services/store-service";
import {
  adjustVariantStock,
  archiveProduct,
  createCategory,
  createProduct,
  importProductsCsv,
  updateCategory,
  updateProduct,
} from "@/lib/services/catalog-service";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { closeTicket, createTicket } from "@/lib/services/support-service";
import { recordCodCollection, refundOrder } from "@/lib/services/payment-service";
import { resolveReturn, updateOrderStatus, type OrderStatusValue } from "@/lib/services/order-service";
import { cancelSubscription, changePlan, markInvoicePaid, startTrial } from "@/lib/services/billing-service";
import { publishTheme, resetThemeDraft, saveThemeDraft, selectTheme } from "@/lib/services/theme-service";
import {
  addCustomDomain,
  removeDomain,
  setPrimaryDomain,
  verifyDomain,
} from "@/lib/services/domain-service";
import { archiveCoupon, createCoupon, updateCoupon } from "@/lib/services/coupon-service";
import { inviteStaff, removeStaff, updateStaffRole } from "@/lib/services/staff-service";
import type { Permission, RoleCode } from "@/lib/rbac";
import type { AdminState } from "@/app/admin/state";

/**
 * Merchant admin server actions (FR-02 … FR-10).
 *
 * Every handler re-resolves the caller's workspace and delegates to a service,
 * which re-checks the permission and the tenant boundary. The client only ever
 * sends ids and raw form values.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function required(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new AppError("VALIDATION_FAILED", "অনুরোধে প্রয়োজনীয় তথ্য নেই।", 422, { field: key });
  return value;
}

async function ctx(permission?: Permission): Promise<{ actor: ActorContext; storeId: string; slug: string }> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  if (permission && !workspace.actor.permissions.includes(permission)) {
    throw new AppError("FORBIDDEN", "এই কাজের অনুমতি আপনার role-এ নেই।", 403, {
      requiredPermission: permission,
    });
  }

  return { actor: workspace.actor, storeId: "", slug: "" };
}

function message(error: unknown, fallback: string): AdminState {
  if (error instanceof AppError) return { ok: false, message: error.message };
  if (error instanceof Error && error.message) return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

function revalidateAdmin(...paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

// ── Store selection & lifecycle ──────────────────────────────────────────────

export async function switchStoreAction(formData: FormData): Promise<void> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  const storeId = text(formData, "storeId");
  if (!workspace.stores.some((store) => store.id === storeId)) redirect("/admin");

  const jar = await cookies();
  jar.set(STORE_COOKIE, storeId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  revalidateAdmin("/admin");
  redirect("/admin");
}

export async function publishStoreAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("store:publish");
    await publishStore(actor, required(formData, "storeId"));
    revalidateAdmin("/admin", "/admin/settings", `/store/${text(formData, "slug")}`);
    return { ok: true, message: "দোকান publish হয়েছে।" };
  } catch (error) {
    return message(error, "Publish করা যায়নি।");
  }
}

export async function unpublishStoreAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("store:publish");
    await unpublishStore(actor, required(formData, "storeId"));
    revalidateAdmin("/admin", "/admin/settings");
    return { ok: true, message: "দোকান unpublish করা হয়েছে।" };
  } catch (error) {
    return message(error, "Unpublish করা যায়নি।");
  }
}

export async function archiveStoreAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("store:write");
    await archiveStore(actor, required(formData, "storeId"));
    revalidateAdmin("/admin");
    return { ok: true, message: "দোকান archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

export async function updateStoreSettingsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    const storeId = required(formData, "storeId");

    await updateStoreSettings(actor, storeId, {
      name: text(formData, "name"),
      description: text(formData, "description"),
      locale: text(formData, "locale") || "bn",
      contact: {
        phone: text(formData, "contactPhone"),
        email: text(formData, "contactEmail"),
        whatsapp: text(formData, "contactWhatsapp"),
      },
      address: {
        line1: text(formData, "addressLine1"),
        area: text(formData, "addressArea"),
        city: text(formData, "addressCity"),
        district: text(formData, "addressDistrict"),
        postcode: text(formData, "addressPostcode"),
      },
      seo: {
        title: text(formData, "seoTitle"),
        description: text(formData, "seoDescription"),
        ogImage: text(formData, "seoOgImage"),
      },
      checkout: {
        codAutoConfirm: formData.get("codAutoConfirm") === "on",
        minOrderTotal: text(formData, "minOrderTotal") || "0",
      },
      policy: {
        returnsDays: Number.parseInt(text(formData, "returnsDays") || "7", 10) || 7,
        returnsText: text(formData, "returnsText"),
        privacyText: text(formData, "privacyText"),
        termsText: text(formData, "termsText"),
      },
    });

    revalidateAdmin("/admin/settings");
    return { ok: true, message: "সেটিংস সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "সেটিংস সংরক্ষণ করা যায়নি।");
  }
}

// ── Catalog ──────────────────────────────────────────────────────────────────

function parseVariants(formData: FormData): Array<{
  id?: string;
  sku: string;
  optionValues: Record<string, string>;
  price: number;
  comparePrice: number | null;
  stockQty: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
}> {
  const raw = text(formData, "variants");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed.map((row) => ({
    id: typeof row.id === "string" ? row.id : undefined,
    sku: String(row.sku ?? "").trim(),
    optionValues: (row.optionValues ?? {}) as Record<string, string>,
    price: Number(row.price ?? 0),
    comparePrice: row.comparePrice === null || row.comparePrice === "" ? null : Number(row.comparePrice),
    stockQty: Number(row.stockQty ?? 0),
    status: (row.status as "ACTIVE" | "DRAFT" | "ARCHIVED") ?? "ACTIVE",
  }));
}

function parseImages(formData: FormData): Array<{ url: string; altText: string }> {
  const raw = text(formData, "images");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed
    .map((row) => ({ url: String(row.url ?? "").trim(), altText: String(row.altText ?? "").trim() }))
    .filter((row) => row.url.length > 0);
}

export async function saveProductAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    const storeId = required(formData, "storeId");
    const productId = text(formData, "productId");

    const payload = {
      name: text(formData, "name"),
      slug: text(formData, "slug") || undefined,
      categoryId: text(formData, "categoryId") || null,
      description: text(formData, "description"),
      tags: text(formData, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: (text(formData, "status") || "DRAFT") as "ACTIVE" | "DRAFT" | "ARCHIVED",
      lowStockThreshold: Number.parseInt(text(formData, "lowStockThreshold") || "5", 10) || 5,
      variants: parseVariants(formData),
      images: parseImages(formData),
    };

    const result = productId
      ? await updateProduct(actor, storeId, productId, payload)
      : await createProduct(actor, storeId, payload);

    revalidateAdmin("/admin/products", `/admin/products/${result.id}`);
    return { ok: true, message: "পণ্য সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "পণ্য সংরক্ষণ করা যায়নি।");
  }
}

export async function archiveProductAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    await archiveProduct(actor, required(formData, "storeId"), required(formData, "productId"));
    revalidateAdmin("/admin/products");
    return { ok: true, message: "পণ্য archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

export async function adjustStockAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    await adjustVariantStock(actor, required(formData, "storeId"), required(formData, "variantId"), {
      delta: Number.parseInt(text(formData, "delta") || "0", 10),
      reason: text(formData, "reason") || "Manual adjustment",
    });
    revalidateAdmin("/admin/products");
    return { ok: true, message: "স্টক হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "স্টক হালনাগাদ করা যায়নি।");
  }
}

export async function saveCategoryAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    const storeId = required(formData, "storeId");
    const categoryId = text(formData, "categoryId");

    const payload = {
      name: text(formData, "name"),
      slug: text(formData, "slug") || undefined,
      sortOrder: Number.parseInt(text(formData, "sortOrder") || "0", 10) || 0,
      status: (text(formData, "status") || "ACTIVE") as "ACTIVE" | "DRAFT" | "ARCHIVED",
      parentId: text(formData, "parentId") || null,
    };

    if (categoryId) {
      await updateCategory(actor, storeId, categoryId, payload);
    } else {
      await createCategory(actor, storeId, payload);
    }

    revalidateAdmin("/admin/categories");
    return { ok: true, message: "ক্যাটাগরি সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "ক্যাটাগরি সংরক্ষণ করা যায়নি।");
  }
}

export async function archiveCategoryAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    await updateCategory(actor, required(formData, "storeId"), required(formData, "categoryId"), {
      name: text(formData, "name") || "—",
      status: "ARCHIVED",
    });
    revalidateAdmin("/admin/categories");
    return { ok: true, message: "ক্যাটাগরি archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

// ── Orders ───────────────────────────────────────────────────────────────────

export async function updateOrderStatusAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("orders:write");
    const orderId = required(formData, "orderId");
    await updateOrderStatus(actor, required(formData, "storeId"), orderId, {
      status: required(formData, "status") as OrderStatusValue,
      note: text(formData, "note") || undefined,
    });
    revalidateAdmin("/admin/orders", `/admin/orders/${orderId}`);
    return { ok: true, message: "অর্ডার হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "অর্ডার হালনাগাদ করা যায়নি।");
  }
}

export async function recordCodAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("orders:write");
    const orderId = required(formData, "orderId");
    await recordCodCollection(actor, required(formData, "storeId"), orderId);
    revalidateAdmin("/admin/orders");
    return { ok: true, message: "ক্যাশ কালেকশন রেকর্ড হয়েছে।" };
  } catch (error) {
    return message(error, "রেকর্ড করা যায়নি।");
  }
}

export async function refundOrderAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("orders:refund");
    await refundOrder(actor, required(formData, "storeId"), required(formData, "orderId"), {
      amount: text(formData, "amount"),
      reason: text(formData, "reason") || "Merchant-initiated refund",
    });
    revalidateAdmin("/admin/orders");
    return { ok: true, message: "রিফান্ড প্রক্রিয়া শুরু হয়েছে।" };
  } catch (error) {
    return message(error, "রিফান্ড করা যায়নি।");
  }
}

export async function resolveReturnAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("orders:refund");
    await resolveReturn(actor, required(formData, "storeId"), required(formData, "returnId"), {
      status: required(formData, "status") as "APPROVED" | "REJECTED" | "RECEIVED" | "REFUNDED",
      resolution: text(formData, "resolution") || undefined,
    });
    revalidateAdmin("/admin/orders");
    return { ok: true, message: "রিটার্ন হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

// ── Delivery & payments ──────────────────────────────────────────────────────

export async function saveDeliveryZoneAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("delivery:write");
    const storeId = required(formData, "storeId");
    const zoneId = text(formData, "zoneId");

    const payload = {
      name: text(formData, "name"),
      areas: text(formData, "areas")
        .split(",")
        .map((area) => area.trim())
        .filter(Boolean),
      charge: Number(text(formData, "charge") || "0"),
      freeAbove: text(formData, "freeAbove") ? Number(text(formData, "freeAbove")) : null,
      isDefault: formData.get("isDefault") === "on",
      isActive: formData.get("isActive") !== null,
      sortOrder: Number.parseInt(text(formData, "sortOrder") || "0", 10) || 0,
    };

    if (zoneId) {
      await updateDeliveryZone(actor, storeId, zoneId, payload);
    } else {
      await createDeliveryZone(actor, storeId, payload);
    }

    revalidateAdmin("/admin/delivery");
    return { ok: true, message: "ডেলিভারি জোন সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "সংরক্ষণ করা যায়নি।");
  }
}

export async function deleteDeliveryZoneAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("delivery:write");
    await deleteDeliveryZone(actor, required(formData, "storeId"), required(formData, "zoneId"));
    revalidateAdmin("/admin/delivery");
    return { ok: true, message: "জোন মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "মুছে ফেলা যায়নি।");
  }
}

export async function togglePaymentMethodAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("payments:write");
    const provider = required(formData, "provider") as "COD" | "BKASH" | "NAGAD" | "SSLCOMMERZ";
    const isEnabled = formData.get("isEnabled") === "on";

    await togglePaymentMethod(actor, required(formData, "storeId"), provider, { isEnabled });
    revalidateAdmin("/admin/payments");
    return { ok: true, message: `${provider} ${isEnabled ? "চালু" : "বন্ধ"} করা হয়েছে।` };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

// ── Discounts ────────────────────────────────────────────────────────────────

export async function saveCouponAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("discounts:write");
    const storeId = required(formData, "storeId");
    const couponId = text(formData, "couponId");

    const payload = {
      code: text(formData, "code"),
      type: text(formData, "type") === "FIXED" ? "FIXED" : "PERCENTAGE",
      value: Number(text(formData, "value") || "0"),
      minOrder: Number(text(formData, "minOrder") || "0"),
      usageLimit: text(formData, "usageLimit") ? Number(text(formData, "usageLimit")) : undefined,
      startsAt: text(formData, "startsAt") || undefined,
      endsAt: text(formData, "endsAt") || undefined,
      status: (text(formData, "status") || "ACTIVE") as "ACTIVE" | "DRAFT" | "ARCHIVED",
    };

    if (couponId) {
      await updateCoupon(actor, storeId, couponId, payload);
    } else {
      await createCoupon(actor, storeId, payload);
    }

    revalidateAdmin("/admin/discounts");
    return { ok: true, message: "কুপন সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "কুপন সংরক্ষণ করা যায়নি।");
  }
}

export async function archiveCouponAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("discounts:write");
    await archiveCoupon(actor, required(formData, "storeId"), required(formData, "couponId"));
    revalidateAdmin("/admin/discounts");
    return { ok: true, message: "কুপন archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

// ── Design ───────────────────────────────────────────────────────────────────

export async function selectThemeAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    const result = await selectTheme(actor, required(formData, "storeId"), required(formData, "themeCode"));
    revalidateAdmin("/admin/design");
    return {
      ok: true,
      message: result.draftOnly
        ? "থিম পরিবর্তন draft-এ রাখা হয়েছে — publish করলে live হবে।"
        : "থিম নির্বাচন হয়েছে।",
    };
  } catch (error) {
    return message(error, "থিম নির্বাচন করা যায়নি।");
  }
}

export async function saveThemeDraftAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    const patch = JSON.parse(text(formData, "config") || "{}") as Record<string, unknown>;
    await saveThemeDraft(
      actor,
      required(formData, "storeId"),
      required(formData, "themeVersionId"),
      patch,
    );
    revalidateAdmin("/admin/design");
    return { ok: true, message: "ড্রাফট সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "ড্রাফট সংরক্ষণ করা যায়নি।");
  }
}

export async function publishThemeAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    await publishTheme(actor, required(formData, "storeId"), required(formData, "themeVersionId"));
    revalidateAdmin("/admin/design", "/");
    return { ok: true, message: "থিম publish হয়েছে।" };
  } catch (error) {
    return message(error, "Publish করা যায়নি।");
  }
}

export async function resetThemeDraftAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    await resetThemeDraft(actor, required(formData, "storeId"), required(formData, "themeVersionId"));
    revalidateAdmin("/admin/design");
    return { ok: true, message: "ড্রাফট রিসেট হয়েছে।" };
  } catch (error) {
    return message(error, "রিসেট করা যায়নি।");
  }
}

// ── Domains ──────────────────────────────────────────────────────────────────

export async function addDomainAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await addCustomDomain(actor, required(formData, "storeId"), { host: text(formData, "host") });
    revalidateAdmin("/admin/settings");
    return { ok: true, message: "ডোমেইন যোগ হয়েছে — DNS যাচাই করুন।" };
  } catch (error) {
    return message(error, "ডোমেইন যোগ করা যায়নি।");
  }
}

export async function verifyDomainAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    const result = await verifyDomain(actor, required(formData, "storeId"), required(formData, "domainId"));
    revalidateAdmin("/admin/settings");
    const verified = (result as { verificationStatus?: string } | undefined)?.verificationStatus === "VERIFIED";
    return { ok: true, message: verified ? "ডোমেইন যাচাই সম্পন্ন।" : "এখনো যাচাই হয়নি — DNS রেকর্ড যোগ করুন।" };
  } catch (error) {
    return message(error, "যাচাই করা যায়নি।");
  }
}

export async function setPrimaryDomainAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await setPrimaryDomain(actor, required(formData, "storeId"), required(formData, "domainId"));
    revalidateAdmin("/admin/settings");
    return { ok: true, message: "প্রাইমারি ডোমেইন হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

export async function removeDomainAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await removeDomain(actor, required(formData, "storeId"), required(formData, "domainId"));
    revalidateAdmin("/admin/settings");
    return { ok: true, message: "ডোমেইন সরানো হয়েছে।" };
  } catch (error) {
    return message(error, "সরানো যায়নি।");
  }
}

// ── Staff ────────────────────────────────────────────────────────────────────

export async function inviteStaffAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await inviteStaff(actor, {
      name: text(formData, "name"),
      phone: text(formData, "phone"),
      roleCode: text(formData, "roleCode") || "STAFF",
    });
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "টিম সদস্য যোগ হয়েছে।" };
  } catch (error) {
    return message(error, "সদস্য যোগ করা যায়নি।");
  }
}

export async function updateStaffRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await updateStaffRole(
      actor,
      required(formData, "membershipId"),
      required(formData, "roleCode") as RoleCode,
    );
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "Role হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "Role হালনাগাদ করা যায়নি।");
  }
}

export async function removeStaffAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await removeStaff(actor, required(formData, "membershipId"));
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "সদস্য সরানো হয়েছে।" };
  } catch (error) {
    return message(error, "সরানো যায়নি।");
  }
}

// ── Billing ──────────────────────────────────────────────────────────────────

export async function changePlanAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("billing:write");
    const planCode = required(formData, "planCode") as "free" | "basic" | "standard" | "pro";
    const billingPeriod = text(formData, "billingPeriod") === "YEARLY" ? "YEARLY" : "MONTHLY";
    const asTrial = formData.get("asTrial") === "on";

    if (asTrial && planCode !== "free") {
      await startTrial(actor, planCode, billingPeriod);
    } else {
      await changePlan(actor, planCode, billingPeriod);
    }

    revalidateAdmin("/admin/billing");
    return { ok: true, message: `প্ল্যান ${planCode} সেট হয়েছে।` };
  } catch (error) {
    return message(error, "প্ল্যান পরিবর্তন করা যায়নি।");
  }
}

export async function cancelSubscriptionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("billing:write");
    await cancelSubscription(actor, { atPeriodEnd: formData.get("atPeriodEnd") === "on" });
    revalidateAdmin("/admin/billing");
    return { ok: true, message: "সাবস্ক্রিপশন বাতিল করা হয়েছে।" };
  } catch (error) {
    return message(error, "বাতিল করা যায়নি।");
  }
}

export async function markInvoicePaidAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("billing:write");
    await markInvoicePaid(actor, required(formData, "invoiceId"));
    revalidateAdmin("/admin/billing");
    return { ok: true, message: "ইনভয়েস পরিশোধিত হিসেবে চিহ্নিত।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

// ── Catalog import ───────────────────────────────────────────────────────────

/**
 * CSV import (FR-03). Runs the validator first (dry-run) unless `commit=1`, so
 * a merchant always sees which rows would fail before anything is written.
 */
export async function importProductsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("catalog:write");
    const storeId = required(formData, "storeId");
    const csv = text(formData, "csv");
    if (!csv.trim()) return { ok: false, message: "CSV লিখুন বা ফাইল আপলোড করুন।" };

    const commit = formData.get("commit") === "1";
    const result = await importProductsCsv(actor, storeId, csv, { dryRun: !commit });

    const skipped = result.results.filter((row) => row.action === "skip").length;
    const summary = commit
      ? `${result.created}টি নতুন, ${result.updated}টি হালনাগাদ, ${skipped}টি বাদ।`
      : `Dry-run: ${result.results.length}টি row — ${skipped}টিতে সমস্যা। কিছুই লেখা হয়নি।`;

    if (commit) revalidateAdmin("/admin/products", "/admin/inventory");
    return { ok: skipped === 0, message: summary, data: { results: result.results } };
  } catch (error) {
    return message(error, "Import করা যায়নি।");
  }
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function markNotificationReadAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx();
    await markNotificationRead(actor.userId, required(formData, "notificationId"));
    revalidateAdmin("/admin/notifications");
    return { ok: true, message: "পড়া হয়েছে।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

export async function markAllNotificationsReadAction(_prev: AdminState, _formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx();
    await markAllNotificationsRead(actor.userId);
    revalidateAdmin("/admin/notifications");
    return { ok: true, message: "সব নোটিফিকেশন পড়া হিসেবে চিহ্নিত।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

// ── Support ──────────────────────────────────────────────────────────────────

export async function createTicketAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx();
    await createTicket(actor, required(formData, "storeId"), {
      subject: text(formData, "subject"),
      body: text(formData, "body"),
      priority: text(formData, "priority") || "NORMAL",
    });
    revalidateAdmin("/admin/support");
    return { ok: true, message: "টিকেট তৈরি হয়েছে — টিম শীঘ্রই উত্তর দেবে।" };
  } catch (error) {
    return message(error, "টিকেট তৈরি করা যায়নি।");
  }
}

export async function closeTicketAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx();
    await closeTicket(actor, required(formData, "ticketId"));
    revalidateAdmin("/admin/support");
    return { ok: true, message: "টিকেট বন্ধ করা হয়েছে।" };
  } catch (error) {
    return message(error, "বন্ধ করা যায়নি।");
  }
}

// ── Navigation helper ────────────────────────────────────────────────────────

/** Reusable form-data reader for the client forms. */
export async function noopAction(): Promise<void> {
  return;
}
