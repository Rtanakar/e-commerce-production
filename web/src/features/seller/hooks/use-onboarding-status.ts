// ============================================================================
// use-onboarding-status.ts — TanStack Query for /vendors/onboarding-status
// ============================================================================
// Single source of truth for "where in the wizard is this user?"
// Backend computes step from DB state — frontend never trusts URL/role alone.
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerApi, type OnboardingStatus } from "@/lib/seller/api";
import { ApiError } from "@/lib/api";

export const onboardingStatusQueryKey = ["seller", "onboarding-status"] as const;

export function useOnboardingStatus(options: { enabled?: boolean } = {}) {
  return useQuery<OnboardingStatus, ApiError>({
    queryKey: onboardingStatusQueryKey,
    queryFn: sellerApi.getStatus,
    enabled: options.enabled ?? true,
    // staleTime 30s — status barely changes during wizard, but should refresh
    // after upgrade/setup mutations (invalidated explicitly there).
    staleTime: 30 * 1000,
    retry: (failureCount, error) => {
      // 401 = not logged in — anon wizard state handles via auth guard
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 1;
    },
  });
}
