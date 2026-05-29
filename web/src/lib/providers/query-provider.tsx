// ============================================================================
// query-provider.tsx — TanStack Query client wrapper
// ============================================================================
// Pattern: per-request QueryClient on server (avoids leaking between requests),
// stable singleton on client.
//
// Industry: Vercel/Linear/Cal.com all use this exact pattern with Next App Router.
// ============================================================================

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { ApiError } from "../api";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // SSR-safe default: rely on staleTime in queries, no auto-refetch on mount
        staleTime: 30 * 1000,
        // Don't retry on 4xx errors (client mistake) - only network/5xx
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Mutations don't retry by default - business logic should be idempotent if needed
        retry: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

function getClient() {
  if (typeof window === "undefined") {
    // Server: always new (no shared state between requests)
    return makeQueryClient();
  }
  // Browser: reuse singleton
  browserClient ??= makeQueryClient();
  return browserClient;
}

export function QueryProvider({ children }: PropsWithChildren) {
  // useState ensures stable identity across renders
  const [client] = useState(getClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
