"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth/session";
import { adminUpdatePlan, markInvoicePaid, runBillingSweep } from "@/lib/services/billing-service";
import type { PlanCode } from "@/lib/plans";
import { ensureThemeCatalog, setThemeStatus } from "@/lib/services/theme-service";
import { setTenantStatus, updateSupportTicket, createTenantWorkspace } from "@/lib/services/platform-service";
import { endImpersonation, startImpersonation } from "@/lib/auth/impersonation";
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
 * Start a time-limited, read-only impersonation (PRD §4.5, §13).
 * A reason and support reference are mandatory; the workspace opens at /admin
 * with a persistent banner and every write is blocked by the read-only actor.
 */
export async function startImpersonationAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    await startImpersonation({
      superAdminId: user.id,
      tenantId: required(formData, "tenantId"),
      reason: text(formData, "reason"),
      reference: text(formData, "reference"),
    });
  } catch (error) {
    return message(error, "Impersonation শুরু করা যায়নি।");
  }

  redirect("/admin");
}

export async function stopImpersonationAction(): Promise<void> {
  const user = await requireSuperAdmin();
  await endImpersonation(user.id);
  redirect("/super-admin/tenants");
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
      message: `Sweep সম্পন্ন — free renewal ${result.freeRenewals}, trial downgrade ${result.trialDowngrades}, downgrade ${result.downgrades}, invoice ${result.invoicesRaised}, grace ${result.enteredGrace}, reminder ${result.reminders}, read-only ${result.movedToReadOnly}, suspended ${result.suspended}।`,
    };
  } catch (error) {
    return message(error, "Billing sweep চালানো যায়নি।");
  }
}

/**
 * Manual settlement is deliberately Super Admin-only. The service re-checks
 * `isSuperAdmin`, records an audit row with the reason, restores suspended
 * tenants/stores, and activates any pending plan change attached to the invoice.
 */
export async function markInvoicePaidAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const invoiceId = required(formData, "invoiceId");
    const reason = text(formData, "reason").trim() || "Manual settlement by Super Admin";
    await markInvoicePaid(user.id, invoiceId, reason);
    revalidatePath("/super-admin/billing");
    revalidatePath("/super-admin/fees");
    revalidatePath("/admin/billing");
    return { ok: true, message: "Invoice পরিশোধিত এবং subscription চালু হয়েছে।" };
  } catch (error) {
    return message(error, "Invoice settle করা যায়নি।");
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

/**
 * Activate/retire a theme. Retiring removes it from the merchant catalog while
 * stores that already picked it keep rendering it unchanged.
 */
export async function setThemeStatusAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const code = required(formData, "themeCode");
    const status = required(formData, "status");
    if (!["ACTIVE", "ARCHIVED"].includes(status)) {
      throw new AppError("VALIDATION_FAILED", "অবৈধ theme status।", 422);
    }

    await setThemeStatus(user.id, code, status as "ACTIVE" | "ARCHIVED");

    revalidatePath("/super-admin/themes");
    revalidatePath(`/super-admin/themes/${code}`);
    revalidatePath("/admin/design");
    return {
      ok: true,
      message: `${code} theme ${status === "ACTIVE" ? "ক্যাটালগে চালু" : "ক্যাটালগ থেকে বন্ধ"} করা হয়েছে।`,
    };
  } catch (error) {
    return message(error, "Theme status পরিবর্তন করা যায়নি।");
  }
}

/** Creates a merchant workspace (owner account + roles + plan subscription). */
export async function createTenantAction(
  _prev: SuperAdminState,
  formData: FormData,
): Promise<SuperAdminState> {
  try {
    const user = await requireSuperAdmin();
    const tenantName = required(formData, "tenantName");
    const ownerName = required(formData, "ownerName");
    const ownerPhone = required(formData, "ownerPhone");
    const planCode = required(formData, "planCode");

    await createTenantWorkspace(user.id, { tenantName, ownerName, ownerPhone, planCode });

    revalidatePath("/super-admin/tenants");
    return {
      ok: true,
      message: `“${tenantName}” workspace তৈরি হয়েছে — owner ${ownerPhone} দিয়ে OTP login করতে পারবেন।`,
    };
  } catch (error) {
    return message(error, "টেন্যান্ট তৈরি করা যায়নি।");
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
