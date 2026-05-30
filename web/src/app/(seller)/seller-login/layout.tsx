// ============================================================================
// (seller)/seller-login/layout.tsx — minimal chrome for seller sign-in
// ============================================================================
// Reuses the lightweight onboarding header (brand + back-to-shop). NOT the
// dashboard sidebar (the user isn't authenticated yet here).
// ============================================================================

import { SellerHeader } from "@/features/seller/components/seller-header";

export default function SellerLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SellerHeader />
      <main className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
