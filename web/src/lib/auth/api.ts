// ============================================================================
// auth/api.ts — Auth API endpoint calls (typed)
// ============================================================================
// Wraps `api.ts` with auth-specific endpoints + types.
// Used by TanStack Query hooks (see hooks.ts).
// ============================================================================

import { api } from "../api";

// ============================================================================
// Domain types (mirror backend AuthResponseDto)
// ============================================================================
export type UserRole = "CUSTOMER" | "VENDOR" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  phone?: string | null;
  image?: string | null;
  emailVerified?: string | null;
  vendorProfile?: {
    shopName: string;
    shopSlug: string;
    status: string;
    verifiedAt?: string | null;
  } | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ============================================================================
// API calls
// ============================================================================

export const authApi = {
  /** Register - creates account, sends OTP. NO tokens yet. */
  register: (input: {
    name: string;
    email: string;
    password: string;
    role?: "CUSTOMER" | "VENDOR";
    phone?: string;
    country?: string;
  }) =>
    api.post<{ email: string; otpSent: boolean; message?: string }>(
      "/auth/register",
      input,
      { skipRefresh: true },
    ),

  /** Verify OTP - marks email verified ONLY (no tokens issued).
   *  User must sign in manually via /login afterwards. */
  verifyOtp: (input: { email: string; otp: string }) =>
    api.post<{ email: string; verified: boolean; message: string }>(
      "/auth/verify-otp",
      input,
      { skipRefresh: true },
    ),

  /** Resend OTP */
  resendOtp: (input: { email: string }) =>
    api.post<{ otpSent: boolean; message?: string }>("/auth/resend-otp", input, {
      skipRefresh: true,
    }),

  /** Login - returns tokens, sets cookies */
  signIn: (input: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", input, { skipRefresh: true }),

  /** Logout current session */
  signOut: () => api.post<{ message: string }>("/auth/logout"),

  /** Logout all devices */
  signOutAll: () => api.post<{ message: string }>("/auth/logout-all"),

  /** Get current user */
  me: () => api.get<AuthUser>("/auth/me"),

  /** Forgot password - sends OTP to email */
  forgotPassword: (input: { email: string }) =>
    api.post<{ message: string }>("/auth/forgot-password", input, {
      skipRefresh: true,
    }),

  /** Reset password - email + OTP + new password */
  resetPassword: (input: { email: string; otp: string; newPassword: string }) =>
    api.post<{ message: string }>("/auth/reset-password", input, {
      skipRefresh: true,
    }),

  /** Change password (authenticated) */
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    api.post<{ message: string }>("/auth/change-password", input),
};
