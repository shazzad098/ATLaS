import { env } from "@/lib/env";
import {
  PaymentAdapterError,
  safeJson,
  type CallbackResult,
  type InitiateContext,
  type InitiateResult,
  type PaymentAdapter,
  type PaymentCredentials,
} from "@/lib/payments/types";
import {
  SANDBOX_SIGNATURE_HEADER,
  sandboxCheckoutUrl,
  sandboxTxnId,
  verifySandboxSignature,
} from "@/lib/payments/sandbox";

type SslcommerzConfig = { baseUrl: string; storeId: string; storePassword: string };

function config(credentials?: PaymentCredentials): SslcommerzConfig {
  return {
    baseUrl: credentials?.baseUrl || env.gateways.sslcommerz.baseUrl,
    storeId: credentials?.storeId || env.gateways.sslcommerz.storeId,
    storePassword: credentials?.storePassword || env.gateways.sslcommerz.storePassword,
  };
}

/**
 * SSLCommerz Hosted Checkout (FR-05).
 *
 * Live flow: create a session, redirect to `GatewayPageURL`, then validate the
 * callback with `validationserverAPI` before crediting the order. Validation is
 * mandatory — a success callback alone is not proof of payment.
 */

export const sslcommerzAdapter: PaymentAdapter = {
  provider: "SSLCOMMERZ",
  label: "SSLCommerz",
  notes: "Card, mobile banking ও net banking একসাথে — store id/password দিলেই live।",

  isConfigured(credentials) {
    const { storeId, storePassword } = config(credentials);
    return Boolean(storeId && storePassword);
  },

  async initiate(context: InitiateContext): Promise<InitiateResult> {
    const gateway = config(context.credentials);
    if (!this.isConfigured(context.credentials)) {
      return {
        providerTxnId: sandboxTxnId("SSL", context.orderNo),
        status: "PENDING",
        redirectUrl: sandboxCheckoutUrl(context, "SSLCOMMERZ"),
        sandbox: true,
        message: "SSLCommerz sandbox mode।",
      };
    }

    const { baseUrl, storeId, storePassword } = gateway;
    const body = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: context.amount,
      currency: context.currency,
      tran_id: context.orderNo,
      success_url: context.successUrl,
      fail_url: context.failureUrl,
      cancel_url: context.failureUrl,
      cus_name: context.customerName,
      cus_phone: context.customerPhone,
      cus_email: "customer@atlas.example",
      cus_add1: "Bangladesh",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "Courier",
      product_name: `Order ${context.orderNo}`,
      product_category: "General",
      product_profile: "general",
      num_of_item: "1",
      value_a: context.orderId,
    });

    const response = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await response.json()) as {
      status?: string;
      GatewayPageURL?: string;
      sessionkey?: string;
      failedreason?: string;
    };

    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      throw new PaymentAdapterError(
        data.failedreason ?? "SSLCommerz session তৈরি করা যায়নি।",
        "SSLCOMMERZ",
        data,
      );
    }

    return {
      providerTxnId: data.sessionkey ?? context.orderNo,
      rawReference: data.sessionkey,
      status: "PENDING",
      redirectUrl: data.GatewayPageURL,
      sandbox: false,
    };
  },

  async parseCallback(request: Request, rawBody: string, credentials): Promise<CallbackResult> {
    const payload = safeJson(rawBody);
    const tranId = typeof payload.tran_id === "string" ? payload.tran_id : null;
    const valId = typeof payload.val_id === "string" ? payload.val_id : null;

    if (tranId && valId) {
      const validation = await validateTransaction(valId, config(credentials));
      const ok = validation.ok && validation.amount !== undefined;

      return {
        eventKey: `sslcommerz:${valId}`,
        providerTxnId: valId,
        orderNo: tranId,
        amount: validation.amount ?? null,
        status: ok ? "SUCCEEDED" : "FAILED",
        // A valid `val_id` plus a server-side validation response is the
        // signature check for SSLCommerz.
        signatureValid: validation.ok,
        failureReason: ok ? undefined : validation.message,
        raw: payload,
      };
    }

    return {
      eventKey: String(payload.eventKey ?? `sslcommerz:${payload.providerTxnId ?? "unknown"}`),
      providerTxnId: payload.providerTxnId ? String(payload.providerTxnId) : null,
      orderNo: payload.orderNo ? String(payload.orderNo) : null,
      amount: payload.amount ? String(payload.amount) : null,
      status:
        payload.status === "FAILED"
          ? "FAILED"
          : payload.status === "SUCCEEDED"
            ? "SUCCEEDED"
            : "PENDING",
      signatureValid: verifySandboxSignature(rawBody, request.headers.get(SANDBOX_SIGNATURE_HEADER)),
      failureReason: payload.failureReason ? String(payload.failureReason) : undefined,
      raw: payload,
    };
  },

  async refund({ providerTxnId, amount, credentials }) {
    const gateway = config(credentials);
    if (!this.isConfigured(credentials)) {
      return { ok: true, refundRef: `SBXREFUND-${providerTxnId}` };
    }
    const { baseUrl, storeId, storePassword } = gateway;
    const response = await fetch(`${baseUrl}/validator/api/merchantTransIDvalidationAPI.php`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        bank_tran_id: providerTxnId,
        refund_amount: amount,
        refund_remarks: "ATLaS order refund",
        store_id: storeId,
        store_passwd: storePassword,
        format: "json",
      }),
    });
    const data = (await response.json()) as { refund_ref_id?: string; errorReason?: string };
    return { ok: response.ok, refundRef: data.refund_ref_id, message: data.errorReason };
  },
};

async function validateTransaction(
  valId: string,
  gateway: SslcommerzConfig,
): Promise<{ ok: boolean; amount?: string; message?: string }> {
  const { baseUrl, storeId, storePassword } = gateway;
  const url = new URL(`${baseUrl}/validator/api/validationserverAPI.php`);
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", storeId);
  url.searchParams.set("store_passwd", storePassword);
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, message: `validation HTTP ${response.status}` };
    const data = (await response.json()) as { status?: string; amount?: string; error?: string };
    if (data.status !== "VALID" && data.status !== "VALIDATED") {
      return { ok: false, message: data.error ?? `status ${data.status}` };
    }
    return { ok: true, amount: data.amount };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "validation failed" };
  }
}
