"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { bnNumber } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { storePath } from "@/lib/storefront";
import { STORE_COOKIE, getWorkspace } from "@/lib/tenant";
import type { ActorContext } from "@/lib/rbac";
import {
  archiveStore,
  createDeliveryZone,
  deleteDeliveryZone,
  publishStore,
  saveDeliveryMethod,
  togglePaymentMethod,
  unpublishStore,
  updateDeliveryZone,
  updateStoreSettings,
} from "@/lib/services/store-service";
import {
  adjustVariantStock,
  applyProductDiscount,
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
import {
  createCourierShipment,
  syncCourierShipment,
} from "@/lib/services/courier-service";
import { resolveReturn, updateOrderStatus, type OrderStatusValue } from "@/lib/services/order-service";
import { cancelSubscription, changePlan, startTrial } from "@/lib/services/billing-service";
import { publishTheme, resetThemeDraft, saveThemeDraft, selectTheme } from "@/lib/services/theme-service";
import {
  addCustomDomain,
  provisionDomainTls,
  removeDomain,
  setPrimaryDomain,
  verifyDomain,
} from "@/lib/services/domain-service";
import { archiveCoupon, createCoupon, updateCoupon } from "@/lib/services/coupon-service";
import { archiveContentPage, saveContentPage } from "@/lib/services/content-service";
import {
  createRole,
  deleteRole,
  inviteStaff,
  removeStaff,
  updateRole,
  updateStaffRole,
} from "@/lib/services/staff-service";
import { createApiKey, revokeApiKey } from "@/lib/services/api-key-service";
import {
  setCustomerBlacklist,
  updateCustomerConsent,
} from "@/lib/services/customer-service";
import {
  createExportJob,
  createExportSchedule,
  deleteExportSchedule,
  EXPORT_TYPES,
  processExportJob,
  type ExportType,
} from "@/lib/services/report-service";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
} from "@/lib/services/webhook-service";
import type { Permission } from "@/lib/rbac";
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
      tax: {
        mode: (text(formData, "taxMode") || "INCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE" | "NONE",
        ratePercent: Number.parseFloat(text(formData, "taxRatePercent") || "0") || 0,
        vatRegistered: formData.get("vatRegistered") === "on",
      },
      notifications: {
        orderCreated: formData.get("notifyOrderCreated") === "on",
        paymentReceived: formData.get("notifyPaymentReceived") === "on",
        lowStock: formData.get("notifyLowStock") === "on",
        customerOrderEmail: formData.get("customerOrderEmail") === "on",
        customerOrderSms: formData.get("customerOrderSms") === "on",
        customerPaymentEmail: formData.get("customerPaymentEmail") === "on",
        customerPaymentSms: formData.get("customerPaymentSms") === "on",
        customerShippingEmail: formData.get("customerShippingEmail") === "on",
        customerShippingSms: formData.get("customerShippingSms") === "on",
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

// ── Product discount ─────────────────────────────────────────────────────────

/**
 * Apply or clear a percentage discount on one product. Writes real prices so
 * cart, checkout and the storefront (badge + strikethrough) all pick it up.
 */
export async function applyProductDiscountAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("discounts:write");
    const storeId = required(formData, "storeId");
    const productId = required(formData, "productId");
    const clear = text(formData, "mode") === "clear";
    const percent = Number.parseInt(text(formData, "percent") || "0", 10) || 0;

    const result = await applyProductDiscount(actor, storeId, productId, { percent, clear });

    revalidateAdmin(
      "/admin/products",
      `/admin/products/${productId}`,
      "/store/[slug]/shop",
      "/store/[slug]/product/[productSlug]",
    );
    return {
      ok: true,
      message: result.cleared
        ? "ডিসকাউন্ট সরিয়ে আগের দামে ফেরা হয়েছে।"
        : `${bnNumber(result.percent)}% ডিসকাউন্ট প্রয়োগ হয়েছে।`,
    };
  } catch (error) {
    return message(error, "ডিসকাউন্ট প্রয়োগ করা যায়নি।");
  }
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

    // The storefront renders from the database on the next request; clear the
    // public paths as well so a cached HTML copy cannot keep the old photo.
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { slug: true },
    });
    if (store) {
      revalidatePath(storePath(store.slug));
      revalidatePath(storePath(store.slug, "/shop"));
      revalidatePath(storePath(store.slug, `/product/${result.slug}`));
    }

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

/**
 * Inline category creation from the product form.
 *
 * Returns the new row so the client can append it to the dropdown and select it
 * without leaving the (possibly unsaved) product the merchant is editing.
 */
export type QuickCategoryResult = {
  ok: boolean;
  message: string;
  category?: { id: string; name: string };
};

export async function createProductCategoryAction(input: {
  storeId: string;
  name: string;
}): Promise<QuickCategoryResult> {
  try {
    const { actor } = await ctx("catalog:write");
    const name = input.name.trim();
    if (name.length < 2) {
      return { ok: false, message: "ক্যাটাগরির নাম কমপক্ষে ২ অক্ষরের হতে হবে।" };
    }
    const category = await createCategory(actor, input.storeId, {
      name,
      sortOrder: 0,
      status: "ACTIVE",
      parentId: null,
    });
    revalidateAdmin("/admin/categories", "/admin/products");
    return {
      ok: true,
      message: "ক্যাটাগরি তৈরি হয়েছে।",
      category: { id: category.id, name: category.name },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof AppError ? error.message : "ক্যাটাগরি তৈরি করা যায়নি।",
    };
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
      idempotencyKey: text(formData, "idempotencyKey") || randomUUID(),
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

// ── Customers ────────────────────────────────────────────────────────────────

export async function updateCustomerConsentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("customers:write");
    const storeId = required(formData, "storeId");
    const customerId = required(formData, "customerId");

    await updateCustomerConsent(actor, storeId, customerId, {
      marketingEmail: formData.get("marketingEmail") === "on",
      marketingSms: formData.get("marketingSms") === "on",
      source: "admin",
    });
    revalidatePath(`/admin/customers/${customerId}`);
    revalidatePath("/admin/customers");
    return { ok: true, message: "Consent সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "Consent সংরক্ষণ করা যায়নি।");
  }
}

export async function setCustomerBlacklistAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("customers:write");
    const storeId = required(formData, "storeId");
    const customerId = required(formData, "customerId");
    const isBlacklisted = text(formData, "isBlacklisted") === "1";

    await setCustomerBlacklist(actor, storeId, customerId, {
      isBlacklisted,
      reason: text(formData, "reason") || undefined,
    });
    revalidatePath(`/admin/customers/${customerId}`);
    revalidatePath("/admin/customers");
    return {
      ok: true,
      message: isBlacklisted ? "ক্রেতাকে blacklist করা হয়েছে।" : "Blacklist উঠিয়ে নেওয়া হয়েছে।",
    };
  } catch (error) {
    return message(error, "Blacklist হালনাগাদ করা যায়নি।");
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

export async function saveDeliveryMethodAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("delivery:write");
    const storeId = required(formData, "storeId");
    const provider = required(formData, "provider");

    await saveDeliveryMethod(actor, storeId, provider, {
      isEnabled: formData.get("isEnabled") === "on",
      courierStoreId: text(formData, "courierStoreId"),
    });

    revalidateAdmin("/admin/delivery");
    return { ok: true, message: "ডেলিভারি মেথড সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "সংরক্ষণ করা যায়নি।");
  }
}

export async function createShipmentAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("delivery:write");
    const storeId = required(formData, "storeId");
    const orderId = required(formData, "orderId");
    const provider = required(formData, "provider");

    const result = await createCourierShipment(actor, storeId, orderId, provider);

    revalidateAdmin(`/admin/orders/${orderId}`);
    revalidateAdmin("/admin/orders");
    return {
      ok: true,
      message: `${result.providerLabel}-এ পাঠানো হয়েছে — ট্র্যাকিং ${result.trackingCode}${
        result.sandbox ? " (sandbox)" : ""
      }`,
    };
  } catch (error) {
    return message(error, "কুরিয়ারে পাঠানো যায়নি।");
  }
}

export async function syncShipmentAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("delivery:write");
    const storeId = required(formData, "storeId");
    const shipmentId = required(formData, "shipmentId");
    const orderId = required(formData, "orderId");

    const result = await syncCourierShipment(actor, storeId, shipmentId);

    revalidateAdmin(`/admin/orders/${orderId}`);
    return {
      ok: true,
      message: `ট্র্যাকিং আপডেট: ${result.status}${result.sandbox ? " (sandbox)" : ""} · অর্ডার ${result.orderStatus}`,
    };
  } catch (error) {
    return message(error, "ট্র্যাকিং আপডেট করা যায়নি।");
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
    if (result?.verificationStatus !== "ACTIVE") {
      return { ok: false, message: "এখনো যাচাই হয়নি — DNS রেকর্ড যোগ করুন।" };
    }
    return {
      ok: true,
      message:
        result.tlsStatus === "ACTIVE"
          ? "ডোমেইন ও TLS যাচাই সম্পন্ন।"
          : "DNS যাচাই হয়েছে — TLS certificate provisioning চলছে।",
    };
  } catch (error) {
    return message(error, "যাচাই করা যায়নি।");
  }
}

export async function provisionDomainTlsAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    const storeId = required(formData, "storeId");
    const domainId = required(formData, "domainId");
    const domains = await listDomainsForActor(actor, storeId);
    if (!domains.some((domain) => domain.id === domainId)) {
      throw new AppError("NOT_FOUND", "ডোমেইন পাওয়া যায়নি।", 404);
    }
    const updated = await provisionDomainTls(domainId);
    revalidateAdmin("/admin/settings");
    return {
      ok: updated?.tlsStatus === "ACTIVE",
      message:
        updated?.tlsStatus === "ACTIVE"
          ? "TLS certificate সক্রিয় হয়েছে।"
          : updated?.tlsError ?? "TLS এখনো সক্রিয় হয়নি — DNS propagation শেষ হলে আবার চেষ্টা করুন।",
    };
  } catch (error) {
    return message(error, "TLS যাচাই করা যায়নি।");
  }
}

/** Domain rows are tenant-scoped; this is the guard for direct-id actions. */
async function listDomainsForActor(actor: ActorContext, storeId: string) {
  const { listDomains } = await import("@/lib/services/domain-service");
  const { assertStoreAccess } = await import("@/lib/tenant");
  await assertStoreAccess(actor, storeId);
  return listDomains(storeId);
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
    await updateStaffRole(actor, required(formData, "membershipId"), required(formData, "roleCode"));
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "Role হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "Role হালনাগাদ করা যায়নি।");
  }
}

export async function createRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await createRole(actor, {
      name: text(formData, "name"),
      permissions: formData.getAll("permissions").filter((value): value is string => typeof value === "string"),
    });
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "নতুন রোল তৈরি হয়েছে।" };
  } catch (error) {
    return message(error, "রোল তৈরি করা যায়নি।");
  }
}

export async function updateRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await updateRole(actor, required(formData, "roleId"), {
      name: text(formData, "name"),
      permissions: formData.getAll("permissions").filter((value): value is string => typeof value === "string"),
    });
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "রোল হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "রোল হালনাগাদ করা যায়নি।");
  }
}

export async function deleteRoleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await deleteRole(actor, required(formData, "roleId"));
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "রোল মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "রোল মুছে ফেলা যায়নি।");
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
      revalidateAdmin("/admin/billing");
      return { ok: true, message: "Trial শুরু হয়েছে।" };
    }

    const result = await changePlan(actor, planCode, billingPeriod);
    revalidateAdmin("/admin/billing");
    return {
      ok: true,
      message: result.pending
        ? `Invoice ${result.invoice?.number ?? ""} তৈরি হয়েছে। Super Admin payment যাচাই করলে ${planCode} plan চালু হবে।`
        : `প্ল্যান ${planCode} সেট হয়েছে।`,
    };
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

// Manual invoice settlement is a Super Admin action. Merchants never get a
// "mark paid" control; see `src/app/super-admin/actions.ts`.

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
  void _prev;
  void _formData;
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

// ── Developer integrations ───────────────────────────────────────────────────

export async function createApiKeyAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    const expiry = text(formData, "expiresAt");
    const key = await createApiKey(actor, {
      name: text(formData, "name"),
      scopes: formData.getAll("scopes"),
      expiresAt: expiry ? new Date(`${expiry}T23:59:59.999Z`) : null,
    });
    revalidateAdmin("/admin/developers");
    return {
      ok: true,
      message: `API key তৈরি হয়েছে। এটি শুধু একবার দেখা যাবে — এখনই কপি করুন:\n${key.raw}`,
    };
  } catch (error) {
    return message(error, "API key তৈরি করা যায়নি।");
  }
}

export async function revokeApiKeyAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await revokeApiKey(actor, required(formData, "keyId"));
    revalidateAdmin("/admin/developers");
    return { ok: true, message: "API key বাতিল করা হয়েছে।" };
  } catch (error) {
    return message(error, "Key বাতিল করা যায়নি।");
  }
}

export async function createWebhookAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    const endpoint = await createWebhookEndpoint(actor, {
      url: text(formData, "url"),
      events: formData.getAll("events"),
    });
    revalidateAdmin("/admin/developers");
    return {
      ok: true,
      message: `Webhook endpoint যোগ হয়েছে। Signing secret (একবার দেখানো হবে):\n${endpoint.secret}`,
    };
  } catch (error) {
    return message(error, "Webhook endpoint যোগ করা যায়নি।");
  }
}

export async function deleteWebhookAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await deleteWebhookEndpoint(actor, required(formData, "endpointId"));
    revalidateAdmin("/admin/developers");
    return { ok: true, message: "Webhook endpoint মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "Endpoint মুছে ফেলা যায়নি।");
  }
}

// ── Reports & exports ────────────────────────────────────────────────────────

function dateField(formData: FormData, key: string, endOfDay = false): Date | undefined {
  const value = text(formData, key);
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+06:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function exportTypeField(formData: FormData): ExportType {
  const type = text(formData, "type") as ExportType;
  if (!EXPORT_TYPES.includes(type)) {
    throw new AppError("VALIDATION_FAILED", "সঠিক export type নির্বাচন করুন।", 422);
  }
  return type;
}

export async function createExportJobAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("reports:export");
    const job = await createExportJob(actor, required(formData, "storeId"), {
      type: exportTypeField(formData),
      from: dateField(formData, "from"),
      to: dateField(formData, "to", true),
    });
    await processExportJob(job.id);
    revalidateAdmin("/admin/reports");
    return {
      ok: true,
      message: "Export তৈরি হয়েছে। ডাউনলোড লিংক প্রস্তুত।",
      downloadUrl: `/admin/reports/exports/${job.id}`,
    };
  } catch (error) {
    return message(error, "Export তৈরি করা যায়নি।");
  }
}

export async function createExportScheduleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("reports:export");
    const frequency = text(formData, "frequency") === "WEEKLY" ? "WEEKLY" : "DAILY";
    const recipients = text(formData, "recipients")
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    await createExportSchedule(actor, required(formData, "storeId"), {
      type: exportTypeField(formData),
      frequency,
      recipients,
    });
    revalidateAdmin("/admin/reports");
    return { ok: true, message: "Scheduled export চালু হয়েছে।" };
  } catch (error) {
    return message(error, "Schedule তৈরি করা যায়নি।");
  }
}

export async function deleteExportScheduleAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const { actor } = await ctx("reports:export");
    await deleteExportSchedule(actor, required(formData, "storeId"), required(formData, "scheduleId"));
    revalidateAdmin("/admin/reports");
    return { ok: true, message: "Schedule মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "Schedule মুছে ফেলা যায়নি।");
  }
}

// ── Navigation helper ────────────────────────────────────────────────────────

/** Reusable form-data reader for the client forms. */
// ── Storefront content pages ─────────────────────────────────────────────────

export async function saveContentPageAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    await saveContentPage(actor, required(formData, "storeId"), {
      id: text(formData, "pageId") || undefined,
      slug: text(formData, "slug"),
      title: text(formData, "title"),
      body: text(formData, "body"),
      status: text(formData, "status") || "ACTIVE",
    });
    revalidateAdmin("/admin/pages");
    return { ok: true, message: "পেজ সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "পেজ সংরক্ষণ করা যায়নি।");
  }
}

export async function archiveContentPageAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    await archiveContentPage(actor, required(formData, "storeId"), required(formData, "pageId"));
    revalidateAdmin("/admin/pages");
    return { ok: true, message: "পেজ আর্কাইভ হয়েছে।" };
  } catch (error) {
    return message(error, "পেজ আর্কাইভ করা যায়নি।");
  }
}

export async function noopAction(): Promise<void> {
  return;
}
