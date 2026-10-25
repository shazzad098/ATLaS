import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import type { Request, Response } from "express";

/**
 * Single error surface for the API.
 *
 * - Keeps one JSON shape for every failure (`statusCode`, `error`, `message`,
 *   `path`, `timestamp`) instead of leaking Express/Nest defaults.
 * - Only 5xx are reported to Sentry: a wrong password or an expired token is
 *   expected traffic, not an incident.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown = "Internal server error";
    let error = status >= 500 ? "Internal Server Error" : "Error";

    if (isHttp) {
      const payload = exception.getResponse();
      if (typeof payload === "string") {
        message = payload;
      } else if (payload && typeof payload === "object") {
        const record = payload as { message?: unknown; error?: unknown };
        message = record.message ?? payload;
        if (typeof record.error === "string") error = record.error;
      }
    }

    if (status >= 500) {
      const detail = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`${request.method} ${request.originalUrl} -> ${status}\n${detail}`);
      Sentry.captureException(exception, {
        tags: { method: request.method, path: request.originalUrl },
      });
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
