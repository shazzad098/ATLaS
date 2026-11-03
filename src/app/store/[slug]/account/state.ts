/**
 * Shared result shape for buyer-facing server actions.
 *
 * `stage: "code"` means the signup form has sent an OTP and the buyer must now
 * enter it; the rest of the fields stay in the same form.
 */

export type BuyerState = {
  ok: boolean;
  message: string;
  stage?: "code";
  devCode?: string;
  saved?: boolean;
};

export const EMPTY_BUYER_STATE: BuyerState = { ok: false, message: "" };
