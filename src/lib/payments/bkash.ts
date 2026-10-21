import { env } from "@/lib/env";
import {
  PaymentAdapterError,
  buildTxnId,
  safeJson,
  type CallbackResult,
  type InitiateContext,
  type InitiateResult,
  type PaymentAdapter,
} from "@/lib/payments/types";
import {
  SANDBOX_SIGNATURE_HEADER,
  sandboxCheckoutUrl,
  sandboxTxnId,
  verifySandboxSignature,
} from "@/lib/payments/sandbox";

/**
 * bKash Tokenized Checkout (FR-05).
 *
 * Live flow: grant token → create payment → redirect → execute payment on
 * callback. The three network calls below follow the documented v1.2.0-beta
 * contract; certification against the merchant's own credentials is still
 * pending, which is why the sandbox path exists.
 */

const SANDBOX_CALLBACK_KEY = "bkashTxnId";

async function grantToken(): Promise<string> {
  const { baseUrl, appKey, appSecret, username, password } = env.gateways.bkash;
  const response = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      username,
      password,
    },
    body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
  });
  if (!response.ok) {
    throw new PaymentAdapterError("bKash token grant ব্যর্থ হয়েছে।", "BKASH", {
      status: response.status,
    });
  }
  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new PaymentAdapterError("bKash token response অবৈধ।", "BKASH", data);
  }
  return data.id_token;
}

export const bkashAdapter: PaymentAdapter = {
  provider: "BKASH",
  label: "bKash",
  notes: "Merchant-এর নিজের bKash merchant account লাগবে (PRD §18.6 সিদ্ধান্তের অপেক্ষায়)।",

  isConfigured() {
    const { appKey, appSecret, username, password } = env.gateways.bkash;
    return Boolean(appKey && appSecret && username && password);
  },

  async initiate(context: InitiateContext): Promise<InitiateResult> {
    if (!this.isConfigured()) {
      return {
        providerTxnId: sandboxTxnId("BKS", context.orderNo),
        status: "PENDING",
        redirectUrl: sandboxCheckoutUrl(context, "BKASH"),
        sandbox: true,
        message: "bKash sandbox mode — real credentials যোগ করলে live হবে।",
      };
    }

    const token = await grantToken();
    const { baseUrl, appKey } = env.gateways.bkash;
    const response = await fetch(`${baseUrl}/tokenized/checkout/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: token,
        "x-app-key": appKey,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: context.customerPhone,
        callbackURL: context.callbackUrl,
        amount: context.amount,
        currency: context.currency,
        intent: "sale",
        merchantInvoiceNumber: context.orderNo,
      }),
    });

    const data = (await response.json()) as {
      paymentID?: string;
      bkashURL?: string;
      statusMessage?: string;
    };
    if (!response.ok || !data.paymentID || !data.bkashURL) {
      throw new PaymentAdapterError(
        data.statusMessage ?? "bKash payment create ব্যর্থ হয়েছে।",
        "BKASH",
        data,
      );
    }

    return {
      providerTxnId: data.paymentID,
      rawReference: data.paymentID,
      status: "PENDING",
      redirectUrl: data.bkashURL,
      sandbox: false,
    };
  },

  async parseCallback(request: Request, rawBody: string): Promise<CallbackResult> {
    const params = new URL(request.url).searchParams;
    const paymentId = params.get("paymentID") ?? request.headers.get("x-bkash-payment-id");
    const status = params.get("status");

    // bKash reports the outcome on the callback URL. The authoritative check is
    // the execute call, performed by `payment-service` before crediting.
    if (paymentId) {
      return {
        eventKey: `bkash:${paymentId}:${status ?? "unknown"}`,
        providerTxnId: paymentId,
        orderNo: params.get("merchantInvoiceNumber"),
        amount: params.get("amount"),
        status: status === "success" ? "SUCCEEDED" : status ? "FAILED" : "PENDING",
        signatureValid: true,
        raw: Object.fromEntries(params.entries()),
      };
    }

    return parseSandboxBody(rawBody, request);
  },

  async refund({ providerTxnId, amount }) {
    if (!this.isConfigured()) {
      return { ok: true, refundRef: `SBXREFUND-${providerTxnId}`, message: "Sandbox refund" };
    }
    const token = await grantToken();
    const { baseUrl } = env.gateways.bkash;
    const response = await fetch(`${baseUrl}/tokenized/checkout/payment/refund`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: token },
      body: JSON.stringify({ paymentID: providerTxnId, amount, trxID: providerTxnId }),
    });
    const data = (await response.json()) as { refundTrxID?: string; statusMessage?: string };
    return {
      ok: response.ok,
      refundRef: data.refundTrxID,
      message: data.statusMessage,
    };
  },
};

function parseSandboxBody(rawBody: string, request: Request): CallbackResult {
  const payload = safeJson(rawBody);
  return {
    eventKey: String(payload.eventKey ?? `bkash:${payload.providerTxnId ?? "unknown"}`),
    providerTxnId: payload.providerTxnId ? String(payload.providerTxnId) : null,
    orderNo: payload.orderNo ? String(payload.orderNo) : null,
    amount: payload.amount ? String(payload.amount) : null,
    status: payload.status === "FAILED" ? "FAILED" : payload.status === "SUCCEEDED" ? "SUCCEEDED" : "PENDING",
    signatureValid: verifySandboxSignature(rawBody, request.headers.get(SANDBOX_SIGNATURE_HEADER)),
    failureReason: payload.failureReason ? String(payload.failureReason) : undefined,
    raw: payload,
  };
}

export { SANDBOX_CALLBACK_KEY, buildTxnId };
