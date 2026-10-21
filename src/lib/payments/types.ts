/**
 * Payment adapter contract (FR-05).
 *
 * Each gateway implements the same four methods, so adding a provider is one
 * file plus a registry line. `isConfigured()` is what makes beta usable while
 * gateway onboarding is pending (PRD §17): unconfigured adapters run a sandbox
 * flow that exercises the real callback path end to end.
 */

export type PaymentProviderName = "COD" | "BKASH" | "NAGAD" | "SSLCOMMERZ";

export type InitiateContext = {
  orderId: string;
  orderNo: string;
  amount: string;
  currency: string;
  customerName: string;
  customerPhone: string;
  callbackUrl: string;
  successUrl: string;
  failureUrl: string;
};

export type InitiateResult = {
  providerTxnId: string;
  rawReference?: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  /** Where to send the shopper. Absent for COD. */
  redirectUrl?: string;
  sandbox: boolean;
  message?: string;
};

export type CallbackResult = {
  /** Stable per-provider event id; used for webhook idempotency. */
  eventKey: string;
  providerTxnId: string | null;
  orderNo: string | null;
  amount: string | null;
  status: "SUCCEEDED" | "FAILED" | "PENDING";
  signatureValid: boolean;
  failureReason?: string;
  raw: Record<string, unknown>;
};

export interface PaymentAdapter {
  readonly provider: PaymentProviderName;
  readonly label: string;
  /** Merchant-facing notes shown in Admin → Payments. */
  readonly notes: string;
  isConfigured(): boolean;
  initiate(context: InitiateContext): Promise<InitiateResult>;
  parseCallback(request: Request, rawBody: string): Promise<CallbackResult>;
  refund(input: { providerTxnId: string; amount: string }): Promise<{
    ok: boolean;
    refundRef?: string;
    message?: string;
  }>;
}

export class PaymentAdapterError extends Error {
  constructor(
    message: string,
    readonly provider: PaymentProviderName,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PaymentAdapterError";
  }
}

/** Shared helper: numeric reference with a provider-specific prefix. */
export function buildTxnId(prefix: string, orderNo: string): string {
  return `${prefix}${orderNo.replace(/[^A-Za-z0-9]/g, "")}${Date.now().toString(36).toUpperCase()}`;
}

/** Tolerant JSON parse for callback bodies that may be empty or malformed. */
export function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Query/JSON payload as a plain object, for callback logging. */
export function requestParams(request: Request, rawBody: string): Record<string, unknown> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return { ...params, ...safeJson(rawBody) };
}
