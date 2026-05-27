// ============================================================================
// tokens.ts - JWT + Redis session management (function-based)
// ============================================================================
// Hybrid auth: JWT stateless speed + Redis stateful revocation
//
//   Access token  (15m):  short-lived, no DB lookup, fast verify
//   Refresh token (30d):  long-lived, Redis-stored, revocable
//
// Token rotation on refresh - OWASP recommended:
//   purana refresh use hone pe naya pair issue, purana invalidate
//   agar purana dobara use ho → theft indicator → all sessions kill
// ============================================================================

import jwt, { type SignOptions, type JwtPayload as RawJwt } from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { redis, RedisKeys } from "./redis.js";
import { InvalidTokenError, SessionRevokedError } from "../utils/errors.js";
import { jwtPayloadSchema, type JwtPayload } from "../modules/auth/auth.validator.js";
import { logger } from "../utils/logger.js";

// ============================================================================
// Constants - JWT standard claims
// ============================================================================
const ISSUER = "ecommerce-auth";
const ACCESS_AUDIENCE = "ecommerce-api";
const REFRESH_AUDIENCE = "ecommerce-refresh";

// ============================================================================
// Sign tokens (internal)
// ============================================================================
function signAccess(payload: JwtPayload): string {
  const opts: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opts);
}

function signRefresh(payload: JwtPayload): string {
  const opts: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience: REFRESH_AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, opts);
}

// ============================================================================
// Verify tokens (public)
// ============================================================================
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    }) as RawJwt;
    return jwtPayloadSchema.parse(decoded);
  } catch (err) {
    throw new InvalidTokenError(
      err instanceof jwt.TokenExpiredError ? "Access token has expired" : "Invalid access token",
    );
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    }) as RawJwt;
    return jwtPayloadSchema.parse(decoded);
  } catch (err) {
    throw new InvalidTokenError(
      err instanceof jwt.TokenExpiredError
        ? "Refresh token has expired, please log in again"
        : "Invalid refresh token",
    );
  }
}

// ============================================================================
// createSession - login/register pe naya session
// ============================================================================
// Returns: { accessToken, refreshToken, sid }
// Side effect: Redis me refresh token store (revocation enabled)
// ============================================================================
export async function createSession(user: {
  id: string;
  email: string;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
}): Promise<{ accessToken: string; refreshToken: string; sid: string }> {
  // sid - cryptographically random session ID
  // 16 bytes = 128 bits = 32 hex chars - collision practically impossible
  const sid = crypto.randomBytes(16).toString("hex");

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    sid,
  };

  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  // Redis pe refresh token store - revocation ke liye
  // ioredis API: redis.set(key, value, "EX", ttl) - SET with EXpiry seconds
  const ttl = parseExpiryToSeconds(env.JWT_REFRESH_EXPIRES_IN);
  await Promise.all([
    redis.set(RedisKeys.session(user.id, sid), refreshToken, "EX", ttl),
    redis.sadd(RedisKeys.userSessions(user.id), sid),
    redis.expire(RedisKeys.userSessions(user.id), ttl),
  ]);

  logger.info({ userId: user.id, sid }, "Session created");
  return { accessToken, refreshToken, sid };
}

// ============================================================================
// isSessionValid - refresh endpoint me check
// ============================================================================
export async function isSessionValid(
  userId: string,
  sid: string,
  refreshToken: string,
): Promise<boolean> {
  // ioredis get returns string | null (no generic type param like Upstash)
  const stored = await redis.get(RedisKeys.session(userId, sid));
  return stored === refreshToken;
}

// ============================================================================
// rotateSession - refresh flow ka rotation step
// ============================================================================
// Purana revoke karo, naya issue karo
// OWASP token rotation pattern
// ============================================================================
export async function rotateSession(
  user: { id: string; email: string; role: "CUSTOMER" | "VENDOR" | "ADMIN" },
  oldSid: string,
): Promise<{ accessToken: string; refreshToken: string; sid: string }> {
  await revokeSession(user.id, oldSid);
  return createSession(user);
}

// ============================================================================
// revokeSession - logout (single device)
// ============================================================================
export async function revokeSession(userId: string, sid: string): Promise<void> {
  await Promise.all([
    redis.del(RedisKeys.session(userId, sid)),
    redis.srem(RedisKeys.userSessions(userId), sid),
  ]);
  logger.info({ userId, sid }, "Session revoked");
}

// ============================================================================
// revokeAllSessions - "Sign out from all devices"
// ============================================================================
// Theft detected pe bhi ye call hota hai (aggressive defense)
// ============================================================================
export async function revokeAllSessions(userId: string): Promise<void> {
  const sids = (await redis.smembers(RedisKeys.userSessions(userId))) as string[];
  if (sids.length === 0) return;

  await Promise.all([
    ...sids.map((sid) => redis.del(RedisKeys.session(userId, sid))),
    redis.del(RedisKeys.userSessions(userId)),
  ]);
  logger.warn({ userId, count: sids.length }, "All sessions revoked");
}

// ============================================================================
// handleSuspiciousRefresh - refresh token reuse detected
// ============================================================================
// OWASP recommendation: reuse → assume theft → kill ALL sessions
// Attacker aur user dono ko logout, user ko dobara login karna padega
// ============================================================================
export async function handleSuspiciousRefresh(userId: string): Promise<never> {
  logger.error({ userId }, "Suspicious refresh - revoking all sessions");
  await revokeAllSessions(userId);
  throw new SessionRevokedError("Suspicious activity detected - all sessions revoked");
}

// ============================================================================
// Internal: "15m" / "30d" / "1h" → seconds (Redis TTL)
// ============================================================================
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // fallback 15 min
  const [, num, unit] = match;
  const n = parseInt(num!, 10);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit!] ?? 60;
  return n * mult;
}
