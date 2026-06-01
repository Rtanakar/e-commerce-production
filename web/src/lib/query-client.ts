// ============================================================================
// query-client.ts — server-side QueryClient (per-request, React cache())
// ============================================================================
// Server components prefetch yahin se client lete hain. React `cache()` →
// ek request ke andar single instance (prefetch + dehydrate same client).
// ============================================================================

import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { cache } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },
      dehydrate: {
        // pending queries bhi dehydrate (streaming-safe)
        shouldDehydrateQuery: (q) =>
          defaultShouldDehydrateQuery(q) || q.state.status === "pending",
      },
    },
  });
}

// Per-request singleton (server). cache() request ke scope me memoize karta.
export const getQueryClient = cache(makeQueryClient);
