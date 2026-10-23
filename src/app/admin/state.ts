/**
 * Shared result shape for admin server actions.
 *
 * This lives outside `actions.ts` because a `"use server"` module may only
 * export async functions — the initial state value has to come from a plain
 * module so client components can read it at render time.
 */

export type AdminState = {
  ok: boolean;
  message: string;
  /** Optional preview payload, e.g. the per-row outcome of a CSV dry-run. */
  data?: {
    results?: Array<{
      row: number;
      sku: string;
      name: string;
      action: "create" | "update" | "skip";
      errors: string[];
    }>;
  };
};

export const EMPTY_ADMIN_STATE: AdminState = { ok: false, message: "" };
