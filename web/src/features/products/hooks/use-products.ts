// ============================================================================
// use-products.ts — Seller products list (URL state + debounced search +
// TanStack Query + keepPreviousData)
// ============================================================================
// Ek opinionated hook: URL state (nuqs) + debounced search + query + filter/
// pagination helpers. keepPreviousData → refetch ke dauraan purane results
// dikhte rahein (no layout shift). Course module ke useCourses ka mirror.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { STALE_TIME, PAGINATION } from "@/config/constants";
import { useProductParams } from "./use-product-params";
import { toApiQuery } from "../server/params-loader";
import { productKeys } from "../api/product-keys";
import { fetchSellerProducts } from "../api/products-api";

export function useProducts() {
  const [params, setParams] = useProductParams();

  // ─── Debounced search (400ms idle; clearing instant) ───
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

  // external sync (clear filters)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchValue(params.search);
  }, [params.search]);

  // ─── API query — server prefetch ke saath SAME shape (toApiQuery) ───
  const apiQuery = toApiQuery(params);

  const query = useQuery({
    queryKey: productKeys.sellerList(apiQuery),
    queryFn: () => fetchSellerProducts(apiQuery),
    staleTime: STALE_TIME.LIST,
    placeholderData: keepPreviousData,
  });

  // ─── Helpers ───
  const goToPage = (p: number) => setParams({ page: p });
  const goNext = () => {
    if (query.data?.hasNextPage) setParams({ page: params.page + 1 });
  };
  const goPrev = () => {
    if (query.data?.hasPreviousPage) setParams({ page: params.page - 1 });
  };

  const setStatus = (status: typeof params.status) =>
    setParams({ status, page: 1 });
  const setCategory = (categoryId: string | null) =>
    setParams({ categoryId, page: 1 });
  const setSort = (sort: typeof params.sort) => setParams({ sort, page: 1 });

  // sort bhi ek filter hai (default "newest") — isliye hasFilters me include karo
  // taaki sirf sort badalne par bhi Clear button dikhe (status/category jaisa).
  const hasFilters =
    !!params.search ||
    params.status !== "all" ||
    !!params.categoryId ||
    params.sort !== "newest";

  const clearFilters = () =>
    setParams({
      search: "",
      status: "all",
      categoryId: null,
      sort: "newest", // sort ko bhi default pe reset karo
      page: 1,
    });

  return {
    ...query,
    items: query.data?.products ?? [],
    totalCount: query.data?.totalCount ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    hasNextPage: query.data?.hasNextPage ?? false,
    hasPreviousPage: query.data?.hasPreviousPage ?? false,

    // search
    searchValue,
    onSearchChange: setSearchValue,

    // filters
    status: params.status,
    categoryId: params.categoryId,
    sort: params.sort,
    hasFilters,
    setStatus,
    setCategory,
    setSort,
    clearFilters,

    // pagination
    page: params.page,
    pageSize: params.pageSize,
    goToPage,
    goNext,
    goPrev,
  };
}
