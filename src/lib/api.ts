import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError, isAppError, ValidationError } from "@/lib/errors";

/**
 * REST envelope + pagination conventions (PRD §11 "API rules"):
 * OpenAPI-first, cursor pagination, request id, consistent errors, and an
 * idempotency key on checkout/payment.
 */

export type ApiMeta = {
  requestId: string;
  nextCursor?: string | null;
  total?: number;
  hasMore?: boolean;
};

export type ApiEnvelope<T> = {
  data: T | null;
  error: { code: string; message: string; detail?: Record<string, unknown> } | null;
  meta: ApiMeta;
};

export function newRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

export function ok<T>(
  data: T,
  init: { status?: number; meta?: Partial<ApiMeta>; headers?: HeadersInit } = {},
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    {
      data,
      error: null,
      meta: { requestId: newRequestId(), ...init.meta },
    },
    { status: init.status ?? 200, headers: init.headers },
  );
}

export function fail(error: unknown, requestId = newRequestId()): NextResponse<ApiEnvelope<never>> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_FAILED",
          message: "Input যাচাই করা যায়নি।",
          detail: { issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        },
        meta: { requestId },
      },
      { status: 422 },
    );
  }

  if (isAppError(error)) {
    return NextResponse.json(
      {
        data: null,
        error: { code: error.code, message: error.message, detail: error.detail },
        meta: { requestId },
      },
      { status: error.status },
    );
  }

  // Unknown failures are logged with the request id so support can correlate.
  console.error(`[api:${requestId}] unhandled`, error);
  return NextResponse.json(
    {
      data: null,
      error: { code: "INTERNAL", message: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" },
      meta: { requestId },
    },
    { status: 500 },
  );
}

/** Wrap a route handler so any thrown error becomes a consistent envelope. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: Args): Promise<NextResponse> => {
    const requestId = newRequestId();
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error, requestId);
    }
  };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Request body valid JSON নয়।");
  }
  return schema.parse(raw);
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export type Pagination = { limit: number; cursor: string | null };

export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  return { limit, cursor: searchParams.get("cursor") };
}

/**
 * Cursor pagination over a Prisma page fetched with `take: limit + 1`.
 * Returns the extra row as the next cursor instead of a total count.
 */
export function cursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null, hasMore };
}

/** Idempotency key for checkout/payment requests (PRD §11). */
export function idempotencyKeyFrom(request: Request): string | null {
  return request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key");
}

export function requireIdempotencyKey(request: Request): string {
  const key = idempotencyKeyFrom(request);
  if (!key) {
    throw new AppError(
      "VALIDATION_FAILED",
      "এই endpoint-এ `Idempotency-Key` header প্রয়োজন।",
      422,
    );
  }
  return key;
}

/** Client IP, honouring the proxy header set by the edge/CDN (PRD §13). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * In-memory fixed-window rate limiter. The MVP runs a single app instance with
 * Redis available later; the interface is the same either way.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, perMinute: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > perMinute) {
    throw new AppError("RATE_LIMITED", "খুব বেশি request পাঠানো হয়েছে। এক মিনিট পরে চেষ্টা করুন।", 429, {
      limit: perMinute,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    });
  }
}
