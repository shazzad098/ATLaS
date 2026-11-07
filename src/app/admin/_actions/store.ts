import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { STORE_COOKIE, getWorkspace } from "@/lib/tenant";
import type { ActorContext } from "@/lib/rbac";
import {
  archiveStore,
  publishStore,
  unpublishStore,
  updateStoreSettings,
} from "@/lib/services/store-service";
import {
  provisionDomainTls,
  removeDomain,
  addCustomDomain,
  setPrimaryDomain,
  verifyDomain,
} from "@/lib/services/domain-service";
import { publishTheme, resetThemeDraft, saveThemeDraft, selectTheme } from "@/lib/services/theme-service";
import { archiveContentPage, saveContentPage } from "@/lib/services/content-service";
import { ctx, message, required, revalidateAdmin, text } from "@/app/admin/_actions/shared";
import type { AdminState } from "@/app/admin/state";

/**
 * Store lifecycle, design (theme), custom-domain and content-page actions.
 *
 * The bodies live here; `src/app/admin/actions.ts` keeps the `"use server"`
 * directive and re-exposes each one as a local async function so Next still
 * registers them as actions.
 */

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

export async function publishStoreAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("store:publish");
    await publishStore(actor, required(formData, "storeId"));
    revalidateAdmin("/admin", "/admin/settings", `/store/${text(formData, "slug")}`);
    return { ok: true, message: "দোকান publish হয়েছে।" };
  } catch (error) {
    return message(error, "Publish করা যায়নি।");
  }
}

export async function unpublishStoreAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("store:publish");
    await unpublishStore(actor, required(formData, "storeId"));
    revalidateAdmin("/admin", "/admin/settings");
    return { ok: true, message: "দোকান unpublish করা হয়েছে।" };
  } catch (error) {
    return message(error, "Unpublish করা যায়নি।");
  }
}

export async function archiveStoreAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("store:write");
    await archiveStore(actor, required(formData, "storeId"));
    revalidateAdmin("/admin");
    return { ok: true, message: "দোকান archive করা হয়েছে।" };
  } catch (error) {
    return message(error, "Archive করা যায়নি।");
  }
}

export async function updateStoreSettingsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function selectThemeAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function saveThemeDraftAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function publishThemeAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    await publishTheme(actor, required(formData, "storeId"), required(formData, "themeVersionId"));
    revalidateAdmin("/admin/design", "/");
    return { ok: true, message: "থিম publish হয়েছে।" };
  } catch (error) {
    return message(error, "Publish করা যায়নি।");
  }
}

export async function resetThemeDraftAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("design:write");
    await resetThemeDraft(actor, required(formData, "storeId"), required(formData, "themeVersionId"));
    revalidateAdmin("/admin/design");
    return { ok: true, message: "ড্রাফট রিসেট হয়েছে।" };
  } catch (error) {
    return message(error, "রিসেট করা যায়নি।");
  }
}

export async function addDomainAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await addCustomDomain(actor, required(formData, "storeId"), { host: text(formData, "host") });
    revalidateAdmin("/admin/settings");
    return { ok: true, message: "ডোমেইন যোগ হয়েছে — DNS যাচাই করুন।" };
  } catch (error) {
    return message(error, "ডোমেইন যোগ করা যায়নি।");
  }
}

export async function verifyDomainAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function provisionDomainTlsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function setPrimaryDomainAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await setPrimaryDomain(actor, required(formData, "storeId"), required(formData, "domainId"));
    revalidateAdmin("/admin/settings");
    return { ok: true, message: "প্রাইমারি ডোমেইন হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

export async function removeDomainAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await removeDomain(actor, required(formData, "storeId"), required(formData, "domainId"));
    revalidateAdmin("/admin/settings");
    return { ok: true, message: "ডোমেইন সরানো হয়েছে।" };
  } catch (error) {
    return message(error, "সরানো যায়নি।");
  }
}

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
