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
import { verifyAccessToken } from "../lib/tokens.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { getAccessTokenFromRequest } from "../utils/cookies.js";
import type { JwtPayload, UserRoleType } from "../modules/auth/auth.validator.js";

// ============================================================================
// requireAuth - strict: token required (cookie or header)
// ============================================================================
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = getAccessTokenFromRequest(req);
  if (!token) {
    return next(new UnauthorizedError("Authorization token required"));
  }
  try {
    req.user = verifyAccessToken(token);
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
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = getAccessTokenFromRequest(req);
  if (!token) return next();
  try {
    req.user = verifyAccessToken(token);
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
