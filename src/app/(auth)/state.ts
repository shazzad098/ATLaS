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
  /**
   * The identifier (phone/email) the OTP was sent to. The second step renders it
   * as a hidden field: the OTP step deliberately does not trust a re-typed
   * number, and a remount of the form must not lose it.
   */
  identifier?: string;
  /** Signup OTP step: keep the typed name after the form resets. */
  name?: string;
  /** Signup OTP step: optional email, echoed back so verify still has it. */
  email?: string;
  /** Shown only while no SMS provider is configured, so beta users can sign in. */
  devCode?: string;
};

export const EMPTY_AUTH_STATE: AuthState = { ok: false, message: "" };
