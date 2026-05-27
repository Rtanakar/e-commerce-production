// ============================================================================
// cookies.ts - Auth cookie helpers (FAANG dual-cookie pattern)
// ============================================================================
// Industry pattern (GitHub/Vercel/Linear/Stripe):
//   - Access token  → httpOnly cookie  (path=/api  - sent on every API call)
//   - Refresh token → httpOnly cookie  (path=/api/v1/auth  - sent only on auth)
//   - Both ALSO returned in response BODY (mobile/native clients without cookie jar)
//
// Why dual cookie?
//   - Browser auto-sends → no header juggling, Postman testing works out of box
//   - XSS-proof (httpOnly = JS cannot read document.cookie)
//   - Path scoping reduces attack surface (refresh cookie not leaked on every API call)
//
// Cookie flags reference:
//   httpOnly: true       → JS cannot read (document.cookie returns "")
//   secure:   true (prod) → HTTPS only (browser drops on http://)
//   sameSite: "lax"      → sent on top-level navigation (default modern)
//             "none"     → cross-site allowed (requires secure: true)
//   path:    "/api/v1/auth" → only sent on matching paths (minimize attack surface)
//   maxAge:  ms          → cookie lifetime
//   domain:  ".shop.com" → subdomain sharing
// ============================================================================

import type { Response, Request, CookieOptions } from "express";
import { env, isProd } from "../config/env.js";

// ============================================================================
// Cookie names - constants (avoid magic strings)
// ============================================================================
export const CookieNames = {
  /** Access token - httpOnly, path-scoped to whole API */
  ACCESS_TOKEN: "at",
  /** Refresh token - httpOnly, path-scoped to /auth */
  REFRESH_TOKEN: "rt",
  /** Optional CSRF mirror - future double-submit pattern */
  CSRF: "csrf",
} as const;

// ============================================================================
// Common cookie defaults - shared across all auth cookies
// ============================================================================
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd, // localhost is http → false in dev
    sameSite: "lax",
    ...(env.COOKIE_DOMAIN && { domain: env.COOKIE_DOMAIN }),
  };
}

// ============================================================================
// setAccessCookie - call on login/register/verify-otp/refresh
// ============================================================================
// Path: /api/v1 → sent on every API call automatically
// Short-lived (15m typical) - matches JWT access token expiry
// ============================================================================
export function setAccessCookie(res: Response, accessToken: string): void {
  const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

  res.cookie(CookieNames.ACCESS_TOKEN, accessToken, {
    ...baseCookieOptions(),
    // Sent on ALL /api/v1/* requests
    path: apiBase,
    maxAge: parseExpiryToMs(env.JWT_ACCESS_EXPIRES_IN),
  });
}

// ============================================================================
// setRefreshCookie - call on login/register/verify-otp/refresh
// ============================================================================
// Path: /api/v1/auth → sent ONLY on auth endpoints
// Long-lived (30 days typical)
// ============================================================================
export function setRefreshCookie(res: Response, refreshToken: string): void {
  const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

  res.cookie(CookieNames.REFRESH_TOKEN, refreshToken, {
    ...baseCookieOptions(),
    // Restrict to auth endpoints - cookie not leaked on every API call
    path: `${apiBase}/auth`,
    maxAge: parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

// ============================================================================
// setAuthCookies - convenience: set both at once
// ============================================================================
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  setAccessCookie(res, tokens.accessToken);
  setRefreshCookie(res, tokens.refreshToken);
}

// ============================================================================
// clearAccessCookie - call on logout
// ============================================================================
export function clearAccessCookie(res: Response): void {
  const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

  res.clearCookie(CookieNames.ACCESS_TOKEN, {
    ...baseCookieOptions(),
    path: apiBase,
  });
}

// ============================================================================
// clearRefreshCookie - call on logout
// ============================================================================
export function clearRefreshCookie(res: Response): void {
  const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

  res.clearCookie(CookieNames.REFRESH_TOKEN, {
    ...baseCookieOptions(),
    path: `${apiBase}/auth`,
  });
}

// ============================================================================
// clearAuthCookies - convenience: clear both at once
// ============================================================================
export function clearAuthCookies(res: Response): void {
  clearAccessCookie(res);
  clearRefreshCookie(res);
}

// ============================================================================
// getAccessTokenFromRequest - cookie OR Authorization header
// ============================================================================
// 1. Cookie (web/Postman with cookie jar)
// 2. Authorization: Bearer <token> (mobile/native/explicit clients)
// ============================================================================
export function getAccessTokenFromRequest(req: Request): string | undefined {
  // 1. Cookie
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
    CookieNames.ACCESS_TOKEN
  ];
  if (fromCookie) return fromCookie;

  // 2. Authorization header
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token.length > 0) return token;
  }

  return undefined;
}

// ============================================================================
// getRefreshTokenFromRequest - cookie OR body
// ============================================================================
export function getRefreshTokenFromRequest(req: Request): string | undefined {
  // 1. Cookie
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
    CookieNames.REFRESH_TOKEN
  ];
  if (fromCookie) return fromCookie;

  // 2. Body (mobile / API clients without cookie jar)
  const body = req.body as { refreshToken?: string } | undefined;
  return body?.refreshToken;
}

// ============================================================================
// Helper: "15m" / "30d" / "1h" → milliseconds (cookie maxAge expects ms)
// ============================================================================
function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // fallback 15 min
  const [, num, unit] = match;
  const n = parseInt(num!, 10);
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit!] ?? 60_000;
  return n * mult;
}
