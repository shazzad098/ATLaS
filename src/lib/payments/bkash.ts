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

type BkashVerification = {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  merchantInvoiceNumber?: string;
  [key: string]: unknown;
};

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

async function callCheckout(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: BkashVerification }> {
  const token = await grantToken();
  const { baseUrl, appKey } = env.gateways.bkash;
  const response = await fetch(`${baseUrl}/tokenized/checkout/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: token,
      "x-app-key": appKey,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as BkashVerification;
  return { ok: response.ok, status: response.status, data };
}

function isCompleted(data: BkashVerification): boolean {
  const status = (data.transactionStatus ?? "").toLowerCase();
  return status === "completed" || (status === "" && data.statusCode === "0000" && Boolean(data.trxID));
}

/**
 * Executes a bKash payment and, if execution cannot be completed (for example
 * because the callback was replayed), asks bKash for the authoritative status.
 * A success callback is never trusted without one of these server-side checks.
 */
async function verifyLivePayment(
  paymentId: string,
): Promise<{ authoritative: boolean; data?: BkashVerification; error?: string }> {
  let executeError: string | undefined;
  try {
    const execute = await callCheckout("execute", { paymentID: paymentId });
    if (
      execute.ok &&
      (execute.data.transactionStatus !== undefined || execute.data.statusCode !== undefined)
    ) {
      return { authoritative: true, data: execute.data };
    }
    executeError =
      execute.data.statusMessage ?? `bKash execute HTTP ${execute.status}`;
  } catch (error) {
    executeError = error instanceof Error ? error.message : "bKash execute failed";
  }

  try {
    const query = await callCheckout("payment/status", { paymentID: paymentId });
    if (query.ok && query.data.statusCode !== undefined) {
      return { authoritative: true, data: query.data };
    }
    return {
      authoritative: false,
      error: query.data.statusMessage ?? executeError ?? "bKash status check failed",
    };
  } catch (error) {
    return {
      authoritative: false,
      error: error instanceof Error ? error.message : (executeError ?? "bKash status check failed"),
    };
  }
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

    // bKash callbacks are not signed. The only authoritative proof is the
    // server-side execute call (or a status query if execute is replayed), so a
    // request that only claims `status=success` is never trusted.
    if (paymentId) {
      if (!this.isConfigured()) {
        return {
          eventKey: `bkash:${paymentId}:${status ?? "unverified"}`,
          providerTxnId: paymentId,
          orderNo: params.get("merchantInvoiceNumber"),
          amount: params.get("amount"),
          status: "PENDING",
          signatureValid: false,
          failureReason: "bKash credentials are not configured; callback cannot be verified.",
          raw: Object.fromEntries(params.entries()),
        };
      }

      const verification = await verifyLivePayment(paymentId);
      if (!verification.authoritative || !verification.data) {
        return {
          eventKey: `bkash:${paymentId}:${status ?? "unverified"}`,
          providerTxnId: paymentId,
          orderNo: params.get("merchantInvoiceNumber"),
          amount: params.get("amount"),
          status: "PENDING",
          signatureValid: false,
          failureReason: verification.error ?? "bKash verification failed.",
          raw: {
            callback: Object.fromEntries(params.entries()),
            verificationError: verification.error ?? "unknown",
          },
        };
      }

      const data = verification.data;
      const succeeded = isCompleted(data);
      return {
        // trxID is stable across callback retries once bKash completes the
        // payment; the callback `status` alone is not an idempotency key.
        eventKey: `bkash:${paymentId}:${data.trxID ?? status ?? "unknown"}:${succeeded ? "success" : "failed"}`,
        providerTxnId: data.paymentID ?? paymentId,
        orderNo: data.merchantInvoiceNumber ?? null,
        // Only the execute/status response is authoritative; the callback
        // query string can be edited by the browser.
        amount: data.amount ?? null,
        currency: data.currency ?? null,
        status: succeeded ? "SUCCEEDED" : "FAILED",
        signatureValid: true,
        failureReason: succeeded
          ? undefined
          : (data.statusMessage ?? data.transactionStatus ?? "bKash declined the payment."),
        raw: {
          callback: Object.fromEntries(params.entries()),
          verification: data,
        },
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
    orderId: payload.orderId ? String(payload.orderId) : null,
    amount: payload.amount ? String(payload.amount) : null,
    currency: payload.currency ? String(payload.currency) : "BDT",
    status: payload.status === "FAILED" ? "FAILED" : payload.status === "SUCCEEDED" ? "SUCCEEDED" : "PENDING",
    signatureValid: verifySandboxSignature(rawBody, request.headers.get(SANDBOX_SIGNATURE_HEADER)),
    failureReason: payload.failureReason ? String(payload.failureReason) : undefined,
    raw: payload,
  };
}

export { SANDBOX_CALLBACK_KEY, buildTxnId };
