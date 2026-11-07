import { AppError } from "@/lib/errors";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { closeTicket, createTicket } from "@/lib/services/support-service";
import { cancelSubscription, changePlan, startTrial } from "@/lib/services/billing-service";
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
  createExportJob,
  createExportSchedule,
  deleteExportSchedule,
  EXPORT_TYPES,
  processExportJob,
  type ExportType,
} from "@/lib/services/report-service";
import { createWebhookEndpoint, deleteWebhookEndpoint } from "@/lib/services/webhook-service";
import { ctx, message, required, revalidateAdmin, text } from "@/app/admin/_actions/shared";
import type { AdminState } from "@/app/admin/state";

/**
 * Team, billing, notification, support and developer-integration actions.
 *
 * The bodies live here; `src/app/admin/actions.ts` keeps the `"use server"`
 * directive and re-exposes each one as a local async function so Next still
 * registers them as actions.
 */

export async function inviteStaffAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function updateStaffRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await updateStaffRole(actor, required(formData, "membershipId"), required(formData, "roleCode"));
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "Role হালনাগাদ হয়েছে।" };
  } catch (error) {
    return message(error, "Role হালনাগাদ করা যায়নি।");
  }
}

export async function createRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function updateRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function deleteRoleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await deleteRole(actor, required(formData, "roleId"));
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "রোল মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "রোল মুছে ফেলা যায়নি।");
  }
}

export async function removeStaffAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("staff:write");
    await removeStaff(actor, required(formData, "membershipId"));
    revalidateAdmin("/admin/staff");
    return { ok: true, message: "সদস্য সরানো হয়েছে।" };
  } catch (error) {
    return message(error, "সরানো যায়নি।");
  }
}

export async function changePlanAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function cancelSubscriptionAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("billing:write");
    await cancelSubscription(actor, { atPeriodEnd: formData.get("atPeriodEnd") === "on" });
    revalidateAdmin("/admin/billing");
    return { ok: true, message: "সাবস্ক্রিপশন বাতিল করা হয়েছে।" };
  } catch (error) {
    return message(error, "বাতিল করা যায়নি।");
  }
}

export async function markNotificationReadAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx();
    await markNotificationRead(actor.userId, required(formData, "notificationId"));
    revalidateAdmin("/admin/notifications");
    return { ok: true, message: "পড়া হয়েছে।" };
  } catch (error) {
    return message(error, "হালনাগাদ করা যায়নি।");
  }
}

export async function markAllNotificationsReadAction(
  _prev: AdminState,
  _formData: FormData,
): Promise<AdminState> {
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

export async function createTicketAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function closeTicketAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx();
    await closeTicket(actor, required(formData, "ticketId"));
    revalidateAdmin("/admin/support");
    return { ok: true, message: "টিকেট বন্ধ করা হয়েছে।" };
  } catch (error) {
    return message(error, "বন্ধ করা যায়নি।");
  }
}

export async function createApiKeyAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function revokeApiKeyAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await revokeApiKey(actor, required(formData, "keyId"));
    revalidateAdmin("/admin/developers");
    return { ok: true, message: "API key বাতিল করা হয়েছে।" };
  } catch (error) {
    return message(error, "Key বাতিল করা যায়নি।");
  }
}

export async function createWebhookAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function deleteWebhookAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("settings:write");
    await deleteWebhookEndpoint(actor, required(formData, "endpointId"));
    revalidateAdmin("/admin/developers");
    return { ok: true, message: "Webhook endpoint মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "Endpoint মুছে ফেলা যায়নি।");
  }
}

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

export async function createExportJobAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function createExportScheduleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
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

export async function deleteExportScheduleAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const { actor } = await ctx("reports:export");
    await deleteExportSchedule(actor, required(formData, "storeId"), required(formData, "scheduleId"));
    revalidateAdmin("/admin/reports");
    return { ok: true, message: "Schedule মুছে ফেলা হয়েছে।" };
  } catch (error) {
    return message(error, "Schedule মুছে ফেলা যায়নি।");
  }
}
