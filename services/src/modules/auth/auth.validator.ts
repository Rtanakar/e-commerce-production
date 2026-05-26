// ============================================================================
// auth.validator.ts - Zod schemas (Single Source of Truth)
// ============================================================================
// Zod schema = TS type + runtime validation - duplicate definitions zero
// Frontend bhi same schemas use kar sakta hai (publish as @workspace/sdk later)
//
// extendZodWithOpenApi - zod-to-openapi se schemas ko OpenAPI metadata bhi dete
// Single source: Zod → TS types + runtime validation + OpenAPI spec
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend zod with .openapi() method - call once at module load
extendZodWithOpenApi(z);

// ============================================================================
// Password rule - production grade (OWASP recommendations)
// ============================================================================
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password cannot exceed 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain a special character")
  .openapi({ example: "SecureP@ssw0rd" });

// ============================================================================
// Role enum
// ============================================================================
export const userRoleSchema = z
  .enum(["CUSTOMER", "VENDOR", "ADMIN"])
  .openapi("UserRole", { example: "CUSTOMER" });

// ============================================================================
// Register schema
// ============================================================================
export const registerSchema = z
  .object({
    email: z.string().email().toLowerCase().trim().openapi({ example: "user@example.com" }),
    password: passwordSchema,
    name: z.string().min(2).max(100).trim().openapi({ example: "John Doe" }),
    // Vendor signup publicly allowed - admin verifies before selling
    role: z.enum(["CUSTOMER", "VENDOR"]).optional().default("CUSTOMER"),
  })
  .openapi("RegisterRequest");

// ============================================================================
// Login schema
// ============================================================================
// Password validation rules NOT applied here - user already created
// Only non-empty check
// ============================================================================
export const loginSchema = z
  .object({
    email: z.string().email().toLowerCase().trim().openapi({ example: "user@example.com" }),
    password: z.string().min(1, "Password is required").openapi({ example: "SecureP@ssw0rd" }),
  })
  .openapi("LoginRequest");

// ============================================================================
// Refresh schema
// ============================================================================
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .openapi("RefreshRequest");

// ============================================================================
// Change password schema
// ============================================================================
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  })
  .openapi("ChangePasswordRequest");

// ============================================================================
// JWT payload schema
// ============================================================================
// `sub`, `iat`, `exp` - JWT standard claims (RFC 7519)
// `sid` - custom session id for revocation
// ============================================================================
export const jwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  sid: z.string(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  aud: z.string().optional(),
});

// ============================================================================
// Inferred types (zero duplication)
// ============================================================================
export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
export type UserRoleType = z.infer<typeof userRoleSchema>;

// ============================================================================
// Response DTOs
// ============================================================================
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  name: string | null;
  role: UserRoleType;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}
