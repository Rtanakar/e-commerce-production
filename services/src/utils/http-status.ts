// ============================================================================
// http-status.ts - HTTP status codes as named constants
// ============================================================================
// Magic numbers (200, 404) bad practice hai - readability kharab
// constants se code self-documenting ho jaata hai
// Netflix/GitHub APIs me ye exact pattern use hota hai
// ============================================================================

export const HttpStatus = {
  // ===== 2xx Success =====
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // ===== 3xx Redirection =====
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // ===== 4xx Client Errors =====
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // ===== 5xx Server Errors =====
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

// Error codes - machine-readable string constants
// Frontend in codes ke base pe i18n translation karega
// jaise "AUTH_INVALID_CREDENTIALS" → "Email ya password galat hai"
export const ErrorCode = {
  // Generic
  INTERNAL: "INTERNAL_SERVER_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  RATE_LIMITED: "RATE_LIMITED",

  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  SESSION_REVOKED: "SESSION_REVOKED",
  EMAIL_EXISTS: "EMAIL_EXISTS",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",

  // External
  BAD_GATEWAY: "BAD_GATEWAY",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];
