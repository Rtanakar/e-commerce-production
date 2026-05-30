// ============================================================================
// (seller)/layout.tsx — Seller portal chrome (Amazon Seller Central pattern)
// ============================================================================
// Completely isolated from customer storefront UI — no SiteHeader, no
// CategoryBar, no cart icons. Sellers get a focused workspace.
//
// Routes inside (seller):
//   /become-seller       → onboarding wizard
//   /seller/dashboard    → seller dashboard (future)
// ============================================================================

import { SellerHeader } from "@/features/seller/components/seller-header";

export default function SellerLayout({
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
