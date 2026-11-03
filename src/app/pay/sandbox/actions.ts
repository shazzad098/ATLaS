"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { toDecimalString } from "@/lib/money";
import { getPaymentAdapter } from "@/lib/payments";
import {
  SANDBOX_SIGNATURE_HEADER,
  sandboxTxnId,
  signSandboxPayload,
  verifySandboxOrderToken,
} from "@/lib/payments/sandbox";
import { signOrderAccessToken } from "@/lib/order-access";

/**
 * Sandbox gateway simulator (PRD §17).
 *
 * The shopper lands here instead of a real gateway. Choosing an outcome posts a
 * *real* signed callback to the *real* webhook endpoint over HTTP, so the
 * signature check, `(provider, eventKey)` idempotency, amount check, order
 * transition, inventory and platform-fee side effects are all exercised exactly
 * as they will be in production.
 *
 * The form carries a short-lived HMAC token issued by `initiate()`. A bare
 * order number is never enough: without a valid token (or when the provider now
 * has live credentials) this action refuses to emit a callback, so it cannot be
 * used to mark a real order paid.
 */

function sameHostBaseUrl(): Promise<string> {
  return headers().then((headerList) => {
    const host =
      headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
    const protocol =
      headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${protocol}://${host}`;
  });
}

export async function simulateSandboxPaymentAction(formData: FormData): Promise<void> {
  const orderNo = String(formData.get("orderNo") ?? "").trim();
  const token = String(formData.get("t") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "") === "FAILED" ? "FAILED" : "SUCCEEDED";

  const claims = verifySandboxOrderToken(token);
  if (!claims || claims.orderNo !== orderNo) redirect("/pay/sandbox?error=invalid");

  const order = await prisma.order.findFirst({
    where: { id: claims.orderId, orderNo: claims.orderNo, deletedAt: null },
    select: {
      id: true,
      orderNo: true,
      status: true,
      grandTotal: true,
      paymentProvider: true,
      storeId: true,
      store: { select: { slug: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { providerTxnId: true, status: true },
      },
    },
  });

  if (!order || order.paymentProvider !== claims.provider) {
    redirect("/pay/sandbox?error=invalid");
  }

  // Never simulate against a live-configured gateway or an order that already
  // left the payment step.
  if (
    getPaymentAdapter(order.paymentProvider).isConfigured() ||
    order.status !== "PENDING_PAYMENT"
  ) {
    redirect("/pay/sandbox?error=not_pending");
  }

  const latestPayment = order.payments[0];
  if (
    !latestPayment ||
    (latestPayment.status !== "INITIATED" && latestPayment.status !== "PENDING")
  ) {
    redirect("/pay/sandbox?error=not_pending");
  }

  const provider = order.paymentProvider;
  const baseUrl = await sameHostBaseUrl();
  const returnToken = signOrderAccessToken({
    storeId: order.storeId,
    orderId: order.id,
    orderNo: order.orderNo,
  });
  const returnUrl = `/store/${order.store.slug}/order/${order.orderNo}?t=${encodeURIComponent(
    returnToken,
  )}`;

  const rawBody = JSON.stringify({
    eventKey: `sandbox:${provider.toLowerCase()}:${order.orderNo}:${outcome}`,
    providerTxnId: latestPayment.providerTxnId ?? sandboxTxnId("SBX", order.orderNo),
    orderNo: order.orderNo,
    orderId: order.id,
    amount: toDecimalString(order.grandTotal),
    status: outcome,
    failureReason:
      outcome === "FAILED" ? "Sandbox: shopper cancelled the payment." : undefined,
    sandbox: true,
  });

  let delivered = false;
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/webhooks/payments/${provider.toLowerCase()}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [SANDBOX_SIGNATURE_HEADER]: signSandboxPayload(rawBody),
        },
        body: rawBody,
        cache: "no-store",
        redirect: "manual",
      },
    );
    delivered = response.ok;
  } catch {
    delivered = false;
  }

  redirect(delivered ? returnUrl : `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}sandbox=unreachable`);
}
