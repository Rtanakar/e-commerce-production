// ============================================================================
// require-auth.ts - JWT auth middlewares
// ============================================================================
// Express middleware are functions - class wrapper is unnecessary indirection
// Industry convention: named function exports
//
// Token sources (FAANG dual pattern):
//   1. httpOnly cookie "at"           (web/Postman with cookie jar - default)
//   2. Authorization: Bearer <token>  (mobile/native/curl explicit)
//
// Usage:
//   router.get("/me", requireAuth, controller.me)
//   router.get("/feed", optionalAuth, controller.feed)
//   router.delete("/users/:id", requireAuth, requireRole("ADMIN"), controller.delete)
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, isAccessJtiRevoked } from "../lib/tokens.js";
import { UnauthorizedError, ForbiddenError, SessionRevokedError } from "../utils/errors.js";
import { getAccessTokenFromRequest } from "../utils/cookies.js";
import type { JwtPayload, UserRoleType } from "../modules/auth/auth.validator.js";

// ============================================================================
// requireAuth - strict: token required (cookie or header)
// ============================================================================
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return next(new UnauthorizedError("Authorization token required"));
  }
  try {
    const payload = verifyAccessToken(token);
    // Revocation check - logout / password-change / theft response
    // adds jti to Redis blacklist. O(1) lookup, ~1ms overhead.
    if (await isAccessJtiRevoked(payload.jti)) {
      return next(new SessionRevokedError("Session was revoked"));
    }
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// requireSellerAuth - strict: SELLER scope token required (s_at cookie or Bearer)
// ============================================================================
// Reads from the seller cookie jar (s_at) instead of customer (at). Used by
// /api/v1/auth/seller/* + /api/v1/vendors/* routes. Asserts role=VENDOR so a
// CUSTOMER who somehow has a seller cookie (shouldn't happen) is still blocked.
// Also tags req.authScope so downstream helpers emit the right cookie names.
// ============================================================================
export async function requireSellerAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getAccessTokenFromRequest(req, "seller");
  if (!token) {
    return next(new UnauthorizedError("Seller authorization required"));
  }
  try {
    // Verify with seller secret (JWT_SELLER_ACCESS_SECRET) - a customer
    // access token presented here will fail signature check.
    const payload = verifyAccessToken(token, "seller");
    if (await isAccessJtiRevoked(payload.jti)) {
      return next(new SessionRevokedError("Seller session was revoked"));
    }
    if (payload.role !== "VENDOR") {
      // Seller cookies should only carry VENDOR tokens. Defense in depth.
      return next(new ForbiddenError("Seller portal requires a vendor account"));
    }
    req.user = payload;
    req.authScope = "seller";
    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// requireAnyAuth - accept EITHER cookie jar (seller preferred, customer fallback)
// ============================================================================
// For endpoints like /vendors/onboarding-status that are called from both
// pre-upgrade (customer cookies only) AND post-register (seller cookies only)
// flows. Tries seller scope first — if a seller token is present and valid,
// it's the more authoritative answer for vendor questions. Falls back to
// customer scope otherwise.
//
// Tags req.authScope so downstream cookie helpers know which jar to update.
// ============================================================================
export async function requireAnyAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // ── Try seller scope first (verify with seller secret) ──
  const sellerToken = getAccessTokenFromRequest(req, "seller");
  if (sellerToken) {
    try {
      const payload = verifyAccessToken(sellerToken, "seller");
      if (!(await isAccessJtiRevoked(payload.jti))) {
        req.user = payload;
        req.authScope = "seller";
        return next();
      }
    } catch {
      /* fall through to customer */
    }
  }

  // ── Fallback to customer scope (verify with customer secret) ──
  const customerToken = getAccessTokenFromRequest(req, "customer");
  if (!customerToken) {
    return next(new UnauthorizedError("Authorization token required"));
  }
  try {
    const payload = verifyAccessToken(customerToken, "customer");
    if (await isAccessJtiRevoked(payload.jti)) {
      return next(new SessionRevokedError("Session was revoked"));
    }
    req.user = payload;
    req.authScope = "customer";
    next();
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// optionalAuth - token if present, otherwise continue
// ============================================================================
// Public routes with personalized content - feed, homepage etc.
// ============================================================================
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getAccessTokenFromRequest(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    if (!(await isAccessJtiRevoked(payload.jti))) {
      req.user = payload;
    }
  } catch {
    // Invalid token silently ignored - it's optional
  }
  next();
}

// ============================================================================
// requireRole - RBAC
// ============================================================================
// Use AFTER requireAuth (req.user populated chahiye)
// requireRole("ADMIN", "VENDOR") - multiple roles allowed
// ============================================================================
export function requireRole(...allowed: UserRoleType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowed.includes(req.user.role)) {
      return next(new ForbiddenError(`This action requires ${allowed.join(" or ")} role`));
    }
    next();
  };
}

// ============================================================================
// requireOwnership - resource owner OR admin
// ============================================================================
export function requireOwnership(getResourceUserId: (req: Request) => string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new UnauthorizedError());
    if (req.user.role === "ADMIN") return next();
    const resourceUserId = getResourceUserId(req);
    if (req.user.sub !== resourceUserId) {
      return next(new ForbiddenError("You do not own this resource"));
    }
    next();
  };
}

export type { JwtPayload };
