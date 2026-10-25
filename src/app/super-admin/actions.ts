"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth/session";
import { adminUpdatePlan, runBillingSweep } from "@/lib/services/billing-service";
import type { PlanCode } from "@/lib/plans";
import { ensureThemeCatalog } from "@/lib/services/theme-service";
import { setTenantStatus, updateSupportTicket } from "@/lib/services/platform-service";
import type { SuperAdminState } from "@/app/super-admin/state";


/**
 * Super Admin server actions (PRD §4.5).
 *
 * Every handler re-checks `isSuperAdmin` server-side; nothing here trusts the
 * rendered nav.
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

function message(error: unknown, fallback: string): SuperAdminState {
  if (error instanceof AppError) return { ok: false, message: error.message };
  if (error instanceof Error && error.message) return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

/**
 * Plan configuration (PRD §4.5). Numbers are parsed here so the service only
 * ever receives validated values; an empty quota field means "unlimited".
 */
export async function updatePlanAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();

    /** Empty input means "not set" — for quota fields that is "unlimited". */
    const numberOrNull = (key: string): number | null => {
      const raw = text(formData, key).trim();
      if (raw === "") return null;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        throw new AppError("VALIDATION_FAILED", `${key} সঠিক সংখ্যা নয়।`, 422, { field: key });
      }
      return value;
    };

    const code = required(formData, "planCode") as PlanCode;
    // An empty price keeps the tier quote-only, which is the PRD default for
    // paid plans until business pricing is approved.
    const price = numberOrNull("price");

    const overagePercent = numberOrNull("overageRate") ?? 0;

    await adminUpdatePlan(user.id, code, {
      price,
      yearlyPrice: numberOrNull("yearlyPrice") ?? null,
      trialDays: numberOrNull("trialDays") ?? 7,
      limits: {
        products: numberOrNull("products"),
        monthlyOrders: numberOrNull("monthlyOrders"),
        storageMb: numberOrNull("storageMb"),
        staffSeats: numberOrNull("staffSeats") ?? 1,
        overageRate: Number((overagePercent / 100).toFixed(4)),
      },
    });

    revalidatePath("/super-admin/plans");
    return { ok: true, message: `${code} plan হালনাগাদ হয়েছে — entitlement cache রিফ্রেশ হয়েছে।` };
  } catch (error) {
    return message(error, "প্ল্যান সংরক্ষণ করা যায়নি।");
  }
}

export async function runBillingSweepAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const result = await runBillingSweep();

    await recordAudit({
      action: "platform.billing_sweep",
      actorId: user.id,
      resourceType: "Subscription",
      metadata: { ...result, source: text(formData, "source") || "super-admin" },
    });

    revalidatePath("/super-admin");
    return {
      ok: true,
      message: `Sweep সম্পন্ন — trial downgrade ${result.trialDowngrades}, invoice ${result.invoicesRaised}, reminder ${result.reminders}, read-only ${result.movedToReadOnly}, suspended ${result.suspended}।`,
    };
  } catch (error) {
    return message(error, "Billing sweep চালানো যায়নি।");
  }
}

export async function syncThemeCatalogAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const result = await ensureThemeCatalog();

    await recordAudit({
      action: "platform.theme_catalog_synced",
      actorId: user.id,
      resourceType: "Theme",
      metadata: { ...result, source: text(formData, "source") || "super-admin" },
    });

    revalidatePath("/super-admin/themes");
    return { ok: true, message: `${result.themes}টি theme ও ${result.versions}টি version sync হয়েছে।` };
  } catch (error) {
    return message(error, "Theme catalog sync করা যায়নি।");
  }
}

export async function setTenantStatusAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const status = required(formData, "status");
    if (!["ACTIVE", "READ_ONLY", "SUSPENDED", "CANCELLED"].includes(status)) {
      throw new AppError("VALIDATION_FAILED", "অবৈধ tenant status।", 422);
    }

    await setTenantStatus(
      user.id,
      required(formData, "tenantId"),
      status as "ACTIVE" | "READ_ONLY" | "SUSPENDED" | "CANCELLED",
    );

    revalidatePath("/super-admin/tenants");
    return { ok: true, message: `Tenant status ${status} করা হয়েছে।` };
  } catch (error) {
    return message(error, "Status পরিবর্তন করা যায়নি।");
  }
}

export async function updateTicketAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const assignedTo = text(formData, "assignedTo");

    await updateSupportTicket(user.id, required(formData, "ticketId"), {
      status: text(formData, "status") || undefined,
      priority: text(formData, "priority") || undefined,
      assignedTo: assignedTo ? assignedTo : undefined,
    });

    revalidatePath("/super-admin/tickets");
    return { ok: true, message: "টিকেট হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "টিকেট হালনাগাদ করা যায়নি।");
  }
}
