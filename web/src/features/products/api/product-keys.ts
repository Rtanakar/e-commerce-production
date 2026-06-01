// ============================================================================
// product-keys.ts — TanStack Query key factory (pure module, no "use client")
// ============================================================================
// Server prefetch + client useQuery dono same keys import karte hain → cache
// hit. Stable serialization ke liye query object as-is key me jaata hai.
// ============================================================================

import type { ListProductsQuery } from "../types";

export const productKeys = {
  all: ["products"] as const,

  // Seller "All Products" list
  sellerLists: () => [...productKeys.all, "seller", "list"] as const,
  sellerList: (query: ListProductsQuery) =>
    [...productKeys.sellerLists(), query] as const,

  // Public storefront list
  publicLists: () => [...productKeys.all, "public", "list"] as const,
  publicList: (query: ListProductsQuery) =>
    [...productKeys.publicLists(), query] as const,

  // Single (seller edit / public detail)
  detail: (idOrSlug: string) =>
    [...productKeys.all, "detail", idOrSlug] as const,

  // Dashboard stats
  stats: () => [...productKeys.all, "stats"] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  tree: () => [...categoryKeys.all, "tree"] as const,
  list: (parentId?: string) =>
    [...categoryKeys.all, "list", parentId ?? "root"] as const,
};

export const discountKeys = {
  all: ["discounts"] as const,
  lists: () => [...discountKeys.all, "list"] as const,
  list: (query: {
    search?: string;
    isActive?: boolean;
    page?: number;
    cursor?: string | null;
  }) => [...discountKeys.lists(), query] as const,
  detail: (id: string) => [...discountKeys.all, "detail", id] as const,
};
