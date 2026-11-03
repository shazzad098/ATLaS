/** State returned by the 2FA server actions (kept out of the "use server" file). */
export type TwoFactorState = {
  ok: boolean;
  message: string;
  step?: "idle" | "setup" | "recovery";
  secret?: string;
  otpauthUri?: string;
  recoveryCodes?: string[];
};

export const EMPTY_TWO_FACTOR_STATE: TwoFactorState = { ok: false, message: "", step: "idle" };
