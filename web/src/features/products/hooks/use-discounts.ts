// ============================================================================
// use-discounts.ts — Seller discount codes (selector + discount-codes page)
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { STALE_TIME, PAGINATION } from "@/config/constants";
import { discountKeys } from "../api/product-keys";
import {
  fetchDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from "../api/products-api";
import { useDiscountParams } from "./use-discount-params";
import { toDiscountApiQuery } from "../server/discount-params-loader";
import type { DiscountCode } from "../types";

// Simple list (DiscountSelector — isActive=true chips)
export function useDiscounts(
  query: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {},
) {
  return useQuery({
    queryKey: discountKeys.list(query),
    queryFn: () => fetchDiscounts(query),
    staleTime: STALE_TIME.LIST,
    placeholderData: keepPreviousData,
  });
}

// ============================================================================
// useDiscountList — full management list (nuqs + debounced search + pagination)
// ============================================================================
// useProducts ka mirror — URL state, 400ms debounced search, keepPreviousData,
// filter/pagination helpers. Server prefetch ke saath toDiscountApiQuery se key
// match.
// ============================================================================
export function useDiscountList() {
  const [params, setParams] = useDiscountParams();

  // debounced search
  const [searchValue, setSearchValue] = useState(params.search);
  useEffect(() => {
    if (searchValue === "" && params.search !== "") {
      setParams({ search: "", page: PAGINATION.DEFAULT_PAGE });
      return;
    }
    const t = setTimeout(() => {
      if (searchValue !== params.search) {
        setParams({ search: searchValue, page: PAGINATION.DEFAULT_PAGE });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchValue, params.search, setParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchValue(params.search);
  }, [params.search]);

  const apiQuery = toDiscountApiQuery(params);
  const query = useQuery({
    queryKey: discountKeys.list(apiQuery),
    queryFn: () => fetchDiscounts(apiQuery),
    staleTime: STALE_TIME.LIST,
    placeholderData: keepPreviousData,
  });

  const goToPage = (p: number) => setParams({ page: p });
  const goNext = () => {
    if (query.data?.hasNextPage) setParams({ page: params.page + 1 });
  };
  const goPrev = () => {
    if (query.data?.hasPreviousPage) setParams({ page: params.page - 1 });
  };
  const setStatus = (status: typeof params.status) => setParams({ status, page: 1 });
  const clearFilters = () => setParams({ search: "", status: "all", page: 1 });
  const hasFilters = !!params.search || params.status !== "all";

  return {
    ...query,
    items: query.data?.discounts ?? [],
    totalCount: query.data?.totalCount ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    hasNextPage: query.data?.hasNextPage ?? false,
    hasPreviousPage: query.data?.hasPreviousPage ?? false,
    searchValue,
    onSearchChange: setSearchValue,
    status: params.status,
    hasFilters,
    setStatus,
    clearFilters,
    page: params.page,
    pageSize: params.pageSize,
    goToPage,
    goNext,
    goPrev,
  };
}

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDiscount,
    onSuccess: () => qc.invalidateQueries({ queryKey: discountKeys.lists() }),
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DiscountCode> }) =>
      updateDiscount(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: discountKeys.lists() }),
  });
}

export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscount,
    onSuccess: () => qc.invalidateQueries({ queryKey: discountKeys.lists() }),
  });
}
