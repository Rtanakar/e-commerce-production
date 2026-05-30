// ============================================================================
// csrf.ts - CSRF protection (hybrid: double-submit cookie + signed header)
// ============================================================================
// Two valid attack-resistant modes (request passes if EITHER is satisfied):
//
//   MODE 1 - Double-submit (classic): csrf cookie value === X-CSRF-Token header
//   MODE 2 - Signed header (Stripe/GitHub): HMAC(secret, sid + nonce)
//
// Scope-aware: seller routes use s_at/s_rt/s_csrf cookies, customer uses at/rt/csrf.
// Factory `requireCsrfForScope(scope)` returns the right middleware for each.
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors.js";
import {
  cookieNamesForScope,
  getCsrfTokenFromCookie,
  getCsrfTokenFromHeader,
  verifyCsrfToken,
  type AuthScope,
} from "../utils/cookies.js";
import { verifyAccessToken, verifyRefreshToken } from "../lib/tokens.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ============================================================================
// Factory - returns CSRF middleware bound to a cookie scope
// ============================================================================
function makeCsrfMiddleware(scope: AuthScope) {
  const names = cookieNamesForScope(scope);

  return function csrfMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    // 1) Safe methods - no CSRF needed
    if (SAFE_METHODS.has(req.method)) return next();

    // 2) Detect cookie-based auth FOR THIS SCOPE - skip if no scope cookie present
    //    (Bearer-token requests have no cookie and skip CSRF entirely; customer
    //    requests hitting seller routes also skip - they'll fail at requireAuth.)
    const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
    const hasAuthCookie =
      !!cookies[names.ACCESS_TOKEN] || !!cookies[names.REFRESH_TOKEN];
    if (!hasAuthCookie) return next();

    // 3) Header MUST be present (memory-stored OR cookie-echoed)
    const headerToken = getCsrfTokenFromHeader(req);
    if (!headerToken) {
      return next(new ForbiddenError("CSRF token missing"));
    }

    // 4) Extract sid from access OR refresh cookie - HMAC verification needs it
    const sid = extractSidForCsrf(req, scope);

    // 5) MODE 2 (preferred) - signed header re-verifies against sid
    //    Verification uses scope's CSRF secret - seller tokens fail under
    //    customer key check.
    if (sid && verifyCsrfToken(headerToken, sid, scope)) {
      return next();
    }

    // 6) MODE 1 (fallback) - classic double-submit cookie ↔ header equality
    const cookieToken = getCsrfTokenFromCookie(req, scope);
    if (cookieToken && cookieToken === headerToken) {
      // Cookie present → must also HMAC-verify if we have sid (defense)
      if (sid && !verifyCsrfToken(cookieToken, sid, scope)) {
        return next(new ForbiddenError("CSRF token signature invalid"));
      }
      return next();
    }

    return next(new ForbiddenError("CSRF token mismatch"));
  };
}

// ============================================================================
// requireCsrf - default (customer scope) - existing routes unchanged
// ============================================================================
export const requireCsrf = makeCsrfMiddleware("customer");

// ============================================================================
// requireSellerCsrf - for /auth/seller/* + /vendors/* routes
// ============================================================================
export const requireSellerCsrf = makeCsrfMiddleware("seller");

// ============================================================================
// extractSidForCsrf - best-effort sid from access or refresh cookie (scoped)
// ============================================================================
function extractSidForCsrf(
  req: Request,
  scope: AuthScope,
): string | undefined {
  const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
  const names = cookieNamesForScope(scope);
  const at = cookies[names.ACCESS_TOKEN];
  if (at) {
    try {
      // Use scope's JWT secret - seller tokens won't verify with customer key
      return verifyAccessToken(at, scope).sid;
    } catch {
      /* expired/invalid - try refresh next */
    }
  }
  const rt = cookies[names.REFRESH_TOKEN];
  if (rt) {
    try {
      return verifyRefreshToken(rt, scope).sid;
    } catch {
      /* both invalid - return undefined; cookie==header fallback handles */
    }
  }
  return undefined;
}
