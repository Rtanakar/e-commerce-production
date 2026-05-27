// ============================================================================
// rate-limit.ts - Distributed rate limiter (express-rate-limit + Redis)
// ============================================================================
// Industry standard for long-running Node servers:
//   - express-rate-limit (middleware)
//   - rate-limit-redis (distributed store, works with ioredis)
//
// Why distributed?
//   Memory store production-broken - har instance ka apna counter
//   2 instances + 100 req/min limit → user 200 req/min effectively
//   Redis store - sab instances share karte hai counter
//
// Two-layer defense pattern:
//   1. CDN/Cloudflare WAF - L4/L7 DDoS (millions of RPS)
//   2. This middleware    - L7 application logic (per-user, per-endpoint)
// ============================================================================

import rateLimit, { type Options } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import type { Request } from "express";
import { redis } from "../lib/redis.js";
import { env } from "../config/env.js";
import { ApiResponseBuilder } from "../interfaces/api-response.js";
import { ErrorCode } from "../utils/http-status.js";

// ============================================================================
// Redis store factory - prefix se different limiters isolated
// ============================================================================
function makeStore(prefix: string): RedisStore {
  return new RedisStore({
    // ioredis se compatible call - sendCommand takes args array
    sendCommand: (...args: string[]) => redis.call(...args) as Promise<RedisReply>,
    prefix: `rl:${prefix}:`,
  });
}

// ============================================================================
// Key extractor - userId (logged-in) ya IP (anonymous)
// ============================================================================
// Shared IP (offices, NAT) users galat block na ho - userId preferred
function keyGenerator(req: Request): string {
  return req.user?.sub ?? req.ip ?? "anonymous";
}

// ============================================================================
// Common config - extracted for DRY
// ============================================================================
function baseConfig(prefix: string, max: number, windowMs: number): Partial<Options> {
  return {
    windowMs,
    max,
    standardHeaders: "draft-7", // RateLimit-* headers (RFC draft)
    legacyHeaders: false, // X-RateLimit-* (deprecated)
    keyGenerator,
    store: makeStore(prefix),
    // Fail-OPEN on Redis outage - availability > strict limiting
    // (For finance/auth, consider fail-CLOSED - uncomment skipFailedRequests logic)
    skip: () => false,
    handler: (req, res, _next, options) => {
      res.status(options.statusCode).json({
        ...ApiResponseBuilder.error(
          ErrorCode.RATE_LIMITED,
          "Too many requests, please try again later",
        ),
        requestId: req.id,
      });
    },
  };
}

// ============================================================================
// Pre-configured limiters
// ============================================================================

// Global - baseline DoS protection on every request
export const globalRateLimit = rateLimit(
  baseConfig("global", env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_MS),
);

// Auth (login/register) - brute force prevention
export const authRateLimit = rateLimit(baseConfig("auth", 10, 15 * 60 * 1000));

// OTP send - SMS cost expensive
export const otpRateLimit = rateLimit(baseConfig("otp", 3, 60 * 60 * 1000));

// Password reset - email spam prevention
export const passwordResetRateLimit = rateLimit(baseConfig("pwd-reset", 3, 60 * 60 * 1000));
