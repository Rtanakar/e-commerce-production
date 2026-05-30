// ============================================================================
// cookies.ts - Auth cookie helpers (Netflix/Stripe/GitHub grade)
// ============================================================================
// Hardening checklist applied (10/10 points addressed):
//   1.  ✅ sameSite picked from env + cross-site detection (not just "lax")
//   2.  ✅ CSRF double-submit cookie + helper (used by csrf middleware)
//   3.  ✅ Refresh-token rotation (in tokens.ts) - cookie rewritten on rotate
//   4.  ✅ Session storage (Redis HASH with metadata - in tokens.ts)
//   5.  ✅ JWT revocation - access JTI blacklist + sid-based session check
//   6.  ✅ Cookie priority: "high" (browsers evict low-priority first)
//   7.  ✅ Partitioned (CHIPS) for 3rd-party context support
//   8.  ✅ parseExpiryToMs strict - throws on invalid, supports s/m/h/d/w
//   9.  ✅ Device fingerprint helper (used by tokens.ts)
//   10. ✅ Replay detection via refresh-token rotation + JTI
//
// Industry pattern (GitHub/Vercel/Linear/Stripe):
//   - Access token  → httpOnly cookie  (path=/api/v1)
//   - Refresh token → httpOnly cookie  (path=/api/v1/auth - smaller blast radius)
//   - CSRF token    → readable cookie  (path=/api/v1, JS reads + echoes header)
//   - Both auth tokens ALSO in response BODY (mobile/native clients)
// ============================================================================

import type { Response, Request, CookieOptions } from "express";
import crypto from "node:crypto";
import { env, isProd } from "../config/env.js";

// ============================================================================
// Cookie names - constants (avoid magic strings)
// ============================================================================
// Customer cookies (default - shop traffic): at / rt / csrf
// Seller   cookies (Amazon Seller Central): seller-access-token /
//                                           seller-refresh-token /
//                                           seller-csrf-token
//
// Why separate: a logged-in customer on /shop and a logged-in seller on
// /seller-portal can co-exist (different cookie jars, different sessions).
// Stealing seller's refresh doesn't compromise their shopping account. Logout
// of one portal doesn't drop the other. Matches Amazon / Flipkart / Shopify.
// ============================================================================
export const CookieNames = {
  /** Access token - httpOnly, path=/api/v1, short-lived */
  ACCESS_TOKEN: "at",
  /** Refresh token - httpOnly, path=/api/v1/auth, long-lived */
  REFRESH_TOKEN: "rt",
  /** CSRF token mirror - NON httpOnly so JS can read + echo in X-CSRF-Token */
  CSRF: "csrf",
} as const;

/** Seller-portal cookies - parallel to customer set, isolated session jar.
 *  Descriptive names (vs customer's terse at/rt/csrf) so DevTools makes it
 *  obvious which jar a cookie belongs to. Matches Amazon Seller Central /
 *  Shopify Partners convention of using verbose `sp_*_token`-style names. */
export const SellerCookieNames = {
  ACCESS_TOKEN: "seller-access-token",
  REFRESH_TOKEN: "seller-refresh-token",
  CSRF: "seller-csrf-token",
} as const;

/** Auth scope - which cookie jar this request/response belongs to */
export type AuthScope = "customer" | "seller";

export function cookieNamesForScope(scope: AuthScope) {
  return scope === "seller" ? SellerCookieNames : CookieNames;
}

/** Request header that double-submits the CSRF token from frontend JS */
export const CSRF_HEADER = "x-csrf-token";
/** Response header backend uses to PUSH new CSRF token to client */
export const CSRF_RESPONSE_HEADER = "X-CSRF-Token";

// ============================================================================
// Extended CookieOptions - Express 4 types me partitioned/priority missing
// ============================================================================
// Yahaan cast karke type-safe access dete - browser/cookie@^0.7 supports both
type HardenedCookieOptions = CookieOptions & {
  partitioned?: boolean;
  priority?: "low" | "medium" | "high";
};

// ============================================================================
// sameSite resolution - production grade
// ============================================================================
// Decision matrix:
//   env override set      → use as-is
//   dev                   → "lax" (HTTP localhost, secure=false safe)
//   prod + COOKIE_DOMAIN  → "lax" (same parent domain, no cross-site needed)
//   prod + no domain      → "none" (cross-site frontend, MUST be secure)
// ============================================================================
function resolveSameSite(): "lax" | "strict" | "none" {
  if (env.COOKIE_SAMESITE) return env.COOKIE_SAMESITE;
  if (!isProd) return "lax";
  return env.COOKIE_DOMAIN ? "lax" : "none";
}

// ============================================================================
// Base cookie options - shared by ALL auth cookies
// ============================================================================
function baseCookieOptions(overrides: Partial<HardenedCookieOptions> = {}): HardenedCookieOptions {
  const sameSite = resolveSameSite();
  // Browser rule: sameSite=none REQUIRES secure=true (else cookie silently dropped)
  // Force secure on prod always; in dev secure=true would break HTTP testing
  const secure = isProd || sameSite === "none";

  return {
    httpOnly: true,
    secure,
    sameSite,
    // Priority hint (Chrome): "high" cookies survive eviction longer than low/medium
    // Auth cookies are critical - they MUST survive memory pressure / storage limits
    priority: "high",
    // CHIPS - partitioned cookies for 3rd-party context (Chrome 2024+ requirement)
    // Only meaningful with sameSite=none + secure=true
    ...(env.COOKIE_PARTITIONED && sameSite === "none" ? { partitioned: true } : {}),
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...overrides,
  };
}

// ============================================================================
// Path helpers
// ============================================================================
function apiBasePath(): string {
  return `/${env.API_PREFIX}/${env.API_VERSION}`;
}
function authBasePath(): string {
  return `${apiBasePath()}/auth`;
}
/** Seller refresh cookie scoped to /api/v1/auth/seller - tighter blast radius
 *  than customer's /api/v1/auth so a customer-route compromise can't see it. */
function sellerAuthBasePath(): string {
  return `${authBasePath()}/seller`;
}

function refreshPathForScope(scope: AuthScope): string {
  return scope === "seller" ? sellerAuthBasePath() : authBasePath();
}

// ============================================================================
// setAccessCookie - call on login/verify-otp/refresh
// ============================================================================
export function setAccessCookie(
  res: Response,
  accessToken: string,
  scope: AuthScope = "customer",
): void {
  const names = cookieNamesForScope(scope);
  res.cookie(names.ACCESS_TOKEN, accessToken, {
    ...baseCookieOptions(),
    path: apiBasePath(),
    maxAge: parseExpiryToMs(env.JWT_ACCESS_EXPIRES_IN),
  } as CookieOptions);
}

// ============================================================================
// setRefreshCookie - path-scoped to /auth (minimize attack surface)
// ============================================================================
export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  scope: AuthScope = "customer",
): void {
  const names = cookieNamesForScope(scope);
  res.cookie(names.REFRESH_TOKEN, refreshToken, {
    ...baseCookieOptions(),
    path: refreshPathForScope(scope),
    maxAge: parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN),
  } as CookieOptions);
}

// ============================================================================
// setCsrfCookie - readable by JS (frontend echoes in X-CSRF-Token header)
// ============================================================================
// Double-submit pattern:
//   1. Server sets `csrf` cookie (NON httpOnly, frontend JS reads document.cookie)
//   2. Frontend echoes value in `X-CSRF-Token` header on every mutating request
//   3. Server compares: cookie value === header value → safe (CSRF cannot read cookie)
//
// HMAC-bound to session (sid) so token can't be reused across users.
// ============================================================================
export function setCsrfCookie(
  res: Response,
  sid: string,
  scope: AuthScope = "customer",
): string {
  // HMAC with the scope's secret so seller CSRF tokens verify only with
  // SELLER_CSRF_SECRET (and vice versa).
  const token = generateCsrfToken(sid, scope);
  const names = cookieNamesForScope(scope);

  // ----- Defensive: clear legacy csrf cookies from earlier path scopes -----
  // Earlier versions of this service scoped csrf to /api/v1 (matching access
  // cookie). Browser treats (name, domain, PATH) as the cookie identity, so
  // setting csrf at path "/" creates a SECOND cookie next to the old one
  // instead of replacing it - user ends up with two csrf cookies in DevTools.
  // We pre-emit a clear directive for the legacy path so the browser drops it.
  // No-op if no legacy cookie exists (browser silently ignores).
  res.clearCookie(names.CSRF, {
    ...baseCookieOptions({ httpOnly: false }),
    path: apiBasePath(),
  } as CookieOptions);

  res.cookie(names.CSRF, token, {
    ...baseCookieOptions({
      // CRITICAL: JS must read this → httpOnly:false (double-submit fallback)
      httpOnly: false,
    }),
    // path="/" so the cookie identity is consistent across the entire app
    // and any legacy clients can still read it (security via HMAC, not path)
    path: "/",
    maxAge: parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN),
  } as CookieOptions);
  return token;
}

// ============================================================================
// CSRF secret resolution - scope-aware
// ============================================================================
// Seller scope uses SELLER_CSRF_SECRET if configured. Same isolation property
// as JWT secrets: customer CSRF key compromise can't forge seller tokens.
// ============================================================================
function csrfSecret(scope: AuthScope): string {
  if (scope === "seller" && env.SELLER_CSRF_SECRET) {
    return env.SELLER_CSRF_SECRET;
  }
  return env.CSRF_SECRET;
}

// ============================================================================
// generateCsrfToken - HMAC(scope-secret, sid + nonce) - prevents cross-user reuse
// ============================================================================
export function generateCsrfToken(
  sid: string,
  scope: AuthScope = "customer",
): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const hmac = crypto
    .createHmac("sha256", csrfSecret(scope))
    .update(`${sid}.${nonce}`)
    .digest("hex");
  // Token format: <nonce>.<hmac> - server verifies by re-HMACing with sid
  return `${nonce}.${hmac}`;
}

// ============================================================================
// verifyCsrfToken - re-compute HMAC and timing-safe compare
// ============================================================================
export function verifyCsrfToken(
  token: string,
  sid: string,
  scope: AuthScope = "customer",
): boolean {
  if (!token || !sid) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [nonce, hmac] = parts;
  if (!nonce || !hmac) return false;
  const expected = crypto
    .createHmac("sha256", csrfSecret(scope))
    .update(`${sid}.${nonce}`)
    .digest("hex");
  // timing-safe compare prevents byte-level timing oracle
  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================================
// setAuthCookies - convenience: set access + refresh + CSRF together
// ============================================================================
// sid required for CSRF binding. Pass from tokens.createSession()
// ============================================================================
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; sid?: string },
  scope: AuthScope = "customer",
): void {
  setAccessCookie(res, tokens.accessToken, scope);
  setRefreshCookie(res, tokens.refreshToken, scope);
  if (tokens.sid) {
    const csrfToken = setCsrfCookie(res, tokens.sid, scope);
    // ALSO push the CSRF token as a response header so the frontend can
    // capture it without depending on document.cookie path-scoping rules.
    // Stripe/GitHub Dashboard pattern - the header is the canonical source,
    // the cookie is fallback for double-submit verification.
    res.setHeader(CSRF_RESPONSE_HEADER, csrfToken);
  }
}

// ============================================================================
// emitCsrfHeader - ECHO existing CSRF token via response header (no rotation)
// ============================================================================
// Used on /auth/me - frontend bootstraps in-memory token from this endpoint.
//
// CRITICAL DESIGN (avoid the bug from rotating per /me):
//   Read EXISTING csrf cookie → echo same value as response header.
//   Do NOT generate a new token here.
//
// Why the previous "rotate every /me" approach was broken:
//   Login sets cookie=TOKEN_A. Frontend memory=TOKEN_A. Match.
//   /me #1 generated TOKEN_B → header=TOKEN_B. Memory=TOKEN_B. Cookie=TOKEN_A. DRIFT.
//   /me #2 generated TOKEN_C → header=TOKEN_C. Memory=TOKEN_C. Cookie=TOKEN_A. WORSE DRIFT.
//   Logout: header=TOKEN_C, cookie=TOKEN_A → Mode 1 (equality) ALWAYS fails.
//   Only Mode 2 (HMAC) saves it - one brittle point of failure.
//
// New approach: csrf token is stable for the session's lifetime.
// Rotation happens ONLY at session creation (login) and rotation (refresh).
// Memory ALWAYS converges to cookie value via /me echo. Both modes work.
//
// Cold-start fallback: if user has a valid session cookie but somehow no
// csrf cookie (legacy session, manual delete, etc.), generate + set it.
// ============================================================================
export function emitCsrfHeader(
  req: Request,
  res: Response,
  sid: string,
  scope: AuthScope = "customer",
): void {
  const cookies = (req.cookies as Record<string, string> | undefined) ?? {};
  const names = cookieNamesForScope(scope);
  const existing = cookies[names.CSRF];

  if (existing) {
    // Happy path: just echo what the browser already has
    res.setHeader(CSRF_RESPONSE_HEADER, existing);
    return;
  }

  // Cold-start: session is valid but csrf cookie missing - mint a fresh one.
  // This handles browsers that cleared 3rd-party cookies, legacy logins, etc.
  const token = generateCsrfToken(sid, scope);
  res.cookie(names.CSRF, token, {
    ...baseCookieOptions({ httpOnly: false }),
    path: "/",
    maxAge: parseExpiryToMs(env.JWT_REFRESH_EXPIRES_IN),
  } as CookieOptions);
  res.setHeader(CSRF_RESPONSE_HEADER, token);
}

// ============================================================================
// Clear cookies - logout flow
// ============================================================================
// CRITICAL: clearCookie requires SAME options (path/domain/sameSite/secure)
// as setCookie - browser matches the "cookie identity" by these fields.
// Mismatch → browser ignores the clear and cookie persists.
// ============================================================================
export function clearAccessCookie(
  res: Response,
  scope: AuthScope = "customer",
): void {
  const names = cookieNamesForScope(scope);
  res.clearCookie(names.ACCESS_TOKEN, {
    ...baseCookieOptions(),
    path: apiBasePath(),
  } as CookieOptions);
}

export function clearRefreshCookie(
  res: Response,
  scope: AuthScope = "customer",
): void {
  const names = cookieNamesForScope(scope);
  res.clearCookie(names.REFRESH_TOKEN, {
    ...baseCookieOptions(),
    path: refreshPathForScope(scope),
  } as CookieOptions);
}

export function clearCsrfCookie(
  res: Response,
  scope: AuthScope = "customer",
): void {
  const names = cookieNamesForScope(scope);
  // Current canonical path
  res.clearCookie(names.CSRF, {
    ...baseCookieOptions({ httpOnly: false }),
    path: "/",
  } as CookieOptions);
  // Legacy path (earlier versions scoped csrf to /api/v1) - defensive clear
  // ensures users upgrading from older builds don't carry stale duplicates.
  // Safe to call - browser ignores if no cookie exists at that path.
  res.clearCookie(names.CSRF, {
    ...baseCookieOptions({ httpOnly: false }),
    path: apiBasePath(),
  } as CookieOptions);
}

export function clearAuthCookies(
  res: Response,
  scope: AuthScope = "customer",
): void {
  clearAccessCookie(res, scope);
  clearRefreshCookie(res, scope);
  clearCsrfCookie(res, scope);
}

// ============================================================================
// Token extraction - cookie OR Authorization header
// ============================================================================
export function getAccessTokenFromRequest(
  req: Request,
  scope: AuthScope = "customer",
): string | undefined {
  const names = cookieNamesForScope(scope);
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
    names.ACCESS_TOKEN
  ];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token.length > 0) return token;
  }
  return undefined;
}

export function getRefreshTokenFromRequest(
  req: Request,
  scope: AuthScope = "customer",
): string | undefined {
  const names = cookieNamesForScope(scope);
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
    names.REFRESH_TOKEN
  ];
  if (fromCookie) return fromCookie;

  const body = req.body as { refreshToken?: string } | undefined;
  return body?.refreshToken;
}

export function getCsrfTokenFromCookie(
  req: Request,
  scope: AuthScope = "customer",
): string | undefined {
  const names = cookieNamesForScope(scope);
  return (req.cookies as Record<string, string> | undefined)?.[names.CSRF];
}

export function getCsrfTokenFromHeader(req: Request): string | undefined {
  const h = req.headers[CSRF_HEADER];
  if (Array.isArray(h)) return h[0];
  return typeof h === "string" ? h : undefined;
}

// ============================================================================
// computeDeviceFingerprint - lightweight binding signal
// ============================================================================
// Used by tokens.ts at session create / refresh time.
//
// Signals chosen for stability vs entropy tradeoff:
//   - User-Agent (stable per browser/app, attacker can spoof but must know it)
//   - Accept-Language (stable per user OS preference)
//   - Sec-CH-UA platform hint (modern browsers expose)
//
// IP is INTENTIONALLY excluded - mobile networks rotate IPs, breaking UX.
// For high-security tenants, AUTH_STRICT_DEVICE_BINDING=true tightens checks.
//
// SHA-256 of joined signals, truncated to 16 bytes (sufficient entropy + small)
// ============================================================================
export function computeDeviceFingerprint(req: Request): string {
  const ua = (req.headers["user-agent"] ?? "").toString();
  const lang = (req.headers["accept-language"] ?? "").toString();
  const platform = (req.headers["sec-ch-ua-platform"] ?? "").toString();
  const signals = [ua, lang, platform].join("|");
  return crypto.createHash("sha256").update(signals).digest("hex").slice(0, 32);
}

// ============================================================================
// parseExpiryToMs - STRICT (throws on invalid - no silent fallback)
// ============================================================================
// Supports: 30s, 15m, 1h, 7d, 1w
// Validated at env-load time too (regex on env vars), so this is defense-in-depth
// ============================================================================
const EXPIRY_RE = /^(\d+)([smhdw])$/;
const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
};

export function parseExpiryToMs(expiry: string): number {
  const match = EXPIRY_RE.exec(expiry);
  if (!match) {
    throw new Error(
      `Invalid expiry format: "${expiry}". Expected <number><s|m|h|d|w> e.g. 15m / 7d`,
    );
  }
  const n = parseInt(match[1]!, 10);
  const mult = UNIT_MS[match[2]!];
  if (!mult || n <= 0) {
    throw new Error(`Invalid expiry: "${expiry}"`);
  }
  return n * mult;
}
