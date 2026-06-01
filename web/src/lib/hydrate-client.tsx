// ============================================================================
// hydrate-client.tsx — server → client cache handoff (HydrationBoundary)
// ============================================================================
// Server component. Prefetched queries (getQueryClient) ko dehydrate karke
// client ko deta hai → client useQuery same key pe instant cache hit (no flash).
// ============================================================================

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "./query-client";

export function HydrateClient({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
