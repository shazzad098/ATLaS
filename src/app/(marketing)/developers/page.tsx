import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, Table, Td, Th } from "@/components/ui/shell";
import { endpointSummaries } from "@/lib/openapi";
import { PLAN_CODES, PLAN_DEFINITIONS, formatLimit } from "@/lib/plans";
import { getLocale } from "@/lib/i18n/server";

/** Developer reference (PRD §11). Rendered from the same document as the spec. */

export const dynamic = "force-dynamic";

const METHOD_TONE: Record<string, string> = {
  GET: "bg-sky-50 text-sky-700 border-sky-200",
  POST: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PATCH: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};

type SampleSet = {
  envelope: string;
  login: string;
  error: string;
  webhook: string;
};

const SAMPLES: Record<"bn" | "en", SampleSet> = {
  bn: {
    envelope: `{
  "data": { "id": "st_8f21…", "name": "নকশি বুটিক" },
  "error": null,
  "meta": { "requestId": "req_1c0a…", "nextCursor": null, "hasMore": false }
}`,
    login: `# 1) কোড চান
curl -X POST https://your-store.atlas.app/api/v1/auth/request-otp \\
  -H 'content-type: application/json' \\
  -d '{"phone":"01712345678"}'

# 2) কোড দিন, টোকেন নিন
curl -X POST https://your-store.atlas.app/api/v1/auth/verify-otp \\
  -H 'content-type: application/json' \\
  -d '{"phone":"01712345678","code":"123456"}'

# 3) Bearer টোকেন দিয়ে কল করুন
curl https://your-store.atlas.app/api/v1/me \\
  -H "authorization: Bearer $ACCESS_TOKEN"`,
    error: `{
  "data": null,
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "Free plan-এ ২৫টি product-এর সীমা শেষ।",
    "detail": { "feature": "catalog.products", "limit": 25, "upgradeTo": "basic" }
  },
  "meta": { "requestId": "req_9ad2…" }
}`,
    webhook: `import { createHmac, timingSafeEqual } from "node:crypto";

// endpoint তৈরির সময় যে secret একবার দেখানো হয়, সেটাই এখানে বসান
const secret = process.env.ATLAS_ENDPOINT_SECRET!;
const timestamp = req.headers["x-atlas-timestamp"];
const rawBody = await readRawBody(req); // JSON.parse করার আগেই যাচাই করুন

const expected = \`sha256=\${createHmac("sha256", secret)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex")}\`;

const received = req.headers["x-atlas-signature"];
const ok =
  typeof received === "string" &&
  received.length === expected.length &&
  timingSafeEqual(Buffer.from(received), Buffer.from(expected));

// পুরনো delivery replay ঠেকাতে timestamp-ও যাচাই করুন (±৫ মিনিট)
if (!ok) return res.status(401).end();`,
  },
  en: {
    envelope: `{
  "data": { "id": "st_8f21…", "name": "Nokshi Boutique" },
  "error": null,
  "meta": { "requestId": "req_1c0a…", "nextCursor": null, "hasMore": false }
}`,
    login: `# 1) Ask for a code
curl -X POST https://your-store.atlas.app/api/v1/auth/request-otp \\
  -H 'content-type: application/json' \\
  -d '{"phone":"01712345678"}'

# 2) Exchange the code for a token
curl -X POST https://your-store.atlas.app/api/v1/auth/verify-otp \\
  -H 'content-type: application/json' \\
  -d '{"phone":"01712345678","code":"123456"}'

# 3) Call with the bearer token
curl https://your-store.atlas.app/api/v1/me \\
  -H "authorization: Bearer $ACCESS_TOKEN"`,
    error: `{
  "data": null,
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "The free plan's 25-product limit is reached.",
    "detail": { "feature": "catalog.products", "limit": 25, "upgradeTo": "basic" }
  },
  "meta": { "requestId": "req_9ad2…" }
}`,
    webhook: `import { createHmac, timingSafeEqual } from "node:crypto";

// Use the secret shown once when the endpoint was created
const secret = process.env.ATLAS_ENDPOINT_SECRET!;
const timestamp = req.headers["x-atlas-timestamp"];
const rawBody = await readRawBody(req); // verify before JSON.parse

const expected = \`sha256=\${createHmac("sha256", secret)
  .update(\`\${timestamp}.\${rawBody}\`)
  .digest("hex")}\`;

const received = req.headers["x-atlas-signature"];
const ok =
  typeof received === "string" &&
  received.length === expected.length &&
  timingSafeEqual(Buffer.from(received), Buffer.from(expected));

// Also check the timestamp to block replayed deliveries (±5 minutes)
if (!ok) return res.status(401).end();`,
  },
};

const COPY = {
  bn: {
    meta: {
      title: "ডেভেলপার",
      description: "ATLaS REST API v1 — OTP login, stores, catalog, orders, themes, billing এবং webhook।",
    },
    badge: "ডেভেলপার",
    title: "ATLaS REST API v1",
    intro:
      "একই সার্ভিস লেয়ার যা ড্যাশবোর্ড চালায়, সেটিই REST-এ খোলা — তাই quota, permission আর tenant boundary সব জায়গায় একই নিয়মে enforce হয়। স্পেকটি OpenAPI 3.1, নিচের তালিকা সেখান থেকেই তৈরি।",
    openapi: "openapi.json দেখুন",
    faq: "API FAQ",
    support: "ইন্টিগ্রেশন সহায়তা",
    baseUrl: {
      title: "Base URL",
      body: "ড্যাশবোর্ডের একই origin। প্রতিটি response-এ `meta.requestId` থাকে — সাপোর্টে সেই আইডি দিলে লগ খুঁজে পাওয়া সহজ।",
    },
    auth: {
      title: "Auth",
      body: "`Authorization: Bearer <accessToken>` অথবা সেশন কুকি। `X-Tenant-Id` দিয়ে workspace বেছে নিন; না দিলে প্রথম membership ব্যবহৃত হয়।",
    },
    pagination: {
      title: "Pagination",
      body: "Cursor-ভিত্তিক: `?limit=20&cursor=…`। response-এ `meta.nextCursor` ও `meta.hasMore` থাকে; total count নেই, তাই বড় তালিকাও দ্রুত।",
    },
    login: {
      title: "OTP login",
      body: "বাংলাদেশি মোবাইল নম্বরই প্রাথমিক পরিচয়। কোড ৬ ডিজিট, ৫ মিনিটে মেয়াদ শেষ, ৫ বার ভুল হলে লক। SMS প্রোভাইডার কনফিগার না থাকলে sandbox response-এ `devCode` ফেরত আসে।",
    },
    envelope: {
      title: "Response envelope",
      body: "সফল হলেও, ব্যর্থ হলেও একই খাম — ক্লায়েন্টে আলাদা parsing path লাগে না।",
    },
    error: {
      title: "Error envelope",
      body: "কোড stable, মেসেজ মানুষ-পাঠ্য। `PLAN_LIMIT_REACHED` বা `FEATURE_NOT_AVAILABLE` এলে `detail.upgradeTo` বলে দেয় কোন প্ল্যান দরকার।",
    },
    endpoints: {
      title: "Endpoints",
      summary: (operations: number, groups: number) =>
        `${operations}টি operation, ${groups}টি গ্রুপে। 🔒 মানে authenticated।`,
      spec: "সম্পূর্ণ স্পেক →",
      method: "Method",
      path: "Path",
      what: "কী করে",
      auth: "Auth",
    },
    rateLimit: {
      title: "Rate limit",
      body: "প্ল্যান অনুযায়ী প্রতি মিনিটে রিকোয়েস্ট সংখ্যা নির্ধারিত। সীমা ছাড়ালে `429 RATE_LIMITED` এবং `detail.retryAfterSeconds` আসে।",
      plan: "প্ল্যান",
    },
    webhook: {
      title: "Webhook signature",
      body: "প্রতিটি ডেলিভারিতে `x-atlas-signature` (HMAC-SHA256) থাকে। raw body দিয়ে যাচাই করুন, তারপর JSON পার্স করুন। একই `eventKey` দুইবার এলে দ্বিতীয়টি ignore করুন — অর্ডার দুইবার paid হবে না।",
    },
    rules: {
      title: "নিয়মগুলো এক নজরে",
      items: [
        "টাকা সবসময় BDT decimal string — float নয়।",
        "checkout ও payment call-এ `Idempotency-Key` বাধ্যতামূলক।",
        "mutating call-এ কুকি auth হলে `x-atlas-csrf` header লাগবে।",
        "tenant/store আইডি কখনো body-তে পাঠিয়ে বিশ্বাস করা হয় না।",
        "4xx মানে অনুরোধে সমস্যা, 5xx মানে সার্ভারে — `requestId` রাখুন।",
        "date/time ISO-8601 (UTC), প্ল্যাটফর্ম UI দেখায় Asia/Dhaka।",
      ],
    },
  },
  en: {
    meta: {
      title: "Developers",
      description: "ATLaS REST API v1 — OTP login, stores, catalogue, orders, themes, billing and webhooks.",
    },
    badge: "Developers",
    title: "ATLaS REST API v1",
    intro:
      "The same service layer that runs the dashboard is exposed over REST, so quotas, permissions and tenant boundaries are enforced identically everywhere. The spec is OpenAPI 3.1 and the list below is generated from it.",
    openapi: "View openapi.json",
    faq: "API FAQ",
    support: "Integration help",
    baseUrl: {
      title: "Base URL",
      body: "The same origin as the dashboard. Every response carries `meta.requestId` — quoting it in a support ticket makes the logs easy to find.",
    },
    auth: {
      title: "Auth",
      body: "`Authorization: Bearer <accessToken>` or the session cookie. Choose a workspace with `X-Tenant-Id`; without it the first membership is used.",
    },
    pagination: {
      title: "Pagination",
      body: "Cursor based: `?limit=20&cursor=…`. Responses carry `meta.nextCursor` and `meta.hasMore`; there is no total count, which keeps large lists fast.",
    },
    login: {
      title: "OTP login",
      body: "A Bangladeshi mobile number is the primary identity. The code is six digits, expires in five minutes and locks after five wrong attempts. Without an SMS provider configured, the sandbox response returns `devCode`.",
    },
    envelope: {
      title: "Response envelope",
      body: "Success and failure share one shape, so the client needs a single parsing path.",
    },
    error: {
      title: "Error envelope",
      body: "The code is stable, the message is human-readable. On `PLAN_LIMIT_REACHED` or `FEATURE_NOT_AVAILABLE`, `detail.upgradeTo` says which plan is needed.",
    },
    endpoints: {
      title: "Endpoints",
      summary: (operations: number, groups: number) =>
        `${operations} operations across ${groups} groups. 🔒 means authenticated.`,
      spec: "Full spec →",
      method: "Method",
      path: "Path",
      what: "What it does",
      auth: "Auth",
    },
    rateLimit: {
      title: "Rate limit",
      body: "Requests per minute are set per plan. Exceeding the limit returns `429 RATE_LIMITED` with `detail.retryAfterSeconds`.",
      plan: "Plan",
    },
    webhook: {
      title: "Webhook signature",
      body: "Every delivery carries `x-atlas-signature` (HMAC-SHA256). Verify it against the raw body before parsing JSON. If the same `eventKey` arrives twice, ignore the second — the order will not be marked paid twice.",
    },
    rules: {
      title: "The rules at a glance",
      items: [
        "Money is always a BDT decimal string — never a float.",
        "`Idempotency-Key` is required on checkout and payment calls.",
        "Cookie-authenticated mutations need the `x-atlas-csrf` header.",
        "Tenant and store ids in a body are never trusted.",
        "4xx means the request is wrong, 5xx means the server is — keep the `requestId`.",
        "Date/times are ISO-8601 (UTC); the platform UI shows Asia/Dhaka.",
      ],
    },
  },
} as const;

export async function generateMetadata() {
  const locale = await getLocale();
  return COPY[locale].meta;
}

export default async function DevelopersPage() {
  const locale = await getLocale();
  const t = COPY[locale];
  const samples = SAMPLES[locale];
  const endpoints = endpointSummaries();
  const tags = Array.from(new Set(endpoints.flatMap((endpoint) => endpoint.tags)));

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
      <div className="max-w-3xl space-y-4">
        <Badge tone="brand">{t.badge}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{t.title}</h1>
        <p className="text-ink-600">{t.intro}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/api/v1/openapi.json" variant="outline">
            {t.openapi}
          </ButtonLink>
          <ButtonLink href="/help#api" variant="ghost">
            {t.faq}
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost">
            {t.support}
          </ButtonLink>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink-900">{t.baseUrl.title}</p>
            <p className="rounded-lg bg-ink-900 px-3 py-2 font-mono text-xs text-white">/api/v1</p>
            <p className="text-xs text-ink-500">{t.baseUrl.body}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink-900">{t.auth.title}</p>
            <p className="text-sm text-ink-600">
              {t.auth.body.split("`X-Tenant-Id`")[0]}
              <code className="text-xs">X-Tenant-Id</code>
              {t.auth.body.split("`X-Tenant-Id`")[1] ?? ""}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-semibold text-ink-900">{t.pagination.title}</p>
            <p className="text-sm text-ink-600">{t.pagination.body}</p>
          </CardBody>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.login.title}</h2>
        <p className="max-w-3xl text-sm text-ink-600">{t.login.body}</p>
        <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
          {samples.login}
        </pre>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.envelope.title}</h2>
          <p className="text-sm text-ink-600">{t.envelope.body}</p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
            {samples.envelope}
          </pre>
        </div>
        <div className="min-w-0 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.error.title}</h2>
          <p className="text-sm text-ink-600">{t.error.body}</p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
            {samples.error}
          </pre>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.endpoints.title}</h2>
            <p className="text-sm text-ink-600">{t.endpoints.summary(endpoints.length, tags.length)}</p>
          </div>
          <Link href="/api/v1/openapi.json" className="text-sm font-medium text-brand-700 hover:underline">
            {t.endpoints.spec}
          </Link>
        </div>

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{t.endpoints.method}</Th>
                <Th>{t.endpoints.path}</Th>
                <Th>{t.endpoints.what}</Th>
                <Th>{t.endpoints.auth}</Th>
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
        <div className="min-w-0 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.rateLimit.title}</h2>
          <p className="text-sm text-ink-600">{t.rateLimit.body}</p>
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>{t.rateLimit.plan}</Th>
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

        <div className="min-w-0 space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">{t.webhook.title}</h2>
          <p className="text-sm text-ink-600">{t.webhook.body}</p>
          <pre className="overflow-x-auto rounded-xl bg-ink-900 px-5 py-4 font-mono text-xs leading-relaxed text-ink-100">
            {samples.webhook}
          </pre>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-6">
        <h2 className="text-lg font-semibold text-ink-900">{t.rules.title}</h2>
        <ul className="grid gap-2 text-sm text-ink-600 sm:grid-cols-2">
          {t.rules.items.map((rule) => (
            <li key={rule}>• {rule}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
