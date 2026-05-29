// ============================================================================
// auth/hooks.ts — TanStack Query hooks for auth
// ============================================================================
// Mutations + queries with proper cache invalidation.
// useMe() returns current user (kept fresh, invalidated on login/logout).
// ============================================================================

"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { authApi, type AuthUser, type AuthResponse } from "./api";
import { ApiError, clearCsrfToken } from "../api";

// Stable query key - exported so other parts of the app can invalidate
export const meQueryKey = ["auth", "me"] as const;

// ============================================================================
// useMe - current user query
// ============================================================================
// staleTime 5 min - user data rarely changes
// retry: false - 401 means logged out, don't retry
// ============================================================================
export function useMe() {
  return useQuery<AuthUser, ApiError>({
    queryKey: meQueryKey,
    queryFn: authApi.me,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      // Don't retry on 401 (just means logged out)
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
  });
}

// ============================================================================
// Type helper: extract mutation onSuccess result without losing types
// ============================================================================
type AuthMutationOpts<TVars> = Omit<
  UseMutationOptions<AuthResponse, ApiError, TVars>,
  "mutationFn"
>;

// ============================================================================
// useSignUp
// ============================================================================
export function useSignUp() {
  return useMutation<
    { email: string; otpSent: boolean; message?: string },
    ApiError,
    Parameters<typeof authApi.register>[0]
  >({
    mutationFn: authApi.register,
  });
}

// ============================================================================
// useVerifyOtp - marks email verified (no tokens, no auto sign-in)
// User redirected to /signin after success
// ============================================================================
type VerifyOtpResult = { email: string; verified: boolean; message: string };

export function useVerifyOtp(
  opts?: Omit<
    UseMutationOptions<
      VerifyOtpResult,
      ApiError,
      { email: string; otp: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation<VerifyOtpResult, ApiError, { email: string; otp: string }>(
    {
      mutationFn: authApi.verifyOtp,
      ...opts,
    },
  );
}

// ============================================================================
// useSignIn
// ============================================================================
export function useSignIn(
  opts?: AuthMutationOpts<{ email: string; password: string }>,
) {
  const qc = useQueryClient();
  return useMutation<
    AuthResponse,
    ApiError,
    { email: string; password: string }
  >({
    mutationFn: authApi.signIn,
    ...opts,
    // Spread args to stay compatible across TanStack Query v5 minor bumps
    // (v5 added a 4th argument - we forward whatever the runtime sends)
    onSuccess: (...args) => {
      qc.setQueryData(meQueryKey, args[0].user);
      (opts?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args);
    },
  });
}

// ============================================================================
// useSignOut - clears cache on success
// ============================================================================
export function useSignOut() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, void>({
    mutationFn: authApi.signOut,
    onSuccess: () => {
      qc.setQueryData(meQueryKey, null);
      qc.clear(); // nuke all cached data - new user might log in
      clearCsrfToken(); // next /auth/me call will re-bootstrap fresh token
    },
  });
}

// ============================================================================
// useResendOtp
// ============================================================================
export function useResendOtp() {
  return useMutation<
    { otpSent: boolean; message?: string },
    ApiError,
    { email: string }
  >({
    mutationFn: authApi.resendOtp,
  });
}

// ============================================================================
// useForgotPassword
// ============================================================================
export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, { email: string }>({
    mutationFn: authApi.forgotPassword,
  });
}

// ============================================================================
// useResetPassword
// ============================================================================
export function useResetPassword() {
  return useMutation<
    { message: string },
    ApiError,
    { email: string; otp: string; newPassword: string }
  >({
    mutationFn: authApi.resetPassword,
  });
}
