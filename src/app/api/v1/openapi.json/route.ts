import { NextResponse } from "next/server";
import { OPENAPI_DOCUMENT } from "@/lib/openapi";

/**
 * Machine-readable API description (PRD §11 "OpenAPI documentation").
 *
 * Public on purpose: the spec is already on `/developers`, and tooling such as
 * Postman or an SDK generator needs to fetch it without a key. It is served
 * unwrapped — the standard `{ data, error, meta }` envelope would make it
 * unreadable to OpenAPI tooling.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(OPENAPI_DOCUMENT, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
