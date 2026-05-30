import type { NextConfig } from "next";

// ============================================================================
// API proxy target — the real backend origin (server-to-server only)
// ============================================================================
// NOT NEXT_PUBLIC_* on purpose: the browser must NEVER call the backend
// directly. It calls same-origin `/api/v1/*`, Next proxies to this target.
// This is what makes seller-cookie isolation work (see rewrites below).
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // ==========================================================================
  // Same-origin API proxy (BFF pattern — Amazon / Vercel / Stripe Dashboard)
  // ==========================================================================
  // Browser hits `<currentHost>/api/v1/*` → Next forwards to the backend.
  //
  // Why this matters for SEPARATE seller cookies:
  //   Cookies are keyed by the host the BROWSER sees in the response. With a
  //   proxy, the response appears to come from the page's own host:
  //     • Shop page   localhost:3000        → cookies stored under `localhost`
  //     • Seller page seller.localhost:3000 → cookies stored under `seller.localhost`
  //   Result: DevTools shows ONLY that portal's cookies — true isolation, the
  //   exact behaviour Amazon Seller Central / Flipkart Seller Hub have.
  //
  //   (Calling localhost:8080 directly would key ALL cookies under `localhost`
  //    and both jars would show on every page — the bug you saw in DevTools.)
  //
  // Bonus: same-origin means NO CORS preflight + SameSite=Lax cookies just work.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
