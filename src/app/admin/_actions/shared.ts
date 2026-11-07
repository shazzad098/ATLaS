import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { getWorkspace } from "@/lib/tenant";
import type { ActorContext, Permission } from "@/lib/rbac";
import type { AdminState } from "@/app/admin/state";

/**
 * Shared plumbing for the merchant admin server actions.
 *
 * `src/app/admin/actions.ts` stays the single `"use server"` entry point — the
 * only place Next registers actions — while the bodies live in the plain
 * modules under `_actions/`. Keeping the directive and the exports in one file
 * means a refactor here can never change how an action is registered.
 */

export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function required(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) throw new AppError("VALIDATION_FAILED", "অনুরোধে প্রয়োজনীয় তথ্য নেই।", 422, { field: key });
  return value;
}

/** Resolve the caller and (optionally) enforce a permission before any work. */
export async function ctx(permission?: Permission): Promise<{ actor: ActorContext }> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");

  if (permission && !workspace.actor.permissions.includes(permission)) {
    throw new AppError("FORBIDDEN", "এই কাজের অনুমতি আপনার role-এ নেই।", 403, {
      requiredPermission: permission,
    });
  }

  return { actor: workspace.actor };
}

export function message(error: unknown, fallback: string): AdminState {
  if (error instanceof AppError) return { ok: false, message: error.message };
  if (error instanceof Error && error.message) return { ok: false, message: error.message };
  return { ok: false, message: fallback };
}

export function revalidateAdmin(...paths: string[]): void {
  for (const path of paths) revalidatePath(path);
}
