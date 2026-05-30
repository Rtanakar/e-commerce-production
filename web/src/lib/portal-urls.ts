// ============================================================================
// portal-urls.ts — Cross-portal (cross-host) URL helpers
// ============================================================================
// Shop and seller live on different hosts (localhost vs seller.localhost) so
// that each has its own cookie jar. Linking between them must therefore use
// ABSOLUTE, cross-origin URLs — a relative `href="/"` on the seller host would
// be caught by middleware and bounce back into the seller portal, never
// reaching the shop.
//
// Use plain <a href> (full navigation) for these, NOT next/link — we WANT a
// hard cross-origin navigation so the browser switches cookie jars cleanly.
// ============================================================================

// Customer storefront origin (no trailing slash)
export const SHOP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Seller portal origin (no trailing slash)
export const SELLER_ORIGIN =
  process.env.NEXT_PUBLIC_SELLER_APP_URL ?? "http://seller.localhost:3000";

/** Build an absolute URL into the SHOP portal. `path` should start with "/". */
export function shopUrl(path = "/"): string {
  return `${SHOP_ORIGIN}${path}`;
}

/** Build an absolute URL into the SELLER portal. `path` should start with "/". */
export function sellerUrl(path = "/"): string {
  return `${SELLER_ORIGIN}${path}`;
}
