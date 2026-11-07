import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { recordCodCollection, refundOrder } from "@/lib/services/payment-service";
import { createCourierShipment, syncCourierShipment } from "@/lib/services/courier-service";
import { resolveReturn, updateOrderStatus, type OrderStatusValue } from "@/lib/services/order-service";
import { setCustomerBlacklist, updateCustomerConsent } from "@/lib/services/customer-service";
import {
  createDeliveryZone,
  deleteDeliveryZone,
  saveDeliveryMethod,
  togglePaymentMethod,
  updateDeliveryZone,
} from "@/lib/services/store-service";
import { archiveCoupon, createCoupon, updateCoupon } from "@/lib/services/coupon-service";
import { ctx, message, required, revalidateAdmin, text } from "@/app/admin/_actions/shared";
import type { AdminState } from "@/app/admin/state";

/**
 * Order, customer, fulfilment and discount actions.
 *
 * The bodies live here; `src/app/admin/actions.ts` keeps the `"use server"`
 * directive and re-exposes each one as a local async function so Next still
 * registers them as actions.
 */

export async function updateOrderStatusAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function recordCodAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function refundOrderAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function resolveReturnAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function saveDeliveryZoneAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function deleteDeliveryZoneAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("delivery:write");
    await deleteDeliveryZone(actor, required(formData, "storeId"), required(formData, "zoneId"));
    revalidateAdmin("/admin/delivery");
    return { ok: true, message: "জোন মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "মুছে ফেলা যায়নি।");
  }
}

export async function saveDeliveryMethodAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function createShipmentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function syncShipmentAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function togglePaymentMethodAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function saveCouponAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function archiveCouponAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("discounts:write");
    await archiveCoupon(actor, required(formData, "storeId"), required(formData, "couponId"));
    revalidateAdmin("/admin/discounts");
    return { ok: true, message: "কুপন archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}
