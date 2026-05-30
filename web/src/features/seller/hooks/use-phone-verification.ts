// ============================================================================
// use-phone-verification.ts — SMS OTP send/verify mutations (seller jar)
// ============================================================================
// Wraps the seller phone endpoints. Verify success invalidates seller /me +
// onboarding-status so the wizard + dashboard see phoneVerified immediately.
// ============================================================================

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sellerAuthApi } from "@/lib/seller-auth/api";
import { ApiError } from "@/lib/api";
import { sellerMeQueryKey } from "./use-seller-me";
import { onboardingStatusQueryKey } from "./use-onboarding-status";

export function useSendPhoneOtp() {
  return useMutation<
    Awaited<ReturnType<typeof sellerAuthApi.sendPhoneOtp>>,
    ApiError,
    { phone?: string } | void
  >({
    mutationFn: (input) => sellerAuthApi.sendPhoneOtp(input ?? {}),
  });
}

export function useVerifyPhoneOtp() {
  const qc = useQueryClient();
  return useMutation<
    Awaited<ReturnType<typeof sellerAuthApi.verifyPhoneOtp>>,
    ApiError,
    { otp: string }
  >({
    mutationFn: (input) => sellerAuthApi.verifyPhoneOtp(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: sellerMeQueryKey }),
        qc.invalidateQueries({ queryKey: onboardingStatusQueryKey }),
      ]);
    },
  });
}
