// ============================================================================
// errors.ts - Custom Error class hierarchy
// ============================================================================
// Production grade error hierarchy - Stripe, AWS, GitHub APIs jaise
//
// Class-based kyun (functions ke contrary):
//   1. instanceof check - type-safe error handling in middleware
//   2. Inheritance - common fields parent me, specific child me
//   3. Sentry/Datadog auto-classify by class name
//   4. Native Error.captureStackTrace clean stack traces
//
// Operational vs Programmer error distinction (Joyent best practice):
//   - Operational: expected runtime (404, validation) → user-friendly response
//   - Programmer: bugs (undefined.foo) → generic message, full log
// ============================================================================

import { HttpStatus, ErrorCode, type HttpStatusCode, type ErrorCodeType } from "./http-status.js";

// ============================================================================
// BASE: AppError
// ============================================================================
export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCodeType;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    statusCode: HttpStatusCode,
    code: ErrorCodeType,
    message: string,
    options: { details?: unknown; isOperational?: boolean; cause?: unknown } = {},
  ) {
    super(message);

    // Without this, instanceof Error fails in some bundlers (TS quirk)
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    this.timestamp = new Date().toISOString();

    // ES2022 cause chain - root cause trace
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }

    // V8 - clean stack trace
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV !== "production" && { stack: this.stack }),
    };
  }
}

// ============================================================================
// 4xx Client Errors
// ============================================================================

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, message, { details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code: ErrorCodeType = ErrorCode.UNAUTHORIZED) {
    super(HttpStatus.UNAUTHORIZED, code, message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid email or password") {
    super(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, message);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = "Invalid or expired token") {
    super(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_TOKEN, message);
  }
}

export class SessionRevokedError extends AppError {
  constructor(message = "Session invalidated, please log in again") {
    super(HttpStatus.UNAUTHORIZED, ErrorCode.SESSION_REVOKED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to perform this action") {
    super(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, message);
  }
}

export class AccountSuspendedError extends AppError {
  constructor(message = "Your account has been suspended") {
    super(HttpStatus.FORBIDDEN, ErrorCode.ACCOUNT_SUSPENDED, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(HttpStatus.CONFLICT, ErrorCode.CONFLICT, message);
  }
}

export class EmailExistsError extends AppError {
  constructor(message = "An account with this email already exists") {
    super(HttpStatus.CONFLICT, ErrorCode.EMAIL_EXISTS, message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Request could not be processed", details?: unknown) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_FAILED, message, { details });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, message);
  }
}

// ============================================================================
// 5xx Server Errors
// ============================================================================

export class InternalServerError extends AppError {
  constructor(message = "Internal server error", cause?: unknown) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL, message, {
      isOperational: false,
      cause,
    });
  }
}

export class BadGatewayError extends AppError {
  constructor(message = "Upstream service unavailable") {
    super(HttpStatus.BAD_GATEWAY, ErrorCode.BAD_GATEWAY, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable, please try again") {
    super(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE, message);
  }
}
