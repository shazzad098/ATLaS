import { env } from "@/lib/env";
import {
  PaymentAdapterError,
  buildTxnId,
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

/**
 * bKash Tokenized Checkout (FR-05).
 *
 * Live flow: grant token → create payment → redirect → execute payment on
 * callback. The three network calls below follow the documented v1.2.0-beta
 * contract; certification against the merchant's own credentials is still
 * pending, which is why the sandbox path exists.
 */

const SANDBOX_CALLBACK_KEY = "bkashTxnId";

type BkashConfig = { baseUrl: string; appKey: string; appSecret: string; username: string; password: string };

function config(credentials?: PaymentCredentials): BkashConfig {
  return {
    baseUrl: credentials?.baseUrl || env.gateways.bkash.baseUrl,
    appKey: credentials?.appKey || env.gateways.bkash.appKey,
    appSecret: credentials?.appSecret || env.gateways.bkash.appSecret,
    username: credentials?.username || env.gateways.bkash.username,
    password: credentials?.password || env.gateways.bkash.password,
  };
}

async function grantToken(gateway: BkashConfig): Promise<string> {
  const { baseUrl, appKey, appSecret, username, password } = gateway;
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

  isConfigured(credentials) {
    const { appKey, appSecret, username, password } = config(credentials);
    return Boolean(appKey && appSecret && username && password);
  },

  async initiate(context: InitiateContext): Promise<InitiateResult> {
    const gateway = config(context.credentials);
    if (!this.isConfigured(context.credentials)) {
      return {
        providerTxnId: sandboxTxnId("BKS", context.orderNo),
        status: "PENDING",
        redirectUrl: sandboxCheckoutUrl(context, "BKASH"),
        sandbox: true,
        message: "bKash sandbox mode — real credentials যোগ করলে live হবে।",
      };
    }

    const token = await grantToken(gateway);
    const { baseUrl, appKey } = gateway;
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

  async parseCallback(request: Request, rawBody: string, credentials): Promise<CallbackResult> {
    const params = new URL(request.url).searchParams;
    const paymentId = params.get("paymentID") ?? request.headers.get("x-bkash-payment-id");
    const status = params.get("status");
    const gateway = config(credentials);

    if (paymentId) {
      const execution = status === "success" ? await executePayment(paymentId, gateway) : { ok: false, message: status ?? "unknown" };
      return {
        eventKey: `bkash:${paymentId}:${status ?? "unknown"}`,
        providerTxnId: paymentId,
        orderNo: params.get("merchantInvoiceNumber"),
        amount: execution.amount ?? params.get("amount"),
        status: execution.ok ? "SUCCEEDED" : status ? "FAILED" : "PENDING",
        signatureValid: status === "success" ? execution.ok : true,
        failureReason: execution.ok ? undefined : execution.message,
        raw: Object.fromEntries(params.entries()),
      };
    }

    return parseSandboxBody(rawBody, request);
  },

  async refund({ providerTxnId, amount, credentials }) {
    const gateway = config(credentials);
    if (!this.isConfigured(credentials)) {
      return { ok: true, refundRef: `SBXREFUND-${providerTxnId}`, message: "Sandbox refund" };
    }
    const token = await grantToken(gateway);
    const { baseUrl } = gateway;
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

async function executePayment(paymentId: string, gateway: BkashConfig): Promise<{ ok: boolean; amount?: string; message?: string }> {
  try {
    const token = await grantToken(gateway);
    const response = await fetch(`${gateway.baseUrl}/tokenized/checkout/execute`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: token, "x-app-key": gateway.appKey },
      body: JSON.stringify({ paymentID: paymentId }),
    });
    const data = (await response.json()) as { transactionStatus?: string; amount?: string; statusMessage?: string };
    return {
      ok: response.ok && data.transactionStatus === "Completed",
      amount: data.amount,
      message: data.statusMessage ?? data.transactionStatus,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "bKash execute failed" };
  }
}

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
