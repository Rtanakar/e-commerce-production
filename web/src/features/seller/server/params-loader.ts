// ============================================================================
// params-loader.ts — Seller onboarding URL search params (SSOT)
// ============================================================================
// Single schema, shared by client + server (mirrors features/courses pattern):
//   • Client hook : useQueryStates(sellerWizardParams)         (use-seller-params)
//   • Server cache: sellerWizardParamsCache.parse(searchParams) (optional, for SSR)
//
// `step` is the only URL-controlled piece of wizard state — everything else
// (pendingEmail/pendingPassword) is runtime memory, intentionally NOT in URL.
// Putting `step` in nuqs (instead of useState) lets the user refresh / share
// links AND removes the cascading `setState`-in-effect React warning.
// ============================================================================

import {
  parseAsStringEnum,
  createSearchParamsCache,
} from "nuqs/server";

// All valid wizard step values — anything else is treated as no-step (null)
// so the wizard's effect resolves it from auth + backend status.
export const WIZARD_STEPS = [
  "account",
  "verify",
  "upgrade",
  "shop",
  "bank",
  "complete",
  "blocked",
] as const;

export type WizardStepUrl = (typeof WIZARD_STEPS)[number];

// ============================================================================
// sellerWizardParams — single schema definition
// ============================================================================
// `step` is nullable — null means "haven't resolved yet, let the wizard
// decide based on auth + onboarding-status". Once resolved, wizard writes
// it back so refresh/share-link works.
//
// clearOnDefault NOT used here because the default is `null` (not in URL).
// ============================================================================
export const sellerWizardParams = {
  step: parseAsStringEnum<WizardStepUrl>([...WIZARD_STEPS]),
};

// ============================================================================
// Server-side cache — for use in (future) seller pages with SSR
// ============================================================================
export const sellerWizardParamsCache = createSearchParamsCache(
  sellerWizardParams,
);
