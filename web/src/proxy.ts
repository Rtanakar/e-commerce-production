// ============================================================================
// proxy.ts — Host-based portal routing (Next.js 16 `proxy` convention)
// ============================================================================
// Next.js 16 renamed `middleware.ts` → `proxy.ts` (function `middleware` →
// `proxy`). It now runs on the Node.js runtime (edge no longer supported here).
// Same request-interception API (NextRequest / NextResponse). The name
// "proxy" reflects that this sits at the app's network boundary — exactly how
// we use it: routing requests to the right portal by host.
// Ref: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
//
// Two portals share ONE Next.js app but live on different hosts:
//
//   localhost:3000          → customer storefront (shop)
//   seller.localhost:3000   → seller portal (become-seller, dashboard, ...)
//
// Different host = different browser cookie jar (see next.config.ts rewrites).
// So the seller's `seller-access-token` only exists under `seller.localhost`
// and never shows up when browsing the shop. This is the real isolation the
// nx-monorepo screenshot had — achieved here without a second app.
//
// `*.localhost` resolves to 127.0.0.1 automatically in Chrome/Edge/Firefox
// (RFC 6761) — no hosts-file edit needed for dev.
//
// Routing rules:
//   • seller host + "/"            → rewrite to /become-seller (portal home)
//   • seller host + shop-only path → redirect to the shop host
//   • shop host   + seller path    → redirect to the seller host
//   • shared auth pages            → allowed on either host (no bounce)
// API routes (/api/*) and Next internals are always passed through untouched
// so the proxy + asset loading keep working on both hosts.
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";

// Paths that belong to the SELLER portal. Anything matching these should only
// be served from the seller host.
const SELLER_PATHS = ["/become-seller", "/seller", "/seller-login"];

// Auth pages (sign-in/up, OTP, password reset) are SHARED — reachable on
// either host without a cross-host bounce. A seller and a customer both need
// to authenticate; the page itself decides which cookie jar to populate.
const SHARED_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-otp",
];

// Subdomain label that marks the seller host. In prod this becomes
// `seller.eshop.com`; the label check is the same.
const SELLER_HOST_PREFIX = "seller.";

function isSellerHost(host: string): boolean {
  return host.startsWith(SELLER_HOST_PREFIX);
}

function isSellerPath(pathname: string): boolean {
  return SELLER_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isSharedPath(pathname: string): boolean {
  return SHARED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Swap the host's leading `seller.` on/off to build the sibling portal URL.
function withHost(url: URL, host: string): URL {
  const next = new URL(url.toString());
  next.host = host;
  return next;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never touch API proxy, Next internals, or static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // files: .ico/.png/.css/... (no extension on routes)
  ) {
    return NextResponse.next();
  }

  // Shared auth pages — allow on either host, no bounce
  if (isSharedPath(pathname)) {
    return NextResponse.next();
  }

  const host = req.headers.get("host") ?? "";
  const onSellerHost = isSellerHost(host);
  const wantsSeller = isSellerPath(pathname);

  // ── Seller HOST ──────────────────────────────────────────────────────
  if (onSellerHost) {
    // Portal home: seller.localhost/ → render the onboarding wizard
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/become-seller";
      return NextResponse.rewrite(url);
    }
    // A shop-only path requested on the seller host → bounce to shop host
    if (!wantsSeller) {
      const shopHost = host.slice(SELLER_HOST_PREFIX.length); // drop "seller."
      return NextResponse.redirect(withHost(req.nextUrl, shopHost));
    }
    return NextResponse.next();
  }

  // ── Shop HOST ────────────────────────────────────────────────────────
  // A seller path requested on the shop host → bounce to the seller host
  if (wantsSeller) {
    return NextResponse.redirect(
      withHost(req.nextUrl, `${SELLER_HOST_PREFIX}${host}`),
    );
  }

  return NextResponse.next();
}

// Run on everything except static assets (we still early-return above, but
// this matcher keeps the proxy off the hot path for _next/static etc.)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
