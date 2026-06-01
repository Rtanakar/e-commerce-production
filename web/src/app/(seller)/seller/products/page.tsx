// ============================================================================
// /seller/products — All Products (server prefetch + nuqs searchParams)
// ============================================================================
// Server component (course /dashboard/courses pattern):
//   1. searchParams ko nuqs cache se parse
//   2. same apiQuery banake server-side prefetch (cookie-forwarded)
//   3. HydrateClient se client ko cache handoff → useProducts instant hit
// Client content useQuery + keepPreviousData (filter pe Suspense flash nahi).
// ============================================================================

import type { SearchParams } from "nuqs/server";
import { ErrorBoundary } from "react-error-boundary";
import { HydrateClient } from "@/lib/hydrate-client";
import {
  productParamsCache,
  toApiQuery,
} from "@/features/products/server/params-loader";
import { prefetchSellerProducts } from "@/features/products/server/prefetch";
import {
  ProductsListContainer,
  ProductsListContent,
  ProductsListError,
} from "@/features/products/views/products-list-view";

export const metadata = { title: "Products" };

export default async function SellerProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Parse URL params (nuqs cache) → API query (client useProducts ke same shape)
  const params = await productParamsCache.parse(searchParams);
  const apiQuery = toApiQuery(params);

  // Server-side prefetch — populate cache. Fail-soft (client refetch fallback).
  try {
    await prefetchSellerProducts(apiQuery);
  } catch {
    /* client useProducts will fetch + surface error inline */
  }

  return (
    <ProductsListContainer>
      <HydrateClient>
        <ErrorBoundary fallback={<ProductsListError />}>
          <ProductsListContent />
        </ErrorBoundary>
      </HydrateClient>
    </ProductsListContainer>
  );
}
