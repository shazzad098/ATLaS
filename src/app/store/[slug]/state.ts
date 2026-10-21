/**
 * Storefront action result shape.
 *
 * Kept out of `actions.ts` because a `"use server"` module may only export
 * async functions; client components need the initial state at render time.
 */

export type ActionState = { ok: boolean; message: string };

export const EMPTY_ACTION_STATE: ActionState = { ok: false, message: "" };
