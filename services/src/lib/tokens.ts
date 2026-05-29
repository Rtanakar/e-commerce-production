// ============================================================================
// tokens.ts - JWT + Redis session management (production-grade)
// ============================================================================
// Hybrid auth: JWT stateless speed + Redis stateful revocation
//
//   Access token  (15m):  short-lived, JTI present, blacklist-checked
//   Refresh token (7d):   long-lived, stored as SHA-256 HASH in Redis
//                         (DB leak = attacker still can't reconstruct token)
//
// Session record = Redis HASH:
//   tokenHash      SHA-256 of current refresh token (not the raw token!)
//   fingerprint    device fingerprint at session create time
//   ip             initial IP (audit/forensics, NOT compared on refresh)
//   ua             initial User-Agent (audit)
//   createdAt      session created (epoch ms)
//   lastUsedAt     last refresh time (epoch ms)
//   rotations      count of rotations (anomaly metric)
//
// Token rotation on refresh - OWASP recommended:
//   - Old refresh used → new pair issued, old hash overwritten in Redis
//   - Old refresh marked "used" with short TTL (replay window)
//   - Old refresh used AGAIN → THEFT → kill ALL sessions
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

// Window during which a just-rotated refresh token, if presented, is treated
// as theft. Short enough to not flag legit retries, long enough to catch reuse.
const REPLAY_WINDOW_SECONDS = 60;

// ============================================================================
// Types
// ============================================================================
export interface SessionContext {
  /** Device fingerprint hash (cookies.ts computeDeviceFingerprint) */
  fingerprint?: string;
  /** IP at session create - audit only */
  ip?: string | null;
  /** User-Agent at session create - audit only */
  ua?: string | null;
}

// ============================================================================
// Internal helpers
// ============================================================================
function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function newSid(): string {
  // 16 bytes = 128 bits = 32 hex chars - collision practically impossible
  return crypto.randomBytes(16).toString("hex");
}

function newJti(): string {
  // 12 bytes = 96 bits - plenty for unique JTI per access token
  return crypto.randomBytes(12).toString("hex");
}

// ============================================================================
// Sign tokens (internal)
// ============================================================================
// Access token carries `jti` for revocation list lookup.
// Refresh token carries only `sid` - rotation lookup happens by sid.
// ============================================================================
function signAccess(payload: JwtPayload & { jti: string }): string {
  const { jti, ...rest } = payload;
  const opts: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
    jwtid: jti,
  };
  return jwt.sign(rest, env.JWT_ACCESS_SECRET, opts);
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
// isAccessJtiRevoked - O(1) Redis lookup
// ============================================================================
// Used by requireAuth middleware. Absence = valid.
// Set populated by logout / logout-all / password-change / session-revoke.
// ============================================================================
export async function isAccessJtiRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false; // legacy tokens without jti - tolerate
  const flag = await redis.get(RedisKeys.accessJtiRevoked(jti));
  return flag !== null;
}

// ============================================================================
// createSession - login / register / oauth callback pe naya session
// ============================================================================
export async function createSession(
  user: { id: string; email: string; role: "CUSTOMER" | "VENDOR" | "ADMIN" },
  ctx: SessionContext = {},
): Promise<{ accessToken: string; refreshToken: string; sid: string }> {
  const sid = newSid();
  const jti = newJti();
  const now = Date.now();

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    sid,
  };

  const accessToken = signAccess({ ...payload, jti });
  const refreshToken = signRefresh(payload);
  const refreshHash = sha256(refreshToken);

  const ttl = parseExpiryToSeconds(env.JWT_REFRESH_EXPIRES_IN);

  // Session HASH - metadata for forensics + binding + future analytics
  // Industry: Netflix/Stripe store session-level metadata for fraud detection
  await Promise.all([
    redis.hset(RedisKeys.session(user.id, sid), {
      tokenHash: refreshHash,
      jti,
      fingerprint: ctx.fingerprint ?? "",
      ip: ctx.ip ?? "",
      ua: ctx.ua ?? "",
      createdAt: now.toString(),
      lastUsedAt: now.toString(),
      rotations: "0",
    }),
    redis.expire(RedisKeys.session(user.id, sid), ttl),
    redis.sadd(RedisKeys.userSessions(user.id), sid),
    redis.expire(RedisKeys.userSessions(user.id), ttl),
  ]);

  logger.info({ userId: user.id, sid, jti }, "Session created");
  return { accessToken, refreshToken, sid };
}

// ============================================================================
// getSessionMeta - HGETALL wrapper (typed)
// ============================================================================
export interface SessionMeta {
  tokenHash: string;
  jti: string;
  fingerprint: string;
  ip: string;
  ua: string;
  createdAt: string;
  lastUsedAt: string;
  rotations: string;
}

async function getSessionMeta(userId: string, sid: string): Promise<SessionMeta | null> {
  const meta = await redis.hgetall(RedisKeys.session(userId, sid));
  if (!meta || Object.keys(meta).length === 0) return null;
  return meta as unknown as SessionMeta;
}

// ============================================================================
// validateRefreshSession - replaces old isSessionValid
// ============================================================================
// Returns the session meta on success (caller uses for rotation).
// Throws on:
//   - session not found / revoked
//   - hash mismatch (token was rotated → maybe reuse)
//   - reuse of previously-rotated token (in replay window) → THEFT
//   - device-binding mismatch when AUTH_STRICT_DEVICE_BINDING=true
// ============================================================================
export async function validateRefreshSession(
  userId: string,
  sid: string,
  refreshToken: string,
  ctx: SessionContext = {},
): Promise<SessionMeta> {
  // 1) Was this exact refresh token already rotated? (replay detection)
  const incomingHash = sha256(refreshToken);
  const replayMarker = await redis.get(
    RedisKeys.refreshFamilyUsed(userId, `${sid}.${incomingHash.slice(0, 16)}`),
  );
  if (replayMarker) {
    // OWASP: presented an already-rotated token → assume theft → kill family
    await handleSuspiciousRefresh(userId);
    throw new SessionRevokedError("Refresh token replay detected");
  }

  // 2) Session record exists?
  const meta = await getSessionMeta(userId, sid);
  if (!meta) throw new SessionRevokedError();

  // 3) Hash match? (constant-time compare via Buffer)
  const ok = safeEqual(meta.tokenHash, incomingHash);
  if (!ok) {
    // Hash mismatch on live session → previously rotated token reuse
    await handleSuspiciousRefresh(userId);
    throw new SessionRevokedError("Refresh token mismatch");
  }

  // 4) Device binding - strict mode only (warn-only otherwise)
  if (ctx.fingerprint && meta.fingerprint) {
    const sameDevice = safeEqual(ctx.fingerprint, meta.fingerprint);
    if (!sameDevice) {
      if (env.AUTH_STRICT_DEVICE_BINDING) {
        logger.warn(
          { userId, sid, expected: meta.fingerprint, got: ctx.fingerprint },
          "Refresh: device binding mismatch (strict) - revoking",
        );
        await revokeSession(userId, sid);
        throw new SessionRevokedError("Device binding mismatch");
      }
      logger.warn(
        { userId, sid },
        "Refresh: device fingerprint changed (warn-only mode)",
      );
    }
  }

  return meta;
}

// ============================================================================
// rotateSession - OWASP refresh-token rotation
// ============================================================================
// 1. Mark old token-hash as "used" (replay-window marker)
// 2. Issue new pair
// 3. Overwrite session HASH (preserve createdAt, bump lastUsedAt + rotations)
// 4. Revoke old access JTI (force re-auth on access cookie)
// ============================================================================
export async function rotateSession(
  user: { id: string; email: string; role: "CUSTOMER" | "VENDOR" | "ADMIN" },
  oldSid: string,
  oldRefreshToken: string,
  // ctx accepted for symmetry with createSession - reserved for future use
  // (e.g. updating lastUsedIp). Fingerprint stays bound to first-seen device.
  _ctx: SessionContext = {},
): Promise<{ accessToken: string; refreshToken: string; sid: string }> {
  const oldMeta = await getSessionMeta(user.id, oldSid);
  // Should not happen (validateRefreshSession already checked) but be defensive
  if (!oldMeta) throw new SessionRevokedError();

  const oldHashShort = sha256(oldRefreshToken).slice(0, 16);
  const newJti = crypto.randomBytes(12).toString("hex");
  const now = Date.now();

  // ----- ROTATION STRATEGY: reuse same sid -----
  // Same sid keeps the session "thread" continuous (analytics + binding stable).
  // Industry split: some rotate sid too (Stripe), some keep (Auth0). We keep sid,
  // overwrite tokenHash atomically - any old token presented = mismatch = theft.

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    sid: oldSid,
  };
  const accessToken = signAccess({ ...payload, jti: newJti });
  const refreshToken = signRefresh(payload);
  const newHash = sha256(refreshToken);

  const ttl = parseExpiryToSeconds(env.JWT_REFRESH_EXPIRES_IN);
  const newRotations = (parseInt(oldMeta.rotations || "0", 10) + 1).toString();

  await Promise.all([
    // Update session metadata atomically
    redis.hset(RedisKeys.session(user.id, oldSid), {
      tokenHash: newHash,
      jti: newJti,
      // fingerprint stays bound to first-seen device (refresh shouldn't move)
      lastUsedAt: now.toString(),
      rotations: newRotations,
    }),
    redis.expire(RedisKeys.session(user.id, oldSid), ttl),
    // Mark OLD token hash as "used" - replay window
    redis.set(
      RedisKeys.refreshFamilyUsed(user.id, `${oldSid}.${oldHashShort}`),
      "1",
      "EX",
      REPLAY_WINDOW_SECONDS,
    ),
    // Revoke OLD access-token jti (force browser to use new access cookie)
    revokeAccessJti(oldMeta.jti, parseExpiryToSeconds(env.JWT_ACCESS_EXPIRES_IN)),
  ]);

  logger.info({ userId: user.id, sid: oldSid, rotations: newRotations }, "Session rotated");
  return { accessToken, refreshToken, sid: oldSid };
}

// ============================================================================
// revokeSession - logout (single device)
// ============================================================================
export async function revokeSession(userId: string, sid: string): Promise<void> {
  const meta = await getSessionMeta(userId, sid);
  const ops: Promise<unknown>[] = [
    redis.del(RedisKeys.session(userId, sid)),
    redis.srem(RedisKeys.userSessions(userId), sid),
  ];
  // Blacklist the live access JTI so the in-flight access cookie can't be used
  // until its natural expiry (else 15m of attacker access post-logout)
  if (meta?.jti) {
    ops.push(revokeAccessJti(meta.jti, parseExpiryToSeconds(env.JWT_ACCESS_EXPIRES_IN)));
  }
  await Promise.all(ops);
  logger.info({ userId, sid }, "Session revoked");
}

// ============================================================================
// revokeAllSessions - "Sign out from all devices" + theft response
// ============================================================================
export async function revokeAllSessions(userId: string): Promise<void> {
  const sids = (await redis.smembers(RedisKeys.userSessions(userId))) as string[];
  if (sids.length === 0) return;

  const ops: Promise<unknown>[] = [redis.del(RedisKeys.userSessions(userId))];

  // For each session: pull jti, blacklist it, then delete session HASH
  for (const sid of sids) {
    const meta = await getSessionMeta(userId, sid);
    if (meta?.jti) {
      ops.push(revokeAccessJti(meta.jti, parseExpiryToSeconds(env.JWT_ACCESS_EXPIRES_IN)));
    }
    ops.push(redis.del(RedisKeys.session(userId, sid)));
  }

  await Promise.all(ops);
  logger.warn({ userId, count: sids.length }, "All sessions revoked");
}

// ============================================================================
// revokeAccessJti - add JTI to revocation set with TTL = remaining lifetime
// ============================================================================
async function revokeAccessJti(jti: string, ttlSeconds: number): Promise<void> {
  if (!jti) return;
  await redis.set(RedisKeys.accessJtiRevoked(jti), "1", "EX", Math.max(ttlSeconds, 1));
}

// ============================================================================
// handleSuspiciousRefresh - refresh token reuse / mismatch
// ============================================================================
// OWASP: reuse → assume theft → kill ALL sessions
// ============================================================================
export async function handleSuspiciousRefresh(userId: string): Promise<void> {
  logger.error({ userId }, "Suspicious refresh - revoking all sessions");
  await revokeAllSessions(userId);
}

// ============================================================================
// Internal: timing-safe string equality
// ============================================================================
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ============================================================================
// Internal: "15m" / "7d" / "1w" → seconds (Redis TTL)
// ============================================================================
function parseExpiryToSeconds(expiry: string): number {
  const match = /^(\d+)([smhdw])$/.exec(expiry);
  if (!match) throw new Error(`Invalid expiry format: "${expiry}"`);
  const n = parseInt(match[1]!, 10);
  const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 7 * 86400 }[match[2]!];
  if (!mult || n <= 0) throw new Error(`Invalid expiry: "${expiry}"`);
  return n * mult;
}
