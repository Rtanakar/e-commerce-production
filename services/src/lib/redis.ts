// ============================================================================
// redis.ts - Upstash Redis singleton + rate limiter factory
// ============================================================================
// Upstash = serverless Redis over HTTP/REST
// - Works in Vercel/Lambda (no persistent TCP)
// - Pay per request - idle me cost nahi
// - Local dev: hiett/serverless-redis-http container
// ============================================================================

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "../config/env.js";

// ============================================================================
// Singleton Redis client
// ============================================================================
class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
        // Auto-retry on transient network errors
        retry: {
          retries: 3,
          backoff: (retryCount) => Math.min(1000 * 2 ** retryCount, 5000),
        },
      });
    }
    return this.instance;
  }
}

export const redis = RedisClient.getInstance();

// ============================================================================
// Key namespacing - global Redis se collision avoid
// ============================================================================
// jab multiple apps same Redis share kare to prefix se separation
// Production me: `prod:ecommerce:session:...`
// Dev: `dev:ecommerce:session:...`
export const RedisKeys = {
  // Auth
  session: (userId: string, sid: string) => `session:${userId}:${sid}`,
  userSessions: (userId: string) => `user:sessions:${userId}`,
  passwordResetToken: (token: string) => `pwd-reset:${token}`,
  emailVerifyToken: (token: string) => `email-verify:${token}`,
  // OTP
  otp: (phone: string) => `otp:${phone}`,
  otpAttempts: (phone: string) => `otp-attempts:${phone}`,
  // Rate limit (Upstash @upstash/ratelimit khud manage karta hai)
  // Generic cache
  cache: (key: string) => `cache:${key}`,
} as const;

// ============================================================================
// Rate limiter factory - per route different limits ban sakte hai
// ============================================================================
// Sliding window algorithm - burst se better, smooth distribution
// Analytics on: Upstash dashboard pe usage dikhega
export function createRateLimiter(opts: {
  requests: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  prefix: string;
}): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.requests, opts.window),
    analytics: true,
    prefix: opts.prefix,
  });
}

// Pre-configured limiters - common use cases
export const RateLimiters = {
  // Global - har IP/user ke liye baseline
  global: createRateLimiter({ requests: 100, window: "1 m", prefix: "rl:global" }),
  // Auth (login/register) - brute force prevent
  auth: createRateLimiter({ requests: 10, window: "15 m", prefix: "rl:auth" }),
  // OTP send - SMS cost expensive
  otp: createRateLimiter({ requests: 3, window: "1 h", prefix: "rl:otp" }),
  // Password reset - email spam prevent
  passwordReset: createRateLimiter({ requests: 3, window: "1 h", prefix: "rl:pwd-reset" }),
};
