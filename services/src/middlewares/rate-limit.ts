// ============================================================================
// rate-limit.ts - Upstash Redis backed distributed rate limiter
// ============================================================================
// Distributed - multiple instances share counters via Redis
// Memory store production-broken (har instance ka apna counter, total limit blown)
//
// Two-layer defense:
//   1. CDN/Cloudflare WAF - L4/L7 DDoS (millions of RPS)
//   2. This middleware - L7 application logic (per-user, per-endpoint)
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import type { Ratelimit } from "@upstash/ratelimit";
import { RateLimiters } from "../lib/redis.js";
import { TooManyRequestsError } from "../utils/errors.js";

// Key extractor - user ho to userId, na ho to IP
// Shared IP (offices, NAT) users galat block na ho - userId preferred
function getRateLimitKey(req: Request): string {
  return req.user?.sub ?? req.ip ?? "anonymous";
}

// ============================================================================
// Generic rate limiter middleware factory
// ============================================================================
export function rateLimit(limiter: Ratelimit) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { success, limit, remaining, reset } = await limiter.limit(getRateLimitKey(req));

      // Standard rate-limit response headers (RFC draft)
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil(reset / 1000));

      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader("Retry-After", retryAfter);
        return next(new TooManyRequestsError());
      }
      next();
    } catch (err) {
      // Fail-OPEN: Redis down → service available rahe
      // Tradeoff: availability > strict limiting (most apps prefer this)
      // Finance/auth-critical: fail-CLOSED preferred (uncomment to switch)
      req.log?.warn({ err }, "Rate limit check failed - allowing request (fail-open)");
      next();
      // To fail-closed instead:
      // return next(new ServiceUnavailableError());
    }
  };
}

// ============================================================================
// Pre-configured limiters - common patterns
// ============================================================================
// Global       : every request - baseline DoS protection
// Auth         : login/register - brute force prevention
// OTP          : SMS cost expensive - tight limit
// PasswordReset: email spam prevention
// ============================================================================
export const globalRateLimit = rateLimit(RateLimiters.global);
export const authRateLimit = rateLimit(RateLimiters.auth);
export const otpRateLimit = rateLimit(RateLimiters.otp);
export const passwordResetRateLimit = rateLimit(RateLimiters.passwordReset);
