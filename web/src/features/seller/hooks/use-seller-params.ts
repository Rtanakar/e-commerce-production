// ============================================================================
// use-seller-params.ts — Client hook for seller wizard URL state
// ============================================================================
// Wraps nuqs' useQueryStates with the shared sellerWizardParams schema.
// One hook = entire wizard URL state in sync across components, refresh-safe,
// share-link friendly.
// ============================================================================

"use client";

import { useQueryStates } from "nuqs";
import { sellerWizardParams } from "../server/params-loader";

export function useSellerParams() {
  return useQueryStates(sellerWizardParams);
}
