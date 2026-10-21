import { AppError } from "@/lib/errors";
import { bkashAdapter } from "@/lib/payments/bkash";
import { codAdapter } from "@/lib/payments/cod";
import { nagadAdapter } from "@/lib/payments/nagad";
import { sslcommerzAdapter } from "@/lib/payments/sslcommerz";
import type {
  CallbackResult,
  InitiateContext,
  InitiateResult,
  PaymentAdapter,
  PaymentProviderName,
} from "@/lib/payments/types";

/**
 * Payment adapter registry (FR-05).
 *
 * The rest of the app depends on `PaymentAdapter`, never on a gateway SDK, so a
 * provider can be swapped or added without touching checkout or billing.
 */
const REGISTRY: Record<PaymentProviderName, PaymentAdapter> = {
  COD: codAdapter,
  BKASH: bkashAdapter,
  NAGAD: nagadAdapter,
  SSLCOMMERZ: sslcommerzAdapter,
};

export const PAYMENT_PROVIDERS: PaymentProviderName[] = ["COD", "BKASH", "NAGAD", "SSLCOMMERZ"];

export function getPaymentAdapter(provider: string): PaymentAdapter {
  const adapter = REGISTRY[provider.toUpperCase() as PaymentProviderName];
  if (!adapter) {
    throw new AppError("VALIDATION_FAILED", `অজানা payment provider: ${provider}`, 422, {
      supported: PAYMENT_PROVIDERS,
    });
  }
  return adapter;
}

export function allPaymentAdapters(): PaymentAdapter[] {
  return Object.values(REGISTRY);
}

/** Merchant-facing configuration status for Admin → Payments. */
export function paymentAdapterStatus() {
  return allPaymentAdapters().map((adapter) => ({
    provider: adapter.provider,
    label: adapter.label,
    notes: adapter.notes,
    configured: adapter.isConfigured(),
  }));
}

export { SANDBOX_SIGNATURE_HEADER, signSandboxPayload } from "@/lib/payments/sandbox";
export type { CallbackResult, InitiateContext, InitiateResult, PaymentAdapter, PaymentProviderName };
