// ============================================================================
// use-discount-params.ts — client hook for discount-codes list URL state
// ============================================================================

"use client";

import { useQueryStates } from "nuqs";
import { discountParams } from "../server/discount-params-loader";

export function useDiscountParams() {
  return useQueryStates(discountParams);
}
