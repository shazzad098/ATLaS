/**
 * Authentication action result shape.
 *
 * Kept out of `actions.ts` because a `"use server"` module may only export
 * async functions; the login/signup forms need the initial state at render time.
 */

export type AuthState = {
  ok: boolean;
  message: string;
  step?: "credentials" | "otp";
  /** Shown only while no SMS provider is configured, so beta users can sign in. */
  devCode?: string;
};

export const EMPTY_AUTH_STATE: AuthState = { ok: false, message: "" };
