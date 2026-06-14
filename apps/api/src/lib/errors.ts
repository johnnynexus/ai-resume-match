import type { ApiError } from "@resumematch/shared";

/**
 * Application error with a machine-readable code and an HTTP status. The global
 * error handler turns these into the structured `{ error: { code, message } }`
 * envelope; anything else becomes a generic 500 with no stack leaked to clients.
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function toErrorResponse(code: string, message: string): ApiError {
  return { error: { code, message } };
}
