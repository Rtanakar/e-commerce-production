// ============================================================================
// use-setup-shop.ts — Step 2 mutation (POST /vendors/setup-shop)
// ============================================================================

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sellerApi, type SetupShopInput } from "@/lib/seller/api";
import { ApiError } from "@/lib/api";
import { onboardingStatusQueryKey } from "./use-onboarding-status";

export function useSetupShop() {
  const qc = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof sellerApi.setupShop>>,
    ApiError,
    SetupShopInput
  >({
    mutationFn: (input) => sellerApi.setupShop(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: onboardingStatusQueryKey });
    },
  });
}
