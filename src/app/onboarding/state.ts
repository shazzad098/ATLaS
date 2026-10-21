/**
 * Onboarding action result shape.
 *
 * Kept out of `actions.ts` because a `"use server"` module may only export
 * async functions; the form needs the initial state at render time.
 */

export type OnboardingState = { ok: boolean; message: string };

export const EMPTY_ONBOARDING_STATE: OnboardingState = { ok: false, message: "" };
