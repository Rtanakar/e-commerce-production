// ============================================================================
// /become-seller — Onboarding wizard route shell
// ============================================================================
// All logic lives in features/seller. This route file is a thin shell that
// just renders the orchestrator (mirrors the auth feature structure).
// ============================================================================

import { SellerOnboardingWizard } from "@/features/seller/components/onboarding-wizard";

export default function BecomeSellerPage() {
  return <SellerOnboardingWizard />;
}
