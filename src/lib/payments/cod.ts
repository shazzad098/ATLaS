import type { CallbackResult, InitiateContext, InitiateResult, PaymentAdapter } from "@/lib/payments/types";

/**
 * Cash on Delivery — a first-class payment method (FR-05).
 *
 * There is no gateway interaction: the order is confirmed by the merchant and
 * the platform fee becomes payable at that point (PRD §5.1 "merchant-confirmed
 * COD order").
 */
export const codAdapter: PaymentAdapter = {
  provider: "COD",
  label: "Cash on Delivery",
  notes: "কুরিয়ার টাকা সংগ্রহ করে। Order confirm হওয়ার সাথে সাথেই platform fee প্রযোজ্য হয়।",

  isConfigured() {
    return true;
  },

  async initiate(context: InitiateContext): Promise<InitiateResult> {
    return {
      providerTxnId: `COD-${context.orderNo}`,
      status: "PENDING",
      sandbox: false,
      message: "ক্যাশ অন ডেলিভারি — ডেলিভারির সময় পেমেন্ট।",
    };
  },

  async parseCallback(request: Request, rawBody: string): Promise<CallbackResult> {
    const payload = safeJson(rawBody);
    return {
      eventKey: String(payload.eventKey ?? `cod-${payload.orderNo ?? "unknown"}`),
      providerTxnId: payload.providerTxnId ? String(payload.providerTxnId) : null,
      orderNo: payload.orderNo ? String(payload.orderNo) : null,
      amount: payload.amount ? String(payload.amount) : null,
      // COD collection is recorded by staff, not by an inbound webhook.
      status: "PENDING",
      signatureValid: true,
      raw: payload,
    };
  },

  async refund() {
    return { ok: true, message: "COD refund merchant ledger-এ ম্যানুয়ালি রেকর্ড করুন।" };
  },
};

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
