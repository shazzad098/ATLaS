"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { readSession, revokeAllSessions, revokeSession } from "@/lib/auth/session";
import {
  cancelAccountDeletion,
  changePassword,
  requestAccountDeletion,
  updateAccountProfile,
} from "@/lib/services/account-service";
import type { AdminState } from "@/app/admin/state";

/**
 * Account self-service actions (FR-01).
 *
 * These belong to the signed-in user rather than a store, so they never take a
 * tenant id: the user id comes from the verified session.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function message(error: unknown, fallback: string): AdminState {
  if (error instanceof AppError) return { ok: false, message: error.message };
  if (error instanceof Error && error.message) return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

async function currentUserId(): Promise<string> {
  const session = await readSession();
  if (!session) redirect("/login");
  return session.user.id;
}

export async function updateProfileAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const userId = await currentUserId();
    await updateAccountProfile(userId, {
      name: text(formData, "name"),
      email: text(formData, "email") || null,
    });
    revalidatePath("/account");
    return { ok: true, message: "প্রোফাইল সংরক্ষণ হয়েছে।" };
  } catch (error) {
    return message(error, "প্রোফাইল সংরক্ষণ করা যায়নি।");
  }
}

export async function changePasswordAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const userId = await currentUserId();
    await changePassword(userId, {
      currentPassword: text(formData, "currentPassword"),
      newPassword: text(formData, "newPassword"),
    });
    revalidatePath("/account");
    return { ok: true, message: "পাসওয়ার্ড পরিবর্তন হয়েছে।" };
  } catch (error) {
    return message(error, "পাসওয়ার্ড পরিবর্তন করা যায়নি।");
  }
}

export async function revokeSessionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const userId = await currentUserId();
    const sessionId = text(formData, "sessionId");
    const session = await readSession();

    if (sessionId === session?.sessionId) {
      return { ok: false, message: "বর্তমান সেশন এখান থেকে বন্ধ করা যাবে না — লগআউট ব্যবহার করুন।" };
    }

    await revokeSession(sessionId);
    revalidatePath("/account");
    return { ok: true, message: "সেশন বন্ধ করা হয়েছে।" };
  } catch (error) {
    return message(error, "সেশন বন্ধ করা যায়নি।");
  }
}

export async function revokeOtherSessionsAction(
  _prev: AdminState,
  _formData: FormData,
): Promise<AdminState> {
  try {
    const session = await readSession();
    if (!session) redirect("/login");

    const count = await revokeAllSessions(session.user.id, session.sessionId ?? undefined);
    revalidatePath("/account");
    return { ok: true, message: `${count}টি অন্য সেশন বন্ধ করা হয়েছে।` };
  } catch (error) {
    return message(error, "সেশন বন্ধ করা যায়নি।");
  }
}

export async function requestDeletionAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  try {
    const userId = await currentUserId();
    const result = await requestAccountDeletion(userId, { reason: text(formData, "reason") });
    revalidatePath("/account");
    return {
      ok: true,
      message: `অনুরোধ গ্রহণ হয়েছে — ${result.effectiveAt.toLocaleDateString("bn-BD")} পর্যন্ত বাতিল করা যাবে।`,
    };
  } catch (error) {
    return message(error, "অনুরোধ নেওয়া যায়নি।");
  }
}

export async function cancelDeletionAction(_prev: AdminState, _formData: FormData): Promise<AdminState> {
  try {
    const userId = await currentUserId();
    await cancelAccountDeletion(userId);
    revalidatePath("/account");
    return { ok: true, message: "মুছে ফেলার অনুরোধ বাতিল হয়েছে।" };
  } catch (error) {
    return message(error, "বাতিল করা যায়নি।");
  }
}
