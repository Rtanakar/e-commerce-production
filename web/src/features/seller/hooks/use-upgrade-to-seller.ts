// ============================================================================
// use-upgrade-to-seller.ts — Customer → Vendor role flip mutation
// ============================================================================
// Backend rotates the session and sets fresh cookies. Frontend only needs to
// invalidate /me + /onboarding-status so role + step refresh.
// ============================================================================

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sellerApi } from "@/lib/seller/api";
import { ApiError } from "@/lib/api";
import { meQueryKey } from "@/lib/auth/hooks";
import { onboardingStatusQueryKey } from "./use-onboarding-status";
import { sellerMeQueryKey } from "./use-seller-me";

export function useUpgradeToSeller() {
  const qc = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof sellerApi.upgradeToSeller>>,
    ApiError,
    void
  >({
    mutationFn: () => sellerApi.upgradeToSeller(),
    onSuccess: async () => {
      // Backend just:
      //   1. Flipped DB role CUSTOMER → VENDOR
      //   2. Issued a fresh VENDOR session and set seller cookies (s_at/...)
      //   3. Customer cookies untouched (user stays logged in on /shop)
      // All three caches are stale — invalidate so the wizard re-resolves:
      //   - customer /me      (role might catch up on next refresh)
      //   - seller /me        (now should return the new vendor)
      //   - onboarding-status (will read seller cookies now)
      await Promise.all([
        qc.invalidateQueries({ queryKey: meQueryKey }),
        qc.invalidateQueries({ queryKey: sellerMeQueryKey }),
        qc.invalidateQueries({ queryKey: onboardingStatusQueryKey }),
      ]);
    },
  });
}
