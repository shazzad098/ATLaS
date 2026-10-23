import { NextResponse } from "next/server";

export const dynamic = "force-static";

const document = {
  openapi: "3.1.0",
  info: {
    title: "ATLaS API",
    version: "1.0.0",
    description: "Multi-tenant storefront, catalog, order and payment API.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: { security: [], responses: { "200": { description: "Service health" } } },
    },
    "/me": {
      get: { responses: { "200": { description: "Current authenticated user" }, "401": { description: "Unauthenticated" } } },
    },
    "/stores": {
      get: { responses: { "200": { description: "Tenant stores" } } },
      post: {
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StoreInput" } } } },
        responses: { "201": { description: "Created store" }, "422": { description: "Validation error" } },
      },
    },
    "/public/stores/{slug}": {
      get: {
        security: [],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Published storefront" }, "404": { description: "Store not found" } },
      },
    },
    "/public/stores/{slug}/products": {
      get: {
        security: [],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Paginated product catalog" } },
      },
    },
    "/public/stores/{slug}/checkout": {
      post: {
        security: [],
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
          { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8 } },
        ],
        responses: { "200": { description: "Order/payment result" }, "422": { description: "Validation error" }, "429": { description: "Rate limited" } },
      },
    },
    "/webhooks/payments/{provider}": {
      post: {
        security: [],
        parameters: [{ name: "provider", in: "path", required: true, schema: { type: "string", enum: ["bkash", "nagad", "sslcommerz"] } }],
        responses: { "200": { description: "Recorded webhook outcome" } },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    schemas: {
      StoreInput: {
        type: "object",
        required: ["name", "slug"],
        properties: { name: { type: "string" }, slug: { type: "string" }, description: { type: "string" } },
      },
    },
  },
} as const;

export function GET() {
  return NextResponse.json(document, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
