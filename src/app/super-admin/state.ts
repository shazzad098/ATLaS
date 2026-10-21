/**
 * Shared result shape for Super Admin server actions.
 *
 * Kept out of `actions.ts` because a `"use server"` module may only export
 * async functions.
 */

export type SuperAdminState = { ok: boolean; message: string };

export const EMPTY_SUPER_ADMIN_STATE: SuperAdminState = { ok: false, message: "" };
