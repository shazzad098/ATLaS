/**
 * OpenAPI 3.1 description of the public REST surface (PRD §11).
 *
 * One document, two consumers: `/api/v1/openapi.json` serves it to tooling, and
 * `/developers` renders the same paths so the reference cannot drift from the
 * published spec. Written as a plain object rather than generated from Zod so
 * the spec stays readable and can be diffed in review.
 */

export type HttpMethod = "get" | "post" | "patch" | "delete";

export type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  security?: Record<string, string[]>[];
  parameters?: {
    name: string;
    in: "path" | "query" | "header";
    required?: boolean;
    description?: string;
    schema?: Record<string, unknown>;
  }[];
  requestBody?: {
    required?: boolean;
    description?: string;
    content: Record<string, { schema: Record<string, unknown> }>;
  };
  responses: Record<
    string,
    {
      description: string;
      content?: Record<string, { schema: Record<string, unknown> }>;
    }
  >;
};

const envelope: Record<string, unknown> = {
  type: "object",
  required: ["data", "error", "meta"],
  properties: {
    data: { description: "Payload; `null` on error." },
    error: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: {
              type: "string",
              examples: [
                "VALIDATION_FAILED",
                "UNAUTHENTICATED",
                "FORBIDDEN",
                "NOT_FOUND",
                "CONFLICT",
                "PLAN_LIMIT_REACHED",
                "FEATURE_NOT_AVAILABLE",
                "RATE_LIMITED",
              ],
            },
            message: { type: "string" },
            detail: { type: "object", additionalProperties: true },
          },
        },
      ],
    },
    meta: {
      type: "object",
      required: ["requestId"],
      properties: {
        requestId: { type: "string", examples: ["req_0f8c…"] },
        nextCursor: { type: ["string", "null"] },
        hasMore: { type: "boolean" },
      },
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
});

const jsonResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
});

const STORE_ID = {
  name: "storeId",
  in: "path" as const,
  required: true,
  description: "Store id from `GET /api/v1/stores`.",
  schema: { type: "string" },
};

const CURSOR = {
  name: "cursor",
  in: "query" as const,
  description: "`meta.nextCursor` from the previous page.",
  schema: { type: "string" },
};

const LIMIT = {
  name: "limit",
  in: "query" as const,
  description: "Page size, 1–100 (default 20).",
  schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
};

const bearerAuth: Record<string, string[]>[] = [{ bearerAuth: [] }, { sessionCookie: [] }];

export const OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "ATLaS REST API",
    version: "1.0.0",
    description:
      "ATLaS — SaaS e-commerce store builder for Bangladesh. Every response uses the same envelope, " +
      "money is a decimal string in BDT, ids are opaque cuids, and mutating calls accept an " +
      "`Idempotency-Key` header. Authenticate with the session cookie or a `Bearer` access token.",
    contact: { name: "ATLaS developer support", url: "/contact" },
    license: { name: "Proprietary" },
  },
  servers: [{ url: "/", description: "Same origin as the dashboard" }],
  tags: [
    { name: "Auth", description: "OTP login, token rotation, logout." },
    { name: "Account", description: "Identity and workspace context." },
    { name: "Stores", description: "Tenant stores and their settings." },
    { name: "Catalog", description: "Products and stock." },
    { name: "Commerce", description: "Orders and customers." },
    { name: "Themes", description: "Theme catalog and selection." },
    { name: "Billing", description: "Subscription, usage and invoices." },
    { name: "Storefront", description: "Public, unauthenticated read + checkout." },
    { name: "Webhooks", description: "Signed payment callbacks." },
  ],
  security: bearerAuth,
  paths: {
    "/api/v1/health": {
      get: {
        tags: ["Account"],
        summary: "Liveness probe",
        description: "Returns the API version and database reachability. No auth required.",
        security: [],
        operationId: "getHealth",
        responses: { "200": jsonResponse("Service is healthy.") },
      },
    },
    "/api/v1/auth/request-otp": {
      post: {
        tags: ["Auth"],
        summary: "Send a login OTP",
        description:
          "Sends a 6-digit code to a Bangladesh mobile number. 5-minute expiry, 6 sends per number " +
          "per hour, and the plaintext code is never stored. When no SMS provider is configured the " +
          "sandbox returns it as `devCode`.",
        security: [],
        operationId: "requestOtp",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone"],
                properties: {
                  phone: { type: "string", examples: ["01712345678"] },
                  purpose: { type: "string", enum: ["LOGIN"], default: "LOGIN" },
                },
              },
            },
          },
        },
        responses: {
          "202": jsonResponse("OTP dispatched."),
          "422": errorResponse("Invalid phone number."),
          "429": errorResponse("Send limit reached for this number or IP."),
        },
      },
    },
    "/api/v1/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Exchange an OTP for tokens",
        description:
          "Consumes the code, issues an access token (1 hour) and rotating refresh token, and sets " +
          "the session cookies for browser clients. Codes lock after 5 failed attempts.",
        security: [],
        operationId: "verifyOtp",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["phone", "code"],
                properties: {
                  phone: { type: "string" },
                  code: { type: "string", pattern: "^\\d{6}$" },
                },
              },
            },
          },
        },
        responses: {
          "200": jsonResponse("Authenticated."),
          "401": errorResponse("Code expired, mismatched or locked."),
          "404": errorResponse("No account for this number."),
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate the refresh token",
        description: "Single-use rotation: the previous refresh token stops working immediately.",
        security: [{ sessionCookie: [] }],
        operationId: "refreshSession",
        responses: {
          "200": jsonResponse("Rotated."),
          "401": errorResponse("Refresh token invalid or expired."),
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke the current session",
        operationId: "logout",
        responses: { "200": jsonResponse("Session revoked.") },
      },
    },
    "/api/v1/me": {
      get: {
        tags: ["Account"],
        summary: "Current user, tenant, plan and stores",
        description:
          "Tenant context resolves from `X-Tenant-Id`, then the tenant cookie, then the first active " +
          "membership — never from client-supplied payload ids.",
        operationId: "getMe",
        responses: { "200": jsonResponse("Identity and workspace."), "401": errorResponse("Not signed in.") },
      },
    },
    "/api/v1/stores": {
      get: {
        tags: ["Stores"],
        summary: "List stores in the tenant",
        operationId: "listStores",
        responses: { "200": jsonResponse("Stores with host and counts.") },
      },
      post: {
        tags: ["Stores"],
        summary: "Create a store",
        description: "Creates the store, default pages, delivery zones, COD method and theme draft.",
        operationId: "createStore",
        responses: {
          "201": jsonResponse("Store created."),
          "402": errorResponse("Plan limit reached."),
          "409": errorResponse("Slug is taken."),
        },
      },
    },
    "/api/v1/stores/{storeId}/products": {
      get: {
        tags: ["Catalog"],
        summary: "List products",
        operationId: "listProducts",
        parameters: [
          STORE_ID,
          CURSOR,
          LIMIT,
          { name: "q", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
          },
          { name: "categoryId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonResponse("Cursor-paginated products."),
          "403": errorResponse("Missing `catalog:read` or foreign store."),
        },
      },
      post: {
        tags: ["Catalog"],
        summary: "Create a product",
        description: "Enforces the plan's product quota on the server before writing.",
        operationId: "createProduct",
        parameters: [STORE_ID],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "price"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  price: { type: "string", examples: ["1250.00"] },
                  comparePrice: { type: ["string", "null"] },
                  sku: { type: "string" },
                  stock: { type: "integer" },
                  status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
                  categoryId: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "201": jsonResponse("Product created."),
          "402": errorResponse("Product quota exhausted — upgrade required."),
          "422": errorResponse("Validation failed."),
        },
      },
    },
    "/api/v1/stores/{storeId}/orders": {
      get: {
        tags: ["Commerce"],
        summary: "List orders",
        operationId: "listOrders",
        parameters: [
          STORE_ID,
          CURSOR,
          LIMIT,
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": jsonResponse("Cursor-paginated orders.") },
      },
      post: {
        tags: ["Commerce"],
        summary: "Create an order",
        description: "Requires `Idempotency-Key`; stock is reserved atomically inside a transaction.",
        operationId: "createOrder",
        parameters: [
          STORE_ID,
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "201": jsonResponse("Order placed."),
          "409": errorResponse("Duplicate key or insufficient stock."),
        },
      },
    },
    "/api/v1/stores/{storeId}/orders/{orderId}": {
      get: {
        tags: ["Commerce"],
        summary: "Order detail with timeline",
        operationId: "getOrder",
        parameters: [STORE_ID, { name: "orderId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": jsonResponse("Order, events and payments."), "404": errorResponse("Not found.") },
      },
    },
    "/api/v1/stores/{storeId}/customers": {
      get: {
        tags: ["Commerce"],
        summary: "List customers with lifetime value",
        operationId: "listCustomers",
        parameters: [
          STORE_ID,
          CURSOR,
          LIMIT,
          { name: "q", in: "query", schema: { type: "string" } },
          {
            name: "blacklisted",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
          },
        ],
        responses: {
          "200": jsonResponse("Cursor-paginated customers; money is a BDT decimal string."),
          "403": errorResponse("Missing `customers:read`."),
        },
      },
    },
    "/api/v1/stores/{storeId}/themes": {
      get: {
        tags: ["Themes"],
        summary: "Theme catalog with plan access",
        operationId: "listThemes",
        parameters: [STORE_ID],
        responses: { "200": jsonResponse("Catalog, selection and switching rules.") },
      },
      post: {
        tags: ["Themes"],
        summary: "Select a theme",
        description:
          "Free is one-and-done, Basic locks after publish, Standard/Pro switch freely. A switch on a " +
          "published store lands in draft until the merchant publishes the design.",
        operationId: "selectTheme",
        parameters: [STORE_ID],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["themeCode"],
                properties: { themeCode: { type: "string", examples: ["nokshi"] } },
              },
            },
          },
        },
        responses: {
          "200": jsonResponse("Selected; includes compatibility warnings."),
          "402": errorResponse("Theme switching not allowed on this plan."),
          "403": errorResponse("Theme not included in this plan."),
        },
      },
    },
    "/api/v1/stores/{storeId}/billing": {
      get: {
        tags: ["Billing"],
        summary: "Subscription, usage, fees and invoices",
        operationId: "getBilling",
        parameters: [STORE_ID],
        responses: {
          "200": jsonResponse("Lifecycle state, quota usage, fee ledger and invoices."),
          "403": errorResponse("Missing `billing:read` (owner-only by default)."),
        },
      },
    },
    "/api/v1/public/stores/{slug}": {
      get: {
        tags: ["Storefront"],
        summary: "Published store by slug",
        security: [],
        operationId: "getPublicStore",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": jsonResponse("Store, theme and settings."),
          "404": errorResponse("Unknown or unpublished store."),
        },
      },
    },
    "/api/v1/public/stores/{slug}/products": {
      get: {
        tags: ["Storefront"],
        summary: "Published catalog",
        security: [],
        operationId: "listPublicProducts",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
          CURSOR,
          LIMIT,
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": jsonResponse("Cursor-paginated active products.") },
      },
    },
    "/api/v1/public/stores/{slug}/products/{productSlug}": {
      get: {
        tags: ["Storefront"],
        summary: "Product detail",
        security: [],
        operationId: "getPublicProduct",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
          { name: "productSlug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": jsonResponse("Product with variants."), "404": errorResponse("Not found.") },
      },
    },
    "/api/v1/public/stores/{slug}/checkout": {
      post: {
        tags: ["Storefront"],
        summary: "Place an order",
        description:
          "Guest checkout. `paymentMethod` is COD, BKASH, NAGAD or SSLCOMMERZ; online methods return a " +
          "sandbox redirect URL. Duplicate keys return the original order instead of charging twice.",
        security: [],
        operationId: "publicCheckout",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
          { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          "201": jsonResponse("Order placed; includes tracking token."),
          "402": errorResponse("Store is read-only or suspended."),
          "409": errorResponse("Stock changed or coupon exhausted."),
        },
      },
    },
    "/api/v1/webhooks/payments/{provider}": {
      post: {
        tags: ["Webhooks"],
        summary: "Payment gateway callback",
        description:
          "HMAC-verified per provider; `(provider, eventKey)` is unique so a duplicate callback never " +
          "double-pays an order. Rejected signatures leave the payment pending, never paid.",
        security: [],
        operationId: "paymentWebhook",
        parameters: [
          {
            name: "provider",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["bkash", "nagad", "sslcommerz"] },
          },
          { name: "x-sandbox-signature", in: "header", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonResponse("Processed or already known."),
          "401": errorResponse("Signature verification failed."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      sessionCookie: { type: "apiKey", in: "cookie", name: "atlas_at" },
    },
    schemas: {
      Envelope: envelope,
    },
  },
} as const;

export type EndpointSummary = {
  method: Uppercase<HttpMethod>;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  auth: boolean;
  parameters: string[];
};

/** Flattened endpoint list for the `/developers` reference page. */
export function endpointSummaries(): EndpointSummary[] {
  const out: EndpointSummary[] = [];

  for (const [path, item] of Object.entries(OPENAPI_DOCUMENT.paths)) {
    for (const [method, raw] of Object.entries(item as Record<string, unknown>)) {
      const operation = raw as OpenApiOperation;
      if (!operation?.responses) continue;

      out.push({
        method: method.toUpperCase() as EndpointSummary["method"],
        path,
        summary: operation.summary ?? path,
        description: operation.description ?? "",
        tags: operation.tags ?? [],
        auth: operation.security ? operation.security.length > 0 : true,
        parameters: (operation.parameters ?? []).map((parameter) =>
          parameter.in === "path" ? `:${parameter.name}` : parameter.name,
        ),
      });
    }
  }

  return out.sort((a, b) => a.path.localeCompare(b.path));
}
