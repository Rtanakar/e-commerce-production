// ============================================================================
// /seller-login — returning seller sign-in
// ============================================================================
// Lives OUTSIDE the guarded /seller/* tree (that layout would bounce an
// unauthenticated visitor back to onboarding before the form could render).
// ============================================================================

import type { Metadata } from "next";
import { SellerSignInForm } from "@/features/seller/components/seller-signin-form";

export const metadata: Metadata = {
  title: "Seller sign in",
};

export default function SellerLoginPage() {
  return <SellerSignInForm />;
}
