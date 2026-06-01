// ============================================================================
// products-list-view.tsx — /seller/products ("All Products")
// ============================================================================
// Stats + search/filters + table + pagination. useProducts (nuqs + debounced
// search + keepPreviousData). Composed 4-export.
// ============================================================================

"use client";

import Link from "next/link";
import { AlertCircle, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/shared/page-heading";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useProducts } from "../hooks/use-products";
import { ProductsStats } from "../components/products-stats";
import { ProductsSearch } from "../components/products-search";
import {
  ProductsTable,
  ProductsTableSkeleton,
} from "../components/products-table";

// ─── Container ───
export function ProductsListContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-5 p-4 lg:p-6">
      <PageHeading
        title="Products"
        description="Your catalogue — create, edit, publish, and track stock."
        action={
          <Button asChild>
            <Link href="/seller/products/new" className="gap-2">
              <Plus className="size-4" /> New product
            </Link>
          </Button>
        }
      />
      {children}
    </div>
  );
}

// ─── Error ───
export function ProductsListError({
  error,
  resetErrorBoundary,
}: {
  error?: Error;
  resetErrorBoundary?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/30 bg-destructive/5 py-16 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-destructive/15">
        <AlertCircle className="size-6 text-destructive" />
      </span>
      <p className="font-medium">Failed to load products</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {error?.message ?? "Please try again."}
      </p>
      {resetErrorBoundary && (
        <Button
          variant="outline"
          size="sm"
          onClick={resetErrorBoundary}
          className="mt-4 gap-1.5"
        >
          <RotateCcw className="size-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

// ─── Content ───
export function ProductsListContent() {
  const {
    items,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    searchValue,
    onSearchChange,
    status,
    categoryId,
    sort,
    hasFilters,
    setStatus,
    setCategory,
    setSort,
    clearFilters,
    page,
    pageSize,
    goToPage,
    goNext,
    goPrev,
  } = useProducts();

  return (
    <div className="space-y-5">
      <ProductsStats />

      <ProductsSearch
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        status={status}
        onStatusChange={setStatus}
        categoryId={categoryId}
        onCategoryChange={setCategory}
        sort={sort}
        onSortChange={setSort}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      <div className="flex items-center justify-end">
        <span className="text-xs text-muted-foreground">
          {isLoading ? (
            <span className="animate-pulse">Loading…</span>
          ) : (
            <>
              {totalCount} product{totalCount !== 1 ? "s" : ""}
              {isFetching && (
                <span className="ml-2 inline-block size-1.5 animate-pulse rounded-full bg-primary" />
              )}
            </>
          )}
        </span>
      </div>

      {isLoading || isPlaceholderData ? (
        <ProductsTableSkeleton rows={pageSize > 10 ? 10 : pageSize} />
      ) : isError && items.length === 0 ? (
        <ProductsListError
          error={error as Error}
          resetErrorBoundary={() => refetch()}
        />
      ) : (
        <ProductsTable
          items={items}
          isFetching={isFetching}
          hasFilters={hasFilters}
        />
      )}

      {totalPages > 0 && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          isFetching={isFetching}
          onNextPage={goNext}
          onPreviousPage={goPrev}
          onPageChange={goToPage}
        />
      )}
    </div>
  );
}
