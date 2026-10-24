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
    "/auth/request-otp": {
      post: {
        security: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OtpRequest" } } } },
        responses: { "200": { description: "OTP requested" }, "409": { description: "Account already exists" }, "429": { description: "Rate limited" } },
      },
    },
    "/auth/verify-otp": {
      post: {
        security: [],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OtpVerification" } } } },
        responses: { "200": { description: "OTP verified and session created/reset completed" }, "401": { description: "Account not found" }, "422": { description: "Invalid OTP" } },
      },
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
    "/webhooks/couriers/{provider}": {
      post: {
        security: [],
        parameters: [{ name: "provider", in: "path", required: true, schema: { type: "string" } }, { name: "x-courier-signature", in: "header", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Recorded courier shipment status" }, "401": { description: "Invalid courier signature" } },
      },
    },
    "/stores/{storeId}/payment-methods": {
      get: {
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Merchant payment methods without secret values" } },
      },
    },
    "/stores/{storeId}/payment-methods/{provider}": {
      put: {
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }, { name: "provider", in: "path", required: true, schema: { type: "string", enum: ["COD", "BKASH", "NAGAD", "SSLCOMMERZ"] } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentMethodConfig" } } } },
        responses: { "200": { description: "Payment method configured" }, "422": { description: "Invalid provider or configuration" } },
      },
      post: {
        parameters: [{ name: "storeId", in: "path", required: true, schema: { type: "string" } }, { name: "provider", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Gateway connection configuration test" } },
      },
    },
    "/webhooks/merchant": {
      get: { responses: { "200": { description: "Merchant webhook endpoints without secret values" } } },
      post: {
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/MerchantWebhookEndpoint" } } } },
        responses: { "201": { description: "Created endpoint; signing secret is returned once" } },
      },
    },
    "/webhooks/merchant/{endpointId}": {
      patch: { requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/MerchantWebhookEndpointPatch" } } } }, responses: { "200": { description: "Updated endpoint" } } },
      delete: { responses: { "200": { description: "Deleted endpoint" } } },
    },
    "/webhooks/merchant/{endpointId}/test": {
      post: { responses: { "200": { description: "Test delivery result" } } },
    },
    "/stores/{storeId}/orders/{orderId}/shipments": {
      get: { responses: { "200": { description: "Courier shipments for an order" } } },
      post: {
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CreateShipment" } } } },
        responses: { "201": { description: "Courier shipment created" }, "503": { description: "Courier integration unavailable" } },
      },
    },
    "/stores/{storeId}/orders/{orderId}/returns": {
      post: {
        parameters: [
          { name: "storeId", in: "path", required: true, schema: { type: "string" } },
          { name: "orderId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnRequest" } } } },
        responses: { "201": { description: "Return request created" }, "409": { description: "Duplicate active request" }, "422": { description: "Order is not returnable" } },
      },
    },
    "/stores/{storeId}/orders/{orderId}/returns/{returnId}": {
      patch: {
        parameters: [
          { name: "storeId", in: "path", required: true, schema: { type: "string" } },
          { name: "orderId", in: "path", required: true, schema: { type: "string" } },
          { name: "returnId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnResolution" } } } },
        responses: { "200": { description: "Return request resolved" }, "404": { description: "Return request not found" } },
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
      OtpRequest: {
        type: "object",
        required: ["phone"],
        properties: { phone: { type: "string" }, purpose: { type: "string", enum: ["LOGIN", "SIGNUP", "PASSWORD_RESET"] } },
      },
      OtpVerification: {
        type: "object",
        required: ["phone", "code"],
        properties: { phone: { type: "string" }, code: { type: "string", pattern: "^[0-9]{6}$" }, purpose: { type: "string" }, name: { type: "string" }, password: { type: "string", format: "password" }, newPassword: { type: "string", format: "password" } },
      },
      ReturnRequest: {
        type: "object",
        required: ["reason"],
        properties: { reason: { type: "string", minLength: 5, maxLength: 500 } },
      },
      ReturnResolution: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: ["APPROVED", "REJECTED", "RECEIVED", "REFUNDED"] }, resolution: { type: "string", maxLength: 500 } },
      },
      PaymentMethodConfig: {
        type: "object",
        required: ["isEnabled"],
        properties: { isEnabled: { type: "boolean" }, credentials: { type: "object", additionalProperties: { type: "string", format: "password" } } },
      },
      MerchantWebhookEndpoint: {
        type: "object",
        required: ["name", "url"],
        properties: { name: { type: "string" }, url: { type: "string", format: "uri" }, eventTypes: { type: "array", items: { type: "string" } }, isActive: { type: "boolean" } },
      },
      MerchantWebhookEndpointPatch: {
        allOf: [{ $ref: "#/components/schemas/MerchantWebhookEndpoint" }, { type: "object", properties: { rotateSecret: { type: "boolean" } } }],
      },
      CreateShipment: {
        type: "object",
        properties: { provider: { type: "string" }, serviceType: { type: "string" }, notes: { type: "string" } },
      },
    },
  },
} as const;

export function GET() {
  return NextResponse.json(document, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
