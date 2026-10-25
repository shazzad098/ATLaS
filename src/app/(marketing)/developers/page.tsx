import Link from "next/link";
import { ArrowRight, Code, Key, ShieldCheck, Webhook, Zap } from "lucide-react";

/** Developer API documentation page (PRD §4.1, §11). */

export const metadata = {
  title: "Developers — ATLaS REST API",
  description: "ATLaS REST API v1 documentation। Authentication, endpoints, webhooks, rate limits ও OpenAPI spec।",
};

const ENDPOINTS = [
  {
    category: "Auth",
    color: "bg-[#E8F1FF] text-[#2563EB]",
    routes: [
      { method: "POST", path: "/api/v1/auth/request-otp", desc: "OTP request করুন" },
      { method: "POST", path: "/api/v1/auth/verify-otp", desc: "OTP verify ও session তৈরি" },
      { method: "POST", path: "/api/v1/auth/refresh", desc: "Refresh token দিয়ে নতুন access token" },
      { method: "POST", path: "/api/v1/auth/logout", desc: "Session revoke করুন" },
      { method: "GET", path: "/api/v1/me", desc: "Authenticated user profile" },
    ],
  },
  {
    category: "Stores ও Themes",
    color: "bg-[#F1EBFF] text-[#7C3AED]",
    routes: [
      { method: "POST", path: "/api/v1/stores", desc: "নতুন store তৈরি" },
      { method: "GET", path: "/api/v1/stores", desc: "Merchant-এর সব store" },
      { method: "GET", path: "/api/v1/stores/{storeId}", desc: "Store details" },
      { method: "PATCH", path: "/api/v1/stores/{storeId}", desc: "Store settings update" },
      { method: "GET", path: "/api/v1/stores/{storeId}/themes", desc: "Available themes" },
      { method: "POST", path: "/api/v1/stores/{storeId}/themes/select", desc: "Theme select করুন" },
      { method: "PATCH", path: "/api/v1/stores/{storeId}/theme-config", desc: "Theme config update" },
      { method: "POST", path: "/api/v1/stores/{storeId}/publish", desc: "Store publish করুন" },
      { method: "POST", path: "/api/v1/stores/{storeId}/domains/verify", desc: "Custom domain verify" },
    ],
  },
  {
    category: "Catalog",
    color: "bg-[#E7F7F0] text-[#0B8F68]",
    routes: [
      { method: "GET", path: "/api/v1/stores/{storeId}/products", desc: "Products list" },
      { method: "POST", path: "/api/v1/stores/{storeId}/products", desc: "Product তৈরি" },
      { method: "PATCH", path: "/api/v1/products/{productId}", desc: "Product update" },
      { method: "POST", path: "/api/v1/products/import", desc: "CSV bulk import" },
      { method: "GET", path: "/api/v1/products/export", desc: "CSV export (async job)" },
      { method: "POST", path: "/api/v1/variants/{variantId}/inventory-adjustments", desc: "Stock adjustment" },
    ],
  },
  {
    category: "Commerce",
    color: "bg-[#FFF3E2] text-[#D97706]",
    routes: [
      { method: "POST", path: "/api/v1/storefront/{storeSlug}/cart/items", desc: "Cart-এ item যোগ" },
      { method: "POST", path: "/api/v1/storefront/{storeSlug}/checkout", desc: "Checkout (Idempotency-Key required)" },
      { method: "GET", path: "/api/v1/stores/{storeId}/orders", desc: "Orders list" },
      { method: "PATCH", path: "/api/v1/orders/{orderId}/status", desc: "Order status update" },
      { method: "POST", path: "/api/v1/orders/{orderId}/refund-request", desc: "Refund request" },
      { method: "GET", path: "/api/v1/stores/{storeId}/customers", desc: "Customers list" },
      { method: "POST", path: "/api/v1/stores/{storeId}/coupons", desc: "Coupon তৈরি" },
    ],
  },
  {
    category: "Billing",
    color: "bg-[#FFF1F2] text-[#E11D48]",
    routes: [
      { method: "GET", path: "/api/v1/billing/plans", desc: "সব plan details" },
      { method: "POST", path: "/api/v1/billing/subscriptions", desc: "Subscription তৈরি" },
      { method: "POST", path: "/api/v1/billing/subscriptions/{id}/change-plan", desc: "Plan upgrade/downgrade" },
      { method: "POST", path: "/api/v1/billing/subscriptions/{id}/cancel", desc: "Subscription cancel" },
      { method: "GET", path: "/api/v1/billing/usage", desc: "Current usage counters" },
      { method: "GET", path: "/api/v1/billing/invoices", desc: "Invoice list" },
    ],
  },
  {
    category: "Webhooks ও Integrations",
    color: "bg-[#F0FDF4] text-[#16A34A]",
    routes: [
      { method: "POST", path: "/api/v1/webhooks/payments/{provider}", desc: "Payment gateway webhook (HMAC verified)" },
      { method: "POST", path: "/api/v1/webhooks/couriers/{provider}", desc: "Courier webhook (signed)" },
      { method: "POST", path: "/api/v1/stores/{storeId}/integrations/{provider}/connect", desc: "Gateway/courier connect" },
      { method: "GET", path: "/api/v1/stores/{storeId}/api-keys", desc: "API key list" },
      { method: "POST", path: "/api/v1/stores/{storeId}/api-keys", desc: "নতুন API key তৈরি" },
    ],
  },
];

const PLAN_ACCESS = [
  { plan: "Free", access: "Read-only public API", scopes: "store:read, catalog:read", rateLimit: "৬০ req/min" },
  { plan: "Basic", access: "Read API + Webhooks", scopes: "+ inventory:read, orders:read, customers:read", rateLimit: "৬০ req/min" },
  { plan: "Standard", access: "Full scoped API", scopes: "সব scope + catalog:write, inventory:write, orders:write", rateLimit: "১২০ req/min" },
  { plan: "Pro", access: "Full API + higher rate limit", scopes: "সব scope", rateLimit: "৩০০ req/min" },
];

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-[#e8f1ff] text-[#1d4ed8]",
  POST: "bg-[#e7f7f0] text-[#166534]",
  PATCH: "bg-[#fff3e2] text-[#92400e]",
  DELETE: "bg-[#fff1f2] text-[#9f1239]",
};

export default function DevelopersPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-[#e8eeeb] bg-gradient-to-b from-[#f0faf6] to-white py-14 sm:py-16">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="lg:flex-1">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#c3e9d8] bg-[#e7f7f0] px-3 py-1 text-[12px] font-semibold text-[#0b7a5b]">
                REST API v1
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
                ATLaS Developer API
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-ink-600">
                ATLaS-এর সম্পূর্ণ REST API — product, order, payment, webhook সব কিছু programmatically
                control করুন। OpenAPI spec পাওয়া যাচ্ছে।
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/api/openapi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(11,166,120,0.95)] transition hover:bg-[#099569]"
                >
                  <Code className="h-4 w-4" />
                  OpenAPI Spec (JSON)
                </a>
                <Link
                  href="/admin/settings"
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 transition hover:bg-[#f4f8f6]"
                >
                  <Key className="h-4 w-4" />
                  API Key তৈরি করুন
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-[#e8eeeb] bg-[#0a0a0a] p-5 font-mono text-[12.5px] leading-6 text-[#d4d4d8] shadow-lg lg:w-[460px]">
              <p className="text-[#6b7280]"># ATLaS API Example</p>
              <p className="mt-2">
                <span className="text-[#7dd3fc]">curl</span>{" "}
                <span className="text-[#fca5a5]">-X GET</span> \
              </p>
              <p className="pl-4">
                <span className="text-[#fca5a5]">-H</span>{" "}
                <span className="text-[#86efac]">&quot;Authorization: Bearer atl_xxx.secret&quot;</span> \
              </p>
              <p className="pl-4">
                <span className="text-[#fca5a5]">-H</span>{" "}
                <span className="text-[#86efac]">&quot;X-Store-Id: your-store-id&quot;</span> \
              </p>
              <p className="pl-4 text-[#c4b5fd]">https://atlas.example/api/v1/stores/&lt;id&gt;/orders</p>
              <p className="mt-3 text-[#6b7280]"># Response</p>
              <p>
                <span className="text-[#7dd3fc]">{"{"}</span>
              </p>
              <p className="pl-4">
                <span className="text-[#86efac]">&quot;data&quot;</span>:{" "}
                <span className="text-[#fca5a5]">[...]</span>,
              </p>
              <p className="pl-4">
                <span className="text-[#86efac]">&quot;cursor&quot;</span>:{" "}
                <span className="text-[#c4b5fd]">&quot;next_cursor&quot;</span>
              </p>
              <p>
                <span className="text-[#7dd3fc]">{"}"}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Auth */}
      <section className="border-b border-[#e8eeeb] py-12">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <h2 className="mb-6 text-xl font-bold text-ink-900">Authentication</h2>
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-xl border border-[#e8eeeb] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <Key className="h-5 w-5 text-[#0B8F68]" />
                <h3 className="text-[14px] font-semibold text-ink-900">API Key</h3>
              </div>
              <p className="text-[13px] leading-6 text-ink-600">
                Admin panel → Settings → API Keys থেকে key তৈরি করুন। Header-এ পাঠান:
              </p>
              <code className="mt-3 block rounded-lg bg-[#f7faf9] px-3 py-2 text-[12px] text-ink-700">
                Authorization: Bearer atl_xxx.secret
              </code>
            </div>

            <div className="rounded-xl border border-[#e8eeeb] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-[14px] font-semibold text-ink-900">Rate Limits</h3>
              </div>
              <p className="text-[13px] leading-6 text-ink-600">
                Plan অনুযায়ী rate limit। Exceeded হলে{" "}
                <code className="rounded bg-[#f7faf9] px-1 text-[11px]">429</code> response।
              </p>
              <p className="mt-2 text-[12px] text-ink-500">
                Header:{" "}
                <code className="rounded bg-[#f7faf9] px-1 text-[11px]">X-RateLimit-Remaining</code>
              </p>
            </div>

            <div className="rounded-xl border border-[#e8eeeb] bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#D97706]" />
                <h3 className="text-[14px] font-semibold text-ink-900">Idempotency</h3>
              </div>
              <p className="text-[13px] leading-6 text-ink-600">
                Checkout ও payment-এ idempotency key দিন duplicate order ঠেকাতে:
              </p>
              <code className="mt-3 block rounded-lg bg-[#f7faf9] px-3 py-2 text-[12px] text-ink-700">
                Idempotency-Key: uuid-v4
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Plan-based access */}
      <section className="border-b border-[#e8eeeb] py-12">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <h2 className="mb-6 text-xl font-bold text-ink-900">Plan অনুযায়ী API Access</h2>
          <div className="overflow-x-auto rounded-xl border border-[#e8eeeb]">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f7faf9]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-ink-700">Plan</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-700">Access Level</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-700">Scopes</th>
                  <th className="px-4 py-3 text-left font-semibold text-ink-700">Rate Limit</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_ACCESS.map((row, i) => (
                  <tr key={row.plan} className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                    <td className="px-4 py-3 font-semibold text-ink-800">{row.plan}</td>
                    <td className="px-4 py-3 text-ink-600">{row.access}</td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-ink-500">{row.scopes}</td>
                    <td className="px-4 py-3 text-ink-600">{row.rateLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="py-12">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <h2 className="mb-6 text-xl font-bold text-ink-900">API Endpoints</h2>
          <div className="space-y-8">
            {ENDPOINTS.map((group) => (
              <div key={group.category}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${group.color}`}>
                    {group.category}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-[#e8eeeb]">
                  <table className="w-full text-[13px]">
                    <tbody>
                      {group.routes.map((route, i) => (
                        <tr key={route.path} className={i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}>
                          <td className="w-16 px-4 py-2.5">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${METHOD_COLOR[route.method] ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {route.method}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="font-mono text-[12px] text-ink-700">{route.path}</code>
                          </td>
                          <td className="hidden px-4 py-2.5 text-ink-500 sm:table-cell">{route.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section className="border-t border-[#e8eeeb] bg-[#f7faf9] py-12">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Webhook className="h-5 w-5 text-[#0B7A5B]" />
                <h2 className="text-xl font-bold text-ink-900">Outbound Webhooks</h2>
              </div>
              <p className="text-[14px] leading-7 text-ink-600">
                ATLaS-এ event হলে আপনার configured endpoint-এ signed webhook পাঠায়। Basic plan থেকে
                webhook সাপোর্ট।
              </p>
              <h3 className="mt-4 text-[13.5px] font-semibold text-ink-800">Webhook Events</h3>
              <ul className="mt-2 space-y-1.5">
                {[
                  "order.created",
                  "order.status_updated",
                  "payment.succeeded",
                  "payment.failed",
                  "store.published",
                  "subscription.renewed",
                  "subscription.failed",
                ].map((event) => (
                  <li key={event}>
                    <code className="rounded bg-white px-2 py-0.5 text-[12px] text-ink-700 border border-[#e8eeeb]">
                      {event}
                    </code>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-[14px] font-semibold text-ink-800">Webhook Security</h3>
              <div className="space-y-3">
                <div className="rounded-lg border border-[#e8eeeb] bg-white p-4">
                  <p className="text-[13px] font-semibold text-ink-700">Signature Verification</p>
                  <p className="mt-1 text-[12.5px] text-ink-500">
                    প্রতিটি webhook-এ HMAC-SHA256 signature Header-এ থাকে:
                  </p>
                  <code className="mt-2 block rounded-lg bg-[#f7faf9] px-3 py-2 text-[11.5px] text-ink-700">
                    X-ATLaS-Signature: sha256=xxx
                  </code>
                </div>
                <div className="rounded-lg border border-[#e8eeeb] bg-white p-4">
                  <p className="text-[13px] font-semibold text-ink-700">Idempotency</p>
                  <p className="mt-1 text-[12.5px] text-ink-500">
                    Duplicate webhook safe। Same event একাধিকবার process করলেও order double হয় না।
                  </p>
                </div>
                <div className="rounded-lg border border-[#e8eeeb] bg-white p-4">
                  <p className="text-[13px] font-semibold text-ink-700">Retry Policy</p>
                  <p className="mt-1 text-[12.5px] text-ink-500">
                    Failure-এ exponential backoff দিয়ে retry। Dead-letter queue-এ failed events।
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error format */}
      <section className="border-t border-[#e8eeeb] py-12">
        <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
          <h2 className="mb-4 text-xl font-bold text-ink-900">Error Response Format</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-[#e8eeeb] bg-[#0a0a0a] p-5 font-mono text-[12.5px] text-[#d4d4d8]">
              <p className="text-[#6b7280]">{"// Error response"}</p>
              <p className="mt-2">{`{`}</p>
              <p className="pl-4">
                <span className="text-[#86efac]">&quot;error&quot;</span>:{" "}
                <span className="text-[#fca5a5]">&quot;VALIDATION&quot;</span>,
              </p>
              <p className="pl-4">
                <span className="text-[#86efac]">&quot;message&quot;</span>:{" "}
                <span className="text-[#c4b5fd]">&quot;Subject is too short&quot;</span>,
              </p>
              <p className="pl-4">
                <span className="text-[#86efac]">&quot;requestId&quot;</span>:{" "}
                <span className="text-[#c4b5fd]">&quot;req_xxx&quot;</span>,
              </p>
              <p className="pl-4">
                <span className="text-[#86efac]">&quot;status&quot;</span>:{" "}
                <span className="text-[#7dd3fc]">400</span>
              </p>
              <p>{`}`}</p>
            </div>

            <div className="space-y-2">
              {[
                { code: "200/201", desc: "Success" },
                { code: "400", desc: "VALIDATION — Input error" },
                { code: "401", desc: "UNAUTHENTICATED — Invalid/expired token" },
                { code: "403", desc: "FORBIDDEN — Permission denied" },
                { code: "404", desc: "NOT_FOUND — Resource not found" },
                { code: "409", desc: "CONFLICT — Duplicate resource" },
                { code: "422", desc: "FEATURE_NOT_IN_PLAN — Plan upgrade needed" },
                { code: "429", desc: "RATE_LIMIT_EXCEEDED" },
                { code: "500", desc: "INTERNAL — Server error" },
              ].map((err) => (
                <div key={err.code} className="flex items-center gap-3 text-[13px]">
                  <code className="w-12 shrink-0 rounded-md bg-[#f7faf9] px-2 py-0.5 text-center text-[11.5px] font-bold text-ink-700 border border-[#e8eeeb]">
                    {err.code}
                  </code>
                  <span className="text-ink-600">{err.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#e8eeeb] bg-[#f7faf9] py-12">
        <div className="mx-auto max-w-[1160px] px-4 text-center sm:px-6">
          <h2 className="text-xl font-bold text-ink-900">এখনই শুরু করুন</h2>
          <p className="mt-2 text-[13.5px] text-ink-500">
            API access পেতে ATLaS account তৈরি করুন এবং Admin → Settings → API Keys থেকে key নিন।
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0BA678] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#099569]"
            >
              Free Account খুলুন <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="/api/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#dfe8e4] bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-800 transition hover:bg-[#f4f8f6]"
            >
              <Code className="h-4 w-4" />
              OpenAPI JSON
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
