// ============================================================================
// (seller)/become-seller/layout.tsx — Onboarding chrome (minimal header)
// ============================================================================
// The onboarding wizard gets the lightweight SellerHeader (brand + back-to-
// shop), NOT the dashboard sidebar. Anonymous + mid-onboarding users live here.
// ============================================================================

import { SellerHeader } from "@/features/seller/components/seller-header";

export default function BecomeSellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SellerHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
