// ============================================================================
// discount-params-loader.ts — Discount codes list URL state (SSOT)
// ============================================================================
// Products params-loader ka same pattern: client (useQueryStates) + server
// (cache.parse) dono import karte. toDiscountApiQuery → queryKey match.
// ============================================================================

import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  createSearchParamsCache,
} from "nuqs/server";
import { PAGINATION } from "@/config/constants";

export const DISCOUNT_STATUS_FILTERS = ["all", "active", "inactive"] as const;

export const discountParams = {
  page: parseAsInteger
    .withDefault(PAGINATION.DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
  pageSize: parseAsInteger
    .withDefault(PAGINATION.DEFAULT_PAGE_SIZE)
    .withOptions({ clearOnDefault: true }),
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum<(typeof DISCOUNT_STATUS_FILTERS)[number]>([
    ...DISCOUNT_STATUS_FILTERS,
  ])
    .withDefault("all")
    .withOptions({ clearOnDefault: true }),
};

export const discountParamsCache = createSearchParamsCache(discountParams);

export interface SellerDiscountsApiQuery {
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

export function toDiscountApiQuery(params: {
  search: string;
  status: (typeof DISCOUNT_STATUS_FILTERS)[number];
  page: number;
  pageSize: number;
}): SellerDiscountsApiQuery {
  return {
    search: params.search || undefined,
    isActive:
      params.status === "all" ? undefined : params.status === "active",
    page: params.page,
    limit: params.pageSize,
  };
}
