// ============================================================================
// openapi.ts - OpenAPI 3.1 spec generator from Zod schemas
// ============================================================================
// zod-to-openapi pattern - schemas hi source of truth
// JSDoc duplication NAHI - validator file me hi .openapi() metadata
//
// Generated spec consumers:
//   - Swagger UI (interactive API explorer)
//   - Postman/Insomnia (import & test)
//   - Frontend SDK generation (openapi-typescript, openapi-fetch)
//
// Industry: Stripe, Twilio, Linear - all expose OpenAPI spec
// ============================================================================

import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { env } from "../config/env.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  userRoleSchema,
} from "../modules/auth/auth.validator.js";
import { z } from "zod";

// ============================================================================
// Registry - sab schemas + paths yahan register hote hai
// ============================================================================
const registry = new OpenAPIRegistry();

// ============================================================================
// Reusable schema components
// ============================================================================
registry.register("UserRole", userRoleSchema);
registry.register("RegisterRequest", registerSchema);
registry.register("LoginRequest", loginSchema);
registry.register("RefreshRequest", refreshSchema);
registry.register("ChangePasswordRequest", changePasswordSchema);
registry.register("VerifyOtpRequest", verifyOtpSchema);
registry.register("ResendOtpRequest", resendOtpSchema);
registry.register("ForgotPasswordRequest", forgotPasswordSchema);
registry.register("ResetPasswordRequest", resetPasswordSchema);

// User response schema
const userResponseSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().nullable(),
    role: userRoleSchema,
  })
  .openapi("User");
registry.register("User", userResponseSchema);

// Tokens schema
const tokensSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi("AuthTokens");
registry.register("AuthTokens", tokensSchema);

// Auth response (login/register/refresh)
const authResponseSchema = z
  .object({
    user: userResponseSchema,
    tokens: tokensSchema,
  })
  .openapi("AuthResponse");
registry.register("AuthResponse", authResponseSchema);

// Generic success response wrapper
const successResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.unknown(),
    requestId: z.string().optional(),
  })
  .openapi("SuccessResponse");

// Generic error response
const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
    requestId: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .openapi("ErrorResponse");
registry.register("ErrorResponse", errorResponseSchema);

// ============================================================================
// Security schemes - JWT Bearer (access) + httpOnly Cookie (refresh)
// ============================================================================
// bearerAuth: client sends `Authorization: Bearer <access_token>` header
// cookieAuth: browser auto-sends `rt` httpOnly cookie (Swagger UI also supports)
// ============================================================================
registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "rt",
  description:
    "httpOnly refresh-token cookie. Set automatically by login/verify-otp endpoints. " +
    "Browsers auto-send on /auth/refresh. Path-scoped to /api/v1/auth.",
});

const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "JWT access token. Format: Bearer <token>",
});

// ============================================================================
// Helper - error response template
// ============================================================================
function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: errorResponseSchema } },
  };
}

// ============================================================================
// AUTH paths
// ============================================================================
const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/register`,
  tags: ["Auth"],
  summary: "Register a new user",
  description: "Create a new customer or vendor account",
  request: {
    body: {
      content: { "application/json": { schema: registerSchema } },
    },
  },
  responses: {
    201: {
      description: "User created successfully",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Validation failed"),
    409: errorResponse("Email already exists"),
    429: errorResponse("Too many requests"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/login`,
  tags: ["Auth"],
  summary: "Log in",
  request: {
    body: { content: { "application/json": { schema: loginSchema } } },
  },
  responses: {
    200: {
      description: "Login successful",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Invalid credentials"),
    403: errorResponse("Account suspended"),
    429: errorResponse("Too many requests"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/refresh`,
  tags: ["Auth"],
  summary: "Refresh access token",
  description: "Exchange refresh token for new token pair (rotation)",
  request: {
    body: { content: { "application/json": { schema: refreshSchema } } },
  },
  responses: {
    200: {
      description: "Tokens refreshed",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Invalid or revoked refresh token"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/logout`,
  tags: ["Auth"],
  summary: "Log out (current session)",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Logged out",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/logout-all`,
  tags: ["Auth"],
  summary: "Log out from all devices",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "All sessions revoked",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/auth/me`,
  tags: ["Auth"],
  summary: "Get current user",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Current user",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/change-password`,
  tags: ["Auth"],
  summary: "Change password",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: { content: { "application/json": { schema: changePasswordSchema } } },
  },
  responses: {
    200: {
      description: "Password changed",
      content: { "application/json": { schema: successResponseSchema } },
    },
    401: errorResponse("Unauthorized or wrong current password"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/verify-otp`,
  tags: ["Auth"],
  summary: "Verify email OTP",
  description: "Verifies the OTP sent during registration. Returns tokens on success.",
  request: { body: { content: { "application/json": { schema: verifyOtpSchema } } } },
  responses: {
    200: {
      description: "OTP verified, tokens issued",
      content: { "application/json": { schema: successResponseSchema } },
    },
    400: errorResponse("Invalid or expired OTP"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/resend-otp`,
  tags: ["Auth"],
  summary: "Resend OTP",
  request: { body: { content: { "application/json": { schema: resendOtpSchema } } } },
  responses: {
    200: { description: "OTP resent (or silent if user doesn't exist)" },
    429: errorResponse("Cooldown active or hourly limit exceeded"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/forgot-password`,
  tags: ["Auth"],
  summary: "Request password reset email",
  request: { body: { content: { "application/json": { schema: forgotPasswordSchema } } } },
  responses: {
    200: { description: "Reset email sent (silent if user doesn't exist)" },
    429: errorResponse("Too many requests"),
  },
});

registry.registerPath({
  method: "post",
  path: `${apiBase}/auth/reset-password`,
  tags: ["Auth"],
  summary: "Reset password via token",
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: "Password reset" },
    400: errorResponse("Invalid or expired token"),
  },
});

// ============================================================================
// Health
// ============================================================================
registry.registerPath({
  method: "get",
  path: `${apiBase}/health`,
  tags: ["System"],
  summary: "Liveness probe",
  responses: {
    200: { description: "Service is alive" },
  },
});

registry.registerPath({
  method: "get",
  path: `${apiBase}/health/ready`,
  tags: ["System"],
  summary: "Readiness probe (deep check)",
  description: "Verifies DB + Redis connectivity",
  responses: {
    200: { description: "All dependencies healthy" },
    503: { description: "One or more dependencies unhealthy" },
  },
});

// ============================================================================
// Generate spec - on-demand (cached after first call)
// ============================================================================
let cachedSpec: ReturnType<OpenApiGeneratorV31["generateDocument"]> | null = null;

export function generateOpenApiSpec() {
  if (cachedSpec) return cachedSpec;

  const generator = new OpenApiGeneratorV31(registry.definitions);

  cachedSpec = generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "E-Commerce API",
      version: "1.0.0",
      description:
        "Multi-vendor e-commerce platform API. All endpoints return a consistent envelope: " +
        "`{ success: true, data }` or `{ success: false, error: { code, message } }`.",
      contact: { name: "Platform Team" },
      license: { name: "Proprietary" },
    },
    servers: [
      { url: "http://localhost:" + env.PORT, description: "Local development" },
      // Production servers add karo as needed:
      // { url: "https://api.shop.com", description: "Production" },
    ],
    tags: [
      { name: "Auth", description: "Authentication & session management" },
      { name: "System", description: "Health & operational endpoints" },
    ],
  });

  return cachedSpec;
}

export { registry };
