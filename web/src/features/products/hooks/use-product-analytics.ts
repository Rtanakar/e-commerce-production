// ============================================================================
// use-product-analytics.ts — dashboard distributions (category + status)
// ============================================================================
// Backend stats endpoint abhi nahi → existing list endpoint ke count (limit=1,
// totalCount) se compute karte hain. Categories ke liye useQueries fan-out.
// ============================================================================

"use client";

import { useQueries } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { productKeys } from "../api/product-keys";
import { fetchSellerProducts } from "../api/products-api";
import { useCategories } from "./use-categories";
import type { ProductStatus } from "../types";

export interface DistItem {
  name: string;
  count: number;
}

// ─── Products count per (top-level) category ───
export function useCategoryDistribution() {
  const { data: categories, isLoading: catLoading } = useCategories();
  const cats = categories ?? [];

  const results = useQueries({
    queries: cats.map((c) => ({
      queryKey: productKeys.sellerList({ categoryId: c.id, page: 1, limit: 1 }),
      queryFn: () => fetchSellerProducts({ categoryId: c.id, page: 1, limit: 1 }),
      staleTime: STALE_TIME.LIST,
      enabled: cats.length > 0,
    })),
  });

  const isLoading = catLoading || results.some((r) => r.isLoading);
  const data: DistItem[] = cats
    .map((c, i) => ({ name: c.name, count: results[i]?.data?.totalCount ?? 0 }))
    .filter((d) => d.count > 0);

  return { data, isLoading };
}

// ─── Products count per status ───
const STATUSES: { status: ProductStatus; name: string }[] = [
  { status: "ACTIVE", name: "Active" },
  { status: "DRAFT", name: "Draft" },
  { status: "OUT_OF_STOCK", name: "Out of stock" },
  { status: "ARCHIVED", name: "Archived" },
];

export function useStatusDistribution() {
  const results = useQueries({
    queries: STATUSES.map((s) => ({
      queryKey: productKeys.sellerList({ status: s.status, page: 1, limit: 1 }),
      queryFn: () => fetchSellerProducts({ status: s.status, page: 1, limit: 1 }),
      staleTime: STALE_TIME.LIST,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const data: DistItem[] = STATUSES.map((s, i) => ({
    name: s.name,
    count: results[i]?.data?.totalCount ?? 0,
  }));

  return { data, isLoading };
}
