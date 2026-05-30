// ============================================================================
// use-seller-me.ts — TanStack Query for /auth/seller/me (seller cookie jar)
// ============================================================================
// Parallel to useMe() but reads the seller cookies (s_at). Returning null on
// 401 lets the wizard branch cleanly into "show signup" vs "resume".
// ============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { sellerAuthApi } from "@/lib/seller-auth/api";
import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/api";

export const sellerMeQueryKey = ["seller-auth", "me"] as const;

export function useSellerMe() {
  return useQuery<AuthUser | null, ApiError>({
    queryKey: sellerMeQueryKey,
    queryFn: async () => {
      try {
        return await sellerAuthApi.me();
      } catch (err) {
        // 401 = not signed in as seller — return null, not error. The wizard
        // treats null as "no seller session" and falls back to customer auth.
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
