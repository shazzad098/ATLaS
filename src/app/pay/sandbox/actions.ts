"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { toDecimalString } from "@/lib/money";
import {
  SANDBOX_SIGNATURE_HEADER,
  sandboxTxnId,
  signSandboxPayload,
} from "@/lib/payments/sandbox";

/**
 * Sandbox gateway simulator (PRD §17).
 *
 * The shopper lands here instead of a real gateway. Choosing an outcome posts a
 * *real* signed callback to the *real* webhook endpoint over HTTP, so the
 * signature check, `(provider, eventKey)` idempotency, amount check, order
 * transition, inventory and platform-fee side effects are all exercised exactly
 * as they will be in production.
 *
 * Nothing is trusted from the URL: the order number identifies the order, and
 * provider, amount, callback URL and return URL are all derived server-side.
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
  const outcome = String(formData.get("outcome") ?? "") === "FAILED" ? "FAILED" : "SUCCEEDED";

  const order = await prisma.order.findFirst({
    where: { orderNo },
    select: {
      id: true,
      orderNo: true,
      grandTotal: true,
      paymentProvider: true,
      store: { select: { slug: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { providerTxnId: true },
      },
    },
  });

  if (!order) redirect("/pay/sandbox?error=not_found");

  const provider = order.paymentProvider;
  const baseUrl = await sameHostBaseUrl();
  const returnUrl = `/store/${order.store.slug}/order/${order.orderNo}`;

  const rawBody = JSON.stringify({
    eventKey: `sandbox:${provider.toLowerCase()}:${order.orderNo}:${outcome}`,
    providerTxnId: order.payments[0]?.providerTxnId ?? sandboxTxnId("SBX", order.orderNo),
    orderNo: order.orderNo,
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

  redirect(delivered ? returnUrl : `${returnUrl}?sandbox=unreachable`);
}
