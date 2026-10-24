import { constants, publicEncrypt } from "node:crypto";
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

type NagadConfig = { baseUrl: string; merchantId: string; privateKey: string };

function config(credentials?: PaymentCredentials): NagadConfig {
  return {
    baseUrl: credentials?.baseUrl || env.gateways.nagad.baseUrl,
    merchantId: credentials?.merchantId || env.gateways.nagad.merchantId,
    privateKey: credentials?.privateKey || env.gateways.nagad.privateKey,
  };
}

/**
 * Nagad Remote Payment Gateway (FR-05).
 *
 * Live flow: `initialize` (sensitive payload RSA-encrypted with Nagad's public
 * key) → `complete` → shopper is redirected to the challenge URL → callback is
 * confirmed with `verify/payment`. The RSA key pair comes from the merchant's
 * Nagad onboarding, hence the sandbox fallback.
 */

export const nagadAdapter: PaymentAdapter = {
  provider: "NAGAD",
  label: "Nagad",
  notes: "Nagad merchant onboarding-এর RSA key pair ছাড়া live flow চালু হবে না।",

  isConfigured(credentials) {
    const { merchantId, privateKey } = config(credentials);
    return Boolean(merchantId && privateKey);
  },

  async initiate(context: InitiateContext): Promise<InitiateResult> {
    const gateway = config(context.credentials);
    if (!this.isConfigured(context.credentials)) {
      return {
        providerTxnId: sandboxTxnId("NGD", context.orderNo),
        status: "PENDING",
        redirectUrl: sandboxCheckoutUrl(context, "NAGAD"),
        sandbox: true,
        message: "Nagad sandbox mode।",
      };
    }

    const { baseUrl, merchantId } = gateway;
    const reference = `NGD${Date.now()}`;

    const initialize = await fetch(
      `${baseUrl}/remote-payment-gateway-1.0/api/dfs/check-out/initialize/${merchantId}/${context.orderNo}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "X-KM-Api-Version": "v-0.2.0" },
        body: JSON.stringify({
          accountNumber: context.customerPhone,
          dateTime: new Date().toISOString(),
          sensitiveData: encryptSensitiveData({
            merchantId,
            datetime: new Date().toISOString(),
            orderId: context.orderNo,
            currencyCode: context.currency,
            amount: context.amount,
            challenge: reference,
          }, gateway.privateKey),
        }),
      },
    );

    const initData = (await initialize.json()) as {
      paymentReferenceId?: string;
      callBackUrl?: string;
      sensitiveData?: string;
      reason?: string;
    };
    if (!initialize.ok || !initData.paymentReferenceId || !initData.callBackUrl) {
      throw new PaymentAdapterError(
        initData.reason ?? "Nagad initialize ব্যর্থ হয়েছে।",
        "NAGAD",
        initData,
      );
    }

    const complete = await fetch(`${initData.callBackUrl}/complete/${initData.paymentReferenceId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-KM-Api-Version": "v-0.2.0" },
      body: JSON.stringify({ paymentReferenceId: initData.paymentReferenceId }),
    });
    const completeData = (await complete.json()) as { callBackUrl?: string; reason?: string };
    if (!complete.ok || !completeData.callBackUrl) {
      throw new PaymentAdapterError(
        completeData.reason ?? "Nagad complete ব্যর্থ হয়েছে।",
        "NAGAD",
        completeData,
      );
    }

    return {
      providerTxnId: initData.paymentReferenceId,
      rawReference: initData.paymentReferenceId,
      status: "PENDING",
      redirectUrl: completeData.callBackUrl,
      sandbox: false,
    };
  },

  async parseCallback(request: Request, rawBody: string, credentials): Promise<CallbackResult> {
    const payload = safeJson(rawBody);
    const params = new URL(request.url).searchParams;
    const paymentRefId = params.get("payment_ref_id") ?? (payload.payment_ref_id as string | undefined);
    const status = params.get("status") ?? (payload.status as string | undefined);
    const gateway = config(credentials);

    if (paymentRefId) {
      // The authoritative verification is the `verify/payment` call below.
      const verified =
        status === "Success"
          ? await verifyPayment(paymentRefId, gateway)
          : { ok: false as const, message: status ?? "unknown" };

      return {
        eventKey: `nagad:${paymentRefId}:${status ?? "unknown"}`,
        providerTxnId: paymentRefId,
        orderNo: params.get("order_id") ?? null,
        amount: params.get("amount") ?? null,
        status: verified.ok ? "SUCCEEDED" : "FAILED",
        signatureValid: true,
        failureReason: verified.ok ? undefined : verified.message,
        raw: Object.fromEntries(params.entries()),
      };
    }

    return {
      eventKey: String(payload.eventKey ?? `nagad:${payload.providerTxnId ?? "unknown"}`),
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
    const { baseUrl } = gateway;
    const response = await fetch(`${baseUrl}/remote-payment-gateway-1.0/api/dfs/refund/payment`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-KM-Api-Version": "v-0.2.0" },
      body: JSON.stringify({ paymentRefId: providerTxnId, refundAmount: amount }),
    });
    const data = (await response.json()) as { refundRefId?: string; reason?: string };
    return { ok: response.ok, refundRef: data.refundRefId, message: data.reason };
  },
};

async function verifyPayment(paymentRefId: string, gateway: NagadConfig): Promise<{ ok: boolean; message?: string }> {
  const { baseUrl } = gateway;
  try {
    const response = await fetch(
      `${baseUrl}/remote-payment-gateway-1.0/api/dfs/verify/payment/${paymentRefId}`,
      { headers: { "X-KM-Api-Version": "v-0.2.0" } },
    );
    if (!response.ok) return { ok: false, message: `verify HTTP ${response.status}` };
    const data = (await response.json()) as { status?: string; reason?: string };
    return { ok: data.status === "Success", message: data.reason };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "verify failed" };
  }
}

/**
 * Nagad requires the sensitive block to be RSA-encrypted with their public key.
 * The key is issued per merchant, so this throws a clear, actionable error until
 * onboarding supplies it rather than silently sending plaintext.
 */
function encryptSensitiveData(payload: Record<string, unknown>, privateKey: string): string {
  if (!privateKey) {
    throw new PaymentAdapterError(
      "Nagad sensitive data encrypt করতে merchant RSA key দরকার।",
      "NAGAD",
    );
  }
  const serialized = JSON.stringify(payload);
  return publicEncrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(serialized),
  )
    .toString("base64")
    .replace(/\n/g, "");
}
