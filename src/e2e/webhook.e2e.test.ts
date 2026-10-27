import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { handlePaymentWebhook } from "@/lib/services/payment-service.ts";
import { signSandboxPayload } from "@/lib/payments/sandbox.ts";

process.env.AUTH_SECRET = "webhook-test-secret-0123456789abcdef";

async function dbUp(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const skip = (await dbUp()) ? false : "database unavailable";

test("a payment webhook event is processed at most once", { skip }, async () => {
  const provider = "SSLCOMMERZ";
  const providerTxnId = `dup-${Date.now()}`;
  const eventKey = `sslcommerz:${providerTxnId}`;
  const rawBody = JSON.stringify({
    providerTxnId,
    orderNo: null,
    amount: "100.00",
    status: "SUCCEEDED",
  });

  const request = new Request("https://app.example/api/v1/webhooks/payments/sslcommerz", {
    method: "POST",
    headers: { "x-atlas-sandbox-signature": signSandboxPayload(rawBody) },
  });

  // Simulate a gateway that already delivered this event once.
  await prisma.paymentWebhookEvent.create({
    data: {
      provider,
      eventKey,
      signatureValid: true,
      payloadHash: "pre-existing",
      payloadJson: {},
      status: "PROCESSED",
      processedAt: new Date(),
    },
  });

  const outcome = await handlePaymentWebhook(provider, request, rawBody);

  assert.equal(outcome.duplicate, true);
  assert.equal(outcome.received, true);

  // Cleanup so repeated runs keep a clean slate.
  await prisma.paymentWebhookEvent.deleteMany({ where: { provider, eventKey } });
});
