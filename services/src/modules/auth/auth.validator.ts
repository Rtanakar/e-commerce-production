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
// Discriminated union NOT used - keeps API simple
// VENDOR requires shopName; CUSTOMER ignores it
// Service layer validates that VENDOR provides shopName
// ============================================================================
export const registerSchema = z
  .object({
    email: z.string().email().toLowerCase().trim().openapi({ example: "user@example.com" }),
    password: passwordSchema,
    name: z.string().min(2).max(100).trim().openapi({ example: "John Doe" }),
    // Public signup: CUSTOMER or VENDOR. ADMIN only via admin-create endpoint
    role: z.enum(["CUSTOMER", "VENDOR"]).optional().default("CUSTOMER"),
    // VENDOR seller onboarding flow: shopName collected in step 2 (setup-shop),
    // NOT at registration. This decouples account creation from shop setup -
    // industry pattern (Amazon Seller Central / Flipkart Seller Hub / Shopify
    // Partners). Account first, shop details after email verified.
    phone: z
      .string()
      .regex(/^\+?[1-9]\d{7,14}$/, "Invalid phone number")
      .optional(),
    country: z.string().length(2).optional().default("IN"),
  })
  .openapi("RegisterRequest");

// ============================================================================
// Verify OTP schema (registration / login OTP / etc.)
// ============================================================================
export const verifyOtpSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    otp: z
      .string()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must be numeric")
      .openapi({ example: "123456" }),
  })
  .openapi("VerifyOtpRequest");

// ============================================================================
// Resend OTP schema
// ============================================================================
export const resendOtpSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .openapi("ResendOtpRequest");

// ============================================================================
// Phone OTP schemas (SMS verification - protected endpoints)
// ============================================================================
// userId comes from the auth token (req.user.sub), NOT the body. Body only
// carries an OPTIONAL phone — present when the user is setting/changing their
// number, absent to (re)send to the phone already on file.
const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be E.164, e.g. +919876543210")
  .openapi({ example: "+919876543210" });

export const sendPhoneOtpSchema = z
  .object({
    phone: phoneNumberSchema.optional(),
  })
  .openapi("SendPhoneOtpRequest");

export const verifyPhoneOtpSchema = z
  .object({
    otp: z
      .string()
      .length(6, "OTP must be 6 digits")
      .regex(/^\d+$/, "OTP must be numeric")
      .openapi({ example: "123456" }),
  })
  .openapi("VerifyPhoneOtpRequest");

export type SendPhoneOtpDto = z.infer<typeof sendPhoneOtpSchema>;
export type VerifyPhoneOtpDto = z.infer<typeof verifyPhoneOtpSchema>;

// ============================================================================
// Forgot password schema
// ============================================================================
export const forgotPasswordSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .openapi("ForgotPasswordRequest");

// ============================================================================
// Reset password schema
// ============================================================================
// OTP-based password reset (Amazon/Flipkart pattern):
// email + otp + newPassword sent together. Server verifies OTP and resets atomically.
// Industry: cleaner mobile UX (no email-click required), works in WebView/Native apps.
export const resetPasswordSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    otp: z.string().length(6).regex(/^\d+$/, "OTP must be 6 digits"),
    newPassword: passwordSchema,
  })
  .openapi("ResetPasswordRequest");

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
// refreshToken optional in BODY - web clients send via httpOnly cookie
// Native/mobile clients send via body (no cookie jar)
// Controller checks both sources via getRefreshTokenFromRequest()
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
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
  // jti - access-token-only, used for blacklist revocation (tokens.ts attaches it)
  jti: z.string().optional(),
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
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
export type ResendOtpDto = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
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
