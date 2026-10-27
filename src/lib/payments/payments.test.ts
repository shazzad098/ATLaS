import test from "node:test";
import assert from "node:assert/strict";
import { sslcommerzAdapter } from "./sslcommerz.ts";
import { signSandboxPayload, verifySandboxSignature } from "./sandbox.ts";
import { buildTxnId, safeJson, type InitiateContext } from "./types.ts";

process.env.AUTH_SECRET = "payment-test-secret-0123456789abcdef";

const ctx = (overrides: Partial<InitiateContext> = {}): InitiateContext => ({
  orderId: "order_1",
  orderNo: "ORD-12345",
  amount: "1000.00",
  currency: "BDT",
  customerName: "Tester",
  customerPhone: "+8801700000000",
  callbackUrl: "https://app.example/pay/callback",
  successUrl: "https://app.example/order/ok",
  failureUrl: "https://app.example/order/fail",
  credentials: { storeId: "live-store", storePassword: "live-pass" },
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Replace global fetch for one test and restore it afterwards. */
async function withFetch<T>(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl as unknown as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test("buildTxnId is prefixed and embeds the order number", () => {
  const txn = buildTxnId("SSL", "ORD-12345");
  assert.match(txn, /^SSLORD12345[A-Z0-9]+$/);
  assert.ok(txn.startsWith("SSLORD12345"));
  assert.notEqual(buildTxnId("SSL", "ORD-1"), buildTxnId("SSL", "ORD-2"));
});

test("safeJson tolerates malformed or empty bodies", () => {
  assert.deepEqual(safeJson(""), {});
  assert.deepEqual(safeJson("not-json"), {});
  assert.deepEqual(safeJson('{"amount":"100"}'), { amount: "100" });
});

test("SSLCommerz initiate returns a live redirect URL on success", async () => {
  await withFetch(
    async () => json({ status: "SUCCESS", GatewayPageURL: "https://gw.example/pay", sessionkey: "sess_1" }),
    async () => {
      const result = await sslcommerzAdapter.initiate(ctx());
      assert.equal(result.status, "PENDING");
      assert.equal(result.sandbox, false);
      assert.equal(result.redirectUrl, "https://gw.example/pay");
    },
  );
});

test("SSLCommerz initiate throws on a gateway failure", async () => {
  await withFetch(
    async () => json({ status: "FAILED", failedreason: "store is blocked" }),
    async () => {
      await assert.rejects(() => sslcommerzAdapter.initiate(ctx()), /store is blocked/);
    },
  );
});

test("SSLCommerz initiate falls back to sandbox when unconfigured", async () => {
  const result = await sslcommerzAdapter.initiate(ctx({ credentials: {} }));
  assert.equal(result.sandbox, true);
  assert.ok(result.redirectUrl?.includes("/pay/sandbox"));
});

test("SSLCommerz parseCallback validates the transaction before trusting it", async () => {
  const request = new Request("https://app.example/pay/callback", { method: "POST" });

  await withFetch(
    async (url) => {
      if (String(url).includes("validationserverAPI")) return json({ status: "VALID", amount: "1000.00" });
      throw new Error(`unexpected url ${String(url)}`);
    },
    async () => {
      const cb = await sslcommerzAdapter.parseCallback(
        request,
        JSON.stringify({ tran_id: "ORD-1", val_id: "val_1" }),
        { storeId: "s", storePassword: "p" },
      );
      assert.equal(cb.status, "SUCCEEDED");
      assert.equal(cb.signatureValid, true);
      assert.equal(cb.amount, "1000.00");
      assert.equal(cb.eventKey, "sslcommerz:val_1");
    },
  );
});

test("SSLCommerz parseCallback rejects an invalidated transaction", async () => {
  const request = new Request("https://app.example/pay/callback", { method: "POST" });

  await withFetch(
    async (url) => (String(url).includes("validationserverAPI") ? json({ status: "FAILED", error: "no txn" }) : json({})),
    async () => {
      const cb = await sslcommerzAdapter.parseCallback(
        request,
        JSON.stringify({ tran_id: "ORD-1", val_id: "val_bad" }),
        { storeId: "s", storePassword: "p" },
      );
      assert.equal(cb.status, "FAILED");
      assert.equal(cb.signatureValid, false);
    },
  );
});

test("SSLCommerz refund reports the gateway reference", async () => {
  await withFetch(
    async () => json({ refund_ref_id: "ref_9" }),
    async () => {
      const result = await sslcommerzAdapter.refund({
        providerTxnId: "val_1",
        amount: "1000.00",
        credentials: { storeId: "s", storePassword: "p" },
      });
      assert.equal(result.ok, true);
      assert.equal(result.refundRef, "ref_9");
    },
  );
});

test("sandbox signatures verify and reject tampering", () => {
  const body = JSON.stringify({ status: "SUCCEEDED", orderNo: "ORD-1" });
  const signature = signSandboxPayload(body);
  assert.equal(verifySandboxSignature(body, signature), true);
  assert.equal(verifySandboxSignature(body + "x", signature), false);
  assert.equal(verifySandboxSignature(body, null), false);
});
