// ============================================================================
// use-connect-bank.ts — Step 3 mutation (POST /vendors/connect-bank)
// ============================================================================

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sellerApi, type ConnectBankInput } from "@/lib/seller/api";
import { ApiError } from "@/lib/api";
import { onboardingStatusQueryKey } from "./use-onboarding-status";

export function useConnectBank() {
  const qc = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof sellerApi.connectBank>>,
    ApiError,
    ConnectBankInput
  >({
    mutationFn: (input) => sellerApi.connectBank(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: onboardingStatusQueryKey });
    },
  });
}
