// ============================================================================
// /seller/discount-codes — server prefetch + nuqs searchParams
// ============================================================================
// Products page ka same pattern: parse searchParams → prefetch (cookie-fwd) →
// HydrateClient → client table (nuqs + keepPreviousData).
// ============================================================================

import type { SearchParams } from "nuqs/server";
import { ErrorBoundary } from "react-error-boundary";
import { HydrateClient } from "@/lib/hydrate-client";
import {
  discountParamsCache,
  toDiscountApiQuery,
} from "@/features/products/server/discount-params-loader";
import { prefetchSellerDiscounts } from "@/features/products/server/discount-prefetch";
import {
  DiscountCodesContainer,
  DiscountCodesContent,
  DiscountCodesError,
} from "@/features/products/views/discount-codes-view";

export const metadata = { title: "Discount codes" };

export default async function SellerDiscountCodesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await discountParamsCache.parse(searchParams);
  const apiQuery = toDiscountApiQuery(params);

  try {
    await prefetchSellerDiscounts(apiQuery);
  } catch {
    /* client refetch fallback */
  }

  return (
    <DiscountCodesContainer>
      <HydrateClient>
        <ErrorBoundary fallback={<DiscountCodesError />}>
          <DiscountCodesContent />
        </ErrorBoundary>
      </HydrateClient>
    </DiscountCodesContainer>
  );
}
