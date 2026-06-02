// ============================================================================
// app/(shop)/page.tsx — Home page
// ============================================================================
// SiteHeader (logo + search + user + wishlist + cart) layout se aata hai.
// Yahan: top banner carousel (autoplay, framer motion) + storefront product
// grid (cards with hover-image-strip + color variants + quick-view + cart/
// wishlist). Filters/sort baad me.
// ============================================================================

import { ProductBannerCarousel } from "@/features/shop/components/product-banner-carousel";
import { ProductGrid } from "@/features/shop/views/product-grid";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <ProductBannerCarousel />
      <ProductGrid
        title="Discover products"
        subtitle="Premium products from trusted sellers"
        query={{ sort: "newest", limit: 24 }}
      />
    </main>
  );
}
