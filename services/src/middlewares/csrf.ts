// ============================================================================
// csrf.ts - CSRF protection (hybrid: double-submit cookie + signed header)
// ============================================================================
// Two valid attack-resistant modes (request passes if EITHER is satisfied):
//
//   MODE 1 - Double-submit (classic): csrf cookie value === X-CSRF-Token header
//     - Browser sends cookie automatically
//     - Frontend JS reads cookie + echoes in header
//     - CSRF attacker can't read cookie cross-origin → can't set header → fail
//
//   MODE 2 - Signed header (Stripe/GitHub Dashboard):
//     - Backend pushed CSRF token to frontend via X-CSRF-Token response header
//     - Frontend stores it in memory + echoes on mutating requests
//     - Token is HMAC(secret, sid + nonce) - we re-verify against the sid in
//       the access cookie. Attacker can't forge without secret AND sid.
//
// Why hybrid? document.cookie has path-scoping & cross-origin quirks. The
// header-based mode is more reliable. Cookie mode kept for legacy/SSR clients.
//
// When enforced:
//   - Mutating methods only (POST/PUT/PATCH/DELETE)
//   - ONLY when request is cookie-authenticated (presence of `at` or `rt`)
//   - Bearer-token requests skip entirely
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../utils/errors.js";
import {
  CookieNames,
  getCsrfTokenFromCookie,
  getCsrfTokenFromHeader,
  verifyCsrfToken,
} from "../utils/cookies.js";
import { verifyAccessToken, verifyRefreshToken } from "../lib/tokens.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ============================================================================
// requireCsrf - enforce CSRF check on mutating cookie-auth requests
// ============================================================================
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  // 1) Safe methods - no CSRF needed
  if (SAFE_METHODS.has(req.method)) return next();

  // 2) Detect cookie-based auth - if neither at nor rt cookie present, skip
  const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
  const hasAuthCookie = !!cookies[CookieNames.ACCESS_TOKEN] || !!cookies[CookieNames.REFRESH_TOKEN];
  if (!hasAuthCookie) return next();

  // 3) Header MUST be present (memory-stored OR cookie-echoed)
  const headerToken = getCsrfTokenFromHeader(req);
  if (!headerToken) {
    return next(new ForbiddenError("CSRF token missing"));
  }

  // 4) Extract sid from access OR refresh cookie - HMAC verification needs it
  const sid = extractSidForCsrf(req);

  // 5) MODE 2 (preferred) - signed header re-verifies against sid
  if (sid && verifyCsrfToken(headerToken, sid)) {
    return next();
  }

  // 6) MODE 1 (fallback) - classic double-submit cookie ↔ header equality
  const cookieToken = getCsrfTokenFromCookie(req);
  if (cookieToken && cookieToken === headerToken) {
    // Cookie present → must also HMAC-verify if we have sid (defense)
    if (sid && !verifyCsrfToken(cookieToken, sid)) {
      return next(new ForbiddenError("CSRF token signature invalid"));
    }
    return next();
  }

  return next(new ForbiddenError("CSRF token mismatch"));
}

// ============================================================================
// extractSidForCsrf - best-effort sid from access or refresh cookie
// ============================================================================
// Try access cookie first (cheaper - no DB call), fall back to refresh cookie
// for endpoints like /refresh where access token may have expired.
// ============================================================================
function extractSidForCsrf(req: Request): string | undefined {
  const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
  const at = cookies[CookieNames.ACCESS_TOKEN];
  if (at) {
    try {
      return verifyAccessToken(at).sid;
    } catch {
      /* expired/invalid - try refresh next */
    }
  }
  const rt = cookies[CookieNames.REFRESH_TOKEN];
  if (rt) {
    try {
      return verifyRefreshToken(rt).sid;
    } catch {
      /* both invalid - return undefined; cookie==header fallback handles */
    }
  }
  return undefined;
}
