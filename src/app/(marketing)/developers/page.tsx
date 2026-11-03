import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, Table, Td, Th } from "@/components/ui/shell";
import { endpointSummaries } from "@/lib/openapi";
import { PLAN_CODES, PLAN_DEFINITIONS, formatLimit } from "@/lib/plans";

/** Developer reference (PRD §11). Rendered from the same document as the spec. */

export const metadata = {
  title: "ডেভেলপার",
  description: "ATLaS REST API v1 — OTP login, stores, catalog, orders, themes, billing এবং webhook।",
};

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-50 text-sky-700 border-sky-200",
  POST: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PATCH: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};

const ENVELOPE_SAMPLE = `{
  "data": { "id": "st_8f21…", "name": "নকশি বুটিক" },
  "error": null,
  "meta": { "requestId": "req_1c0a…", "nextCursor": null, "hasMore": false }
}`;

const LOGIN_SAMPLE = `# 1) কোড চান
curl -X POST https://your-store.atlas.app/api/v1/auth/request-otp \\
  -H 'content-type: application/json' \\
  -d '{"phone":"01712345678"}'

# 2) কোড দিন, টোকেন নিন
curl -X POST https://your-store.atlas.app/api/v1/auth/verify-otp \\
  -H 'content-type: application/json' \\
  -d '{"phone":"01712345678","code":"123456"}'

# 3) Bearer টোকেন দিয়ে কল করুন
curl https://your-store.atlas.app/api/v1/me \\
  -H "authorization: Bearer $ACCESS_TOKEN"`;

const ERROR_SAMPLE = `{
  "data": null,
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "Free plan-এ ২৫টি product-এর সীমা শেষ।",
    "detail": { "feature": "catalog.products", "limit": 25, "upgradeTo": "basic" }
  },
  "meta": { "requestId": "req_9ad2…" }
}`;

const WEBHOOK_SAMPLE = `import { createHmac, timingSafeEqual } from "node:crypto";

// raw body অবিকল রাখুন — JSON.parse করার আগেই যাচাই করুন
const expected = createHmac("sha256", process.env.ATLAS_WEBHOOK_SECRET!)
  .update(rawBody)
  .digest("hex");

const received = req.headers["x-atlas-signature"];
const ok =
  typeof received === "string" &&
  received.length === expected.length &&
  timingSafeEqual(Buffer.from(received), Buffer.from(expected));

if (!ok) return res.status(401).end();`;

export default function DevelopersPage() {
  const endpoints = endpointSummaries();
  const tags = Array.from(new Set(endpoints.flatMap((endpoint) => endpoint.tags)));

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
      <div className="max-w-3xl space-y-4">
        <Badge tone="brand">ডেভেলপার</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
          ATLaS REST API v1
        </h1>
        <p className="text-ink-600">
          একই সার্ভিস লেয়ার যা ড্যাশবোর্ড চালায়, সেটিই REST-এ খোলা — তাই quota, permission আর
          tenant boundary সব জায়গায় একই নিয়মে enforce হয়। স্পেকটি OpenAPI 3.1, নিচের তালিকা সেখান থেকেই
          তৈরি।
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/api/v1/openapi.json" variant="outline">
            openapi.json দেখুন
          </ButtonLink>
          <ButtonLink href="/help#api" variant="ghost">
            API FAQ
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost">
            ইন্টিগ্রেশন সহায়তা
          </ButtonLink>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink-900">Base URL</p>
            <p className="rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-white">
              /api/v1
            </p>
            <p className="text-xs text-ink-500">
              ড্যাশবোর্ডের একই origin। প্রতিটি response-এ `meta.requestId` থাকে — সাপোর্টে সেই আইডি দিলে
              লগ খুঁজে পাওয়া সহজ।
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink-900">Auth</p>
            <p className="text-sm text-ink-600">
              `Authorization: Bearer &lt;accessToken&gt;` অথবা সেশন কুকি। <code className="text-xs">X-Tenant-Id</code>{" "}
              দিয়ে workspace বেছে নিন; না দিলে প্রথম membership ব্যবহৃত হয়।
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink-900">Pagination</p>
            <p className="text-sm text-ink-600">
              Cursor-ভিত্তিক: `?limit=20&amp;cursor=…`। response-এ `meta.nextCursor` ও `meta.hasMore`
              থাকে; total count নেই, তাই বড় তালিকাও দ্রুত।
            </p>
          </CardBody>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-ink-900">OTP login</h2>
        <p className="max-w-3xl text-sm text-ink-600">
          বাংলাদেশি মোবাইল নম্বরই প্রাথমিক পরিচয়। কোড ৬ ডিজিট, ৫ মিনিটে মেয়াদ শেষ, ৫ বার ভুল হলে লক।
          SMS প্রোভাইডার কনফিগার না থাকলে sandbox response-এ `devCode` ফেরত আসে।
        </p>
        <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
          {LOGIN_SAMPLE}
        </pre>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">Response envelope</h2>
          <p className="text-sm text-ink-600">
            সফল হলেও, ব্যর্থ হলেও একই খাম — ক্লায়েন্টে আলাদা parsing path লাগে না।
          </p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
            {ENVELOPE_SAMPLE}
          </pre>
        </div>
        <div className="min-w-0 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">Error envelope</h2>
          <p className="text-sm text-ink-600">
            কোড stable, মেসেজ মানুষ-পাঠ্য। `PLAN_LIMIT_REACHED` বা `FEATURE_NOT_AVAILABLE` এলে
            `detail.upgradeTo` বলে দেয় কোন প্ল্যান দরকার।
          </p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
            {ERROR_SAMPLE}
          </pre>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">Endpoints</h2>
            <p className="text-sm text-ink-600">
              {endpoints.length}টি operation, {tags.length}টি গ্রুপে। 🔒 মানে authenticated।
            </p>
          </div>
          <Link href="/api/v1/openapi.json" className="text-sm font-medium text-brand-700 hover:underline">
            সম্পূর্ণ স্পেক →
          </Link>
        </div>

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Method</Th>
                <Th>Path</Th>
                <Th>কী করে</Th>
                <Th>Auth</Th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((endpoint) => (
                <tr key={`${endpoint.method} ${endpoint.path}`}>
                  <Td>
                    <span
                      className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                        METHOD_TONE[endpoint.method] ?? "border-ink-200 bg-ink-100 text-ink-700"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-ink-800">{endpoint.path}</Td>
                  <Td className="text-xs text-ink-600">
                    {endpoint.summary}
                    {endpoint.description ? (
                      <span className="mt-0.5 block text-[11px] text-ink-400">{endpoint.description}</span>
                    ) : null}
                  </Td>
                  <Td className="text-xs">{endpoint.auth ? "🔒" : "public"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">Rate limit</h2>
          <p className="text-sm text-ink-600">
            প্ল্যান অনুযায়ী প্রতি মিনিটে রিকোয়েস্ট সংখ্যা নির্ধারিত। সীমা ছাড়ালে `429 RATE_LIMITED`
            এবং `detail.retryAfterSeconds` আসে।
          </p>
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>প্ল্যান</Th>
                  <Th>API access</Th>
                  <Th className="text-right">req / min</Th>
                </tr>
              </thead>
              <tbody>
                {PLAN_CODES.map((code) => (
                  <tr key={code}>
                    <Td className="font-medium text-ink-800">{PLAN_DEFINITIONS[code].name}</Td>
                    <Td className="text-xs text-ink-600">{PLAN_DEFINITIONS[code].$limits.apiAccess}</Td>
                    <Td className="text-right">
                      {formatLimit(PLAN_DEFINITIONS[code].$limits.requestsPerMinute)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">Webhook signature</h2>
          <p className="text-sm text-ink-600">
            প্রতিটি ডেলিভারিতে `x-atlas-signature` (HMAC-SHA256) থাকে। raw body দিয়ে যাচাই করুন,
            তারপর JSON পার্স করুন। একই `eventKey` দুইবার এলে দ্বিতীয়টি ignore করুন — অর্ডার দুইবার paid হবে
            না।
          </p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
            {WEBHOOK_SAMPLE}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-6">
        <h2 className="text-lg font-semibold text-ink-900">নিয়মগুলো এক নজরে</h2>
        <ul className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
          <li>• টাকা সবসময় BDT decimal string — float নয়।</li>
          <li>• checkout ও payment call-এ `Idempotency-Key` বাধ্যতামূলক।</li>
          <li>• mutating call-এ কুকি auth হলে `x-atlas-csrf` header লাগবে।</li>
          <li>• tenant/store আইডি কখনো body-তে পাঠিয়ে বিশ্বাস করা হয় না।</li>
          <li>• 4xx মানে অনুরোধে সমস্যা, 5xx মানে সার্ভারে — `requestId` রাখুন।</li>
          <li>• date/time ISO-8601 (UTC), প্ল্যাটফর্ম UI দেখায় Asia/Dhaka।</li>
        </ul>
      </section>
    </div>
  );
}
