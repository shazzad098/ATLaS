/**
 * Result shape for the public contact form.
 *
 * A `"use server"` module may only export async functions, so the initial value
 * lives here where the client component can read it at render time.
 */

export type ContactState = { ok: boolean; message: string };

export const EMPTY_CONTACT_STATE: ContactState = { ok: false, message: "" };
