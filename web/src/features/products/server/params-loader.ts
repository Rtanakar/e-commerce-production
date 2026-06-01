// ============================================================================
// params-loader.ts — Products list URL state (single source of truth)
// ============================================================================
// One schema, client (useQueryStates) + server (cache.parse) dono import karte.
// clearOnDefault → default value URL se drop (clean shareable links).
// ============================================================================

import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  createSearchParamsCache,
} from "nuqs/server";
import { PAGINATION } from "@/config/constants";

export const PRODUCT_STATUS_FILTERS = [
  "all",
  "DRAFT",
  "PENDING",
  "ACTIVE",
  "ARCHIVED",
  "DELETED",
  "OUT_OF_STOCK",
] as const;

export const PRODUCT_SORTS = [
  "newest",
  "oldest",
  "price-asc",
  "price-desc",
  "popular",
  "rating",
  "discount",
] as const;

export const productParams = {
  // offset pagination ("jump to page N")
  page: parseAsInteger
    .withDefault(PAGINATION.DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
  pageSize: parseAsInteger
    .withDefault(PAGINATION.DEFAULT_PAGE_SIZE)
    .withOptions({ clearOnDefault: true }),

  // filters
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum<(typeof PRODUCT_STATUS_FILTERS)[number]>([
    ...PRODUCT_STATUS_FILTERS,
  ])
    .withDefault("all")
    .withOptions({ clearOnDefault: true }),
  categoryId: parseAsString.withOptions({ clearOnDefault: true }),
  sort: parseAsStringEnum<(typeof PRODUCT_SORTS)[number]>([...PRODUCT_SORTS])
    .withDefault("newest")
    .withOptions({ clearOnDefault: true }),
};

export const productParamsCache = createSearchParamsCache(productParams);

// ============================================================================
// toApiQuery — parsed URL params → API query shape (client + server SAME)
// ============================================================================
// Client (use-products) aur server (prefetch) dono yahi use karte hain taaki
// TanStack queryKey bilkul match kare → hydration cache hit (no refetch flash).
// ============================================================================
export interface SellerProductsApiQuery {
  search?: string;
  status?: "DRAFT" | "PENDING" | "ACTIVE" | "ARCHIVED" | "DELETED" | "OUT_OF_STOCK";
  categoryId?: string;
  sort: (typeof PRODUCT_SORTS)[number];
  page: number;
  limit: number;
}

export function toApiQuery(params: {
  search: string;
  status: (typeof PRODUCT_STATUS_FILTERS)[number];
  categoryId: string | null;
  sort: (typeof PRODUCT_SORTS)[number];
  page: number;
  pageSize: number;
}): SellerProductsApiQuery {
  return {
    search: params.search || undefined,
    status: params.status === "all" ? undefined : params.status,
    categoryId: params.categoryId ?? undefined,
    sort: params.sort,
    page: params.page,
    limit: params.pageSize,
  };
}
