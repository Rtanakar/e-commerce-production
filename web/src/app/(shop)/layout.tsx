// ============================================================================
// (shop)/layout.tsx - Customer storefront chrome
// ============================================================================
// Mounts SiteHeader (logo + search + user + wishlist + cart + categories).
// Routes inside (shop): home, products, shops, offers, category pages.
// ============================================================================

import { SiteHeader } from "@/components/shared/site-header";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
