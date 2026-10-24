/**
 * Application errors.
 *
 * Every failure that a client should understand is an `AppError`, which carries
 * the HTTP status and a stable machine code. The API layer serialises these
 * into the consistent error envelope required by PRD §11.
 */

export type AppErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PLAN_LIMIT_REACHED"
  | "FEATURE_NOT_AVAILABLE"
  | "RATE_LIMITED"
  | "PAYMENT_FAILED"
  | "INTEGRATION_FAILED"
  | "TENANT_MISMATCH"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly detail: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    status: number,
    detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Input যাচাই করা যায়নি।", detail: Record<string, unknown> = {}) {
    super("VALIDATION_FAILED", message, 422, detail);
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "লগইন প্রয়োজন।") {
    super("UNAUTHENTICATED", message, 401);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "এই কাজের অনুমতি আপনার নেই।", detail: Record<string, unknown> = {}) {
    super("FORBIDDEN", message, 403, detail);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("NOT_FOUND", `${resource} পাওয়া যায়নি।`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, detail: Record<string, unknown> = {}) {
    super("CONFLICT", message, 409, detail);
    this.name = "ConflictError";
  }
}

export class TenantMismatchError extends AppError {
  constructor() {
    super(
      "TENANT_MISMATCH",
      "এই resource আপনার account-এর নয়।",
      403,
    );
    this.name = "TenantMismatchError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
