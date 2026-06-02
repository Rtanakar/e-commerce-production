// ============================================================================
// use-shop-products.ts — Public product listing (TanStack Query)
// ============================================================================
// Storefront product grid ke liye. Filters/sort/pagination optional.
// ============================================================================

"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { STALE_TIME } from "@/config/constants";
import { fetchShopProducts, type ShopProductsQuery } from "../api/shop-api";

export const shopProductKeys = {
  all: ["shop-products"] as const,
  list: (q: ShopProductsQuery) => [...shopProductKeys.all, "list", q] as const,
};

export function useShopProducts(query: ShopProductsQuery = {}) {
  return useQuery({
    queryKey: shopProductKeys.list(query),
    queryFn: () => fetchShopProducts(query),
    staleTime: STALE_TIME.LIST,
    placeholderData: keepPreviousData,
  });
}
