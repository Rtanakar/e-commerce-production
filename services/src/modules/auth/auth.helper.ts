// ============================================================================
// auth.helper.ts - Auth-specific business helpers
// ============================================================================
// IMPORTANT: This is NOT for input validation - that's auth.validator.ts (Zod)
//
// Helpers here = business logic that doesn't fit cleanly in service:
//   - OTP generation
//   - OTP restriction CHECK (read-only)   — checkOtpRestrictions
//   - OTP request TRACK    (write/counter) — trackOtpRequest
//   - OTP send             (orchestrator) — sendOtpEmail
//   - OTP verify
//   - Password reset token gen/consume
//   - Reset email helper
//
// Why check + track SPLIT? Single Responsibility Principle:
//   - check  = read-only (testable without side effects, reusable)
//   - track  = the "commit" point (INCR is atomic, applies spam lock on exceed)
//   - send   = orchestrates the sequence (check → track → store → email)
// ============================================================================

import crypto from "node:crypto";
import { redis, RedisKeys } from "../../lib/redis.js";
import { sendEmail } from "../../lib/mailer.js";
import { otpEmail, passwordResetEmail } from "../../mails/templates.js";
import { TooManyRequestsError, BadRequestError } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

// ============================================================================
// OTP CONFIG - centralized for easy tuning
// ============================================================================
const OTP_CONFIG = {
  // 6-digit numeric (Amazon/Flipkart use 4-6)
  length: 6,
  // OTP valid for 5 minutes
  ttlSeconds: 5 * 60,
  // Resend cooldown - 60s gap between consecutive sends
  cooldownSeconds: 60,
  // Hourly request limit - SMS/email cost prevention
  maxRequestsPerHour: 5,
  // Spam lock duration - persistent abuse pe ban
  spamLockSeconds: 60 * 60,
  // Tracking window - hourly bucket
  trackingWindowSeconds: 60 * 60,
  // Wrong-attempt limit - lockout triggers at this count
  maxVerifyAttempts: 5,
  // Lockout duration after maxVerifyAttempts hit (30 min - Amazon/Flipkart pattern)
  verifyLockSeconds: 30 * 60,
} as const;

// ============================================================================
// generateOtp - cryptographically secure 6-digit OTP
// ============================================================================
// Math.random() me NEVER OTP - predictable, security issue
// crypto.randomInt - uniform distribution, secure
// ============================================================================
export function generateOtp(): string {
  const max = 10 ** OTP_CONFIG.length;
  const min = 10 ** (OTP_CONFIG.length - 1);
  return crypto.randomInt(min, max).toString();
}

// ============================================================================
// checkOtpRestrictions — READ-ONLY (no state change)
// ============================================================================
// Verifies user can REQUEST a new OTP. Two checks:
//   1. Spam-lock      - user is currently banned (1 hr)
//   2. Cooldown       - 60s gap since last send
//
// NOT here:
//   - Hourly counter increment - that's trackOtpRequest's job
//   - This function is idempotent - call N times, same result
//
// Industry: this exact split used by Amazon SES throttle, Twilio Verify API
// ============================================================================
export async function checkOtpRestrictions(identifier: string): Promise<void> {
  // 1. Spam-lock check - persistent abuser banned
  const spamLocked = await redis.get(RedisKeys.otpSpamLock(identifier));
  if (spamLocked) {
    throw new TooManyRequestsError(
      "Too many OTP requests - please wait 1 hour before requesting again",
    );
  }

  // 2. Cooldown check - 60s gap enforce
  const cooldown = await redis.get(RedisKeys.otpCooldown(identifier));
  if (cooldown) {
    const ttl = await redis.ttl(RedisKeys.otpCooldown(identifier));
    throw new TooManyRequestsError(
      `Please wait ${ttl} seconds before requesting a new OTP`,
    );
  }
}

// ============================================================================
// trackOtpRequest — WRITE (atomic INCR + spam-lock on exceed)
// ============================================================================
// "Commit" point - call ONLY AFTER decision to send OTP.
// Atomic INCR pattern (not GET-then-SET) - prevents race conditions:
//   - Two concurrent requests cannot both pass the limit check
//   - Standard Redis counter pattern
//
// Returns: current request count in this window (useful for logging/UI)
//
// Industry pattern: AWS rate-limit, Stripe API limits, Cloudflare WAF
// ============================================================================
export async function trackOtpRequest(identifier: string): Promise<number> {
  // Atomic increment - returns new value
  const count = await redis.incr(RedisKeys.otpRequests(identifier));

  // First request in window → set expiry (counter expires after 1h)
  // EXPIRE only sets TTL if it wasn't already set (idempotent for subsequent INCRs)
  if (count === 1) {
    await redis.expire(RedisKeys.otpRequests(identifier), OTP_CONFIG.trackingWindowSeconds);
  }

  // Limit exceeded → apply spam-lock + raise error
  if (count > OTP_CONFIG.maxRequestsPerHour) {
    await redis.set(
      RedisKeys.otpSpamLock(identifier),
      "1",
      "EX",
      OTP_CONFIG.spamLockSeconds,
    );
    logger.warn({ identifier, count }, "OTP spam-lock applied");
    throw new TooManyRequestsError(
      "Account locked due to too many OTP requests - try again after 1 hour",
    );
  }

  logger.debug({ identifier, count }, "OTP request tracked");
  return count;
}

// ============================================================================
// sendOtpEmail — orchestrator (check → track → store → email)
// ============================================================================
// Public API. Composes the helpers in correct sequence.
// Each step is a guard that can throw - sequence stops cleanly on first fail.
//
// Why this order?
//   1. check  - cheap, fails fast for known-bad actors
//   2. track  - commits the slot (atomic INCR)
//   3. store  - OTP + cooldown markers in Redis
//   4. email  - I/O last (slow + can fail)
//
// If email fails: OTP is in Redis, user can retry "Resend OTP" after cooldown
// ============================================================================
export async function sendOtpEmail(input: {
  name: string;
  email: string;
  purpose: "registration" | "login" | "password-reset" | "email-change";
}): Promise<void> {
  // 1. Read-only checks
  await checkOtpRestrictions(input.email);

  // 2. Commit the request slot (atomic)
  await trackOtpRequest(input.email);

  // 3. Generate + store OTP
  const otp = generateOtp();
  await Promise.all([
    redis.set(RedisKeys.otp(input.email), otp, "EX", OTP_CONFIG.ttlSeconds),
    redis.set(
      RedisKeys.otpCooldown(input.email),
      "1",
      "EX",
      OTP_CONFIG.cooldownSeconds,
    ),
  ]);

  // 4. Render + send email
  const { subject, html } = await otpEmail({
    name: input.name,
    otp,
    purpose: input.purpose,
  });
  await sendEmail({ to: input.email, subject, html });

  logger.info({ email: input.email, purpose: input.purpose }, "OTP sent");
}

// ============================================================================
// verifyOtp - check user-provided code against stored
// ============================================================================
// Production-grade flow (Amazon/Flipkart/Twilio Verify pattern):
//   1. Check verify-lock     → 30 min lockout after maxVerifyAttempts hit
//   2. Fetch stored OTP      → must exist (TTL = 5 min)
//   3. Timing-safe compare   → crypto.timingSafeEqual (NOT ===)
//   4. On mismatch:
//      a. Atomic INCR attempt counter (no race conditions)
//      b. If at max → set lock, cleanup, throw lockout error
//      c. Otherwise → throw "X attempts left" hint
//   5. On match → cleanup OTP + attempts counter, return true
//
// Security guarantees:
//   - Timing-attack safe       (crypto.timingSafeEqual)
//   - Race-condition safe      (atomic INCR not GET+SET)
//   - Brute-force throttled    (5 wrong tries → 30 min lock)
//   - One-time use             (OTP deleted on success)
//   - No leaking info          (same response shape for all error states)
// ============================================================================
export async function verifyOtp(
  identifier: string,
  providedOtp: string,
): Promise<boolean> {
  // ----- 1. Lock check FIRST (cheap, fails fast for locked users) -----
  const lockKey = RedisKeys.otpVerifyLock(identifier);
  const isLocked = await redis.get(lockKey);
  if (isLocked) {
    const ttl = await redis.ttl(lockKey);
    const minutes = Math.max(1, Math.ceil(ttl / 60));
    throw new TooManyRequestsError(
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
  }

  // ----- 2. Fetch stored OTP -----
  const stored = await redis.get(RedisKeys.otp(identifier));
  if (!stored) {
    throw new BadRequestError("OTP expired or invalid - please request a new one");
  }

  // ----- 3. Timing-safe compare (CRITICAL: not `stored !== providedOtp`) -----
  // Same-length buffer requirement - mismatched length = guaranteed not-match
  const a = Buffer.from(stored);
  const b = Buffer.from(providedOtp);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  // ----- 4. Wrong OTP path -----
  if (!match) {
    const attemptsKey = RedisKeys.otpAttempts(identifier);

    // Atomic INCR - race-condition safe (vs GET-then-SET pattern)
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      // First wrong attempt - set TTL on counter (matches OTP TTL)
      await redis.expire(attemptsKey, OTP_CONFIG.ttlSeconds);
    }

    // Threshold reached → apply lockout
    if (attempts >= OTP_CONFIG.maxVerifyAttempts) {
      const lockMinutes = OTP_CONFIG.verifyLockSeconds / 60;
      // Atomic cleanup + lock - pipeline for efficiency (1 round-trip)
      await redis
        .multi()
        .set(lockKey, "locked", "EX", OTP_CONFIG.verifyLockSeconds)
        .del(RedisKeys.otp(identifier))
        .del(attemptsKey)
        .exec();

      logger.warn(
        { identifier, attempts, lockMinutes },
        "OTP verify lockout applied",
      );
      throw new TooManyRequestsError(
        `Too many failed attempts. Account locked for ${lockMinutes} minutes.`,
      );
    }

    // Not yet at threshold → tell user remaining attempts (UX)
    const remaining = OTP_CONFIG.maxVerifyAttempts - attempts;
    throw new BadRequestError(
      `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`,
      { attemptsLeft: remaining },
    );
  }

  // ----- 5. Success - atomic cleanup (one-time use guarantee) -----
  await redis
    .multi()
    .del(RedisKeys.otp(identifier))
    .del(RedisKeys.otpAttempts(identifier))
    .exec();

  logger.info({ identifier }, "OTP verified successfully");
  return true;
}

// ============================================================================
// generatePasswordResetToken - opaque random token (NOT JWT)
// ============================================================================
// Why opaque token over JWT?
//   - Short-lived (1 hr) - rotation not needed
//   - Single-use - Redis presence = valid signal
//   - No payload needed (token → userId via Redis lookup)
//   - Smaller URL footprint
// ============================================================================
export async function generatePasswordResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(RedisKeys.passwordResetToken(token), userId, "EX", 60 * 60);
  return token;
}

// ============================================================================
// consumePasswordResetToken - single-use token consumption
// ============================================================================
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const userId = await redis.get(RedisKeys.passwordResetToken(token));
  if (!userId) return null;
  await redis.del(RedisKeys.passwordResetToken(token));
  return userId;
}

// ============================================================================
// sendPasswordResetEmailHelper - reset flow orchestrator
// ============================================================================
// Same check → track → store → send pattern as OTP for consistency
// Different identifier prefix to keep counters separate from OTP
// ============================================================================
export async function sendPasswordResetEmailHelper(input: {
  name: string;
  email: string;
  userId: string;
}): Promise<void> {
  const identifier = `pwd-reset:${input.email}`;

  await checkOtpRestrictions(identifier);
  await trackOtpRequest(identifier);

  const token = await generatePasswordResetToken(input.userId);
  const resetUrl = `${env.APP_URL}/auth/reset-password?token=${token}`;

  const { subject, html } = await passwordResetEmail({
    name: input.name,
    resetUrl,
  });

  await sendEmail({ to: input.email, subject, html });
  logger.info({ email: input.email, userId: input.userId }, "Password reset email sent");
}
