// ============================================================================
// use-product-params.ts — client hook for products list URL state
// ============================================================================

"use client";

import { useQueryStates } from "nuqs";
import { productParams } from "../server/params-loader";

export function useProductParams() {
  return useQueryStates(productParams);
}
