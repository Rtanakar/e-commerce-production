// ============================================================================
// google.ts - Google OAuth 2.0 flow (no passport dep)
// ============================================================================
// Industry: most modern Node servers do raw OAuth (passport too heavy/slow).
// 3 functions:
//   1. buildAuthUrl()     - generate Google consent URL (with state)
//   2. exchangeCode()     - swap auth code for access_token
//   3. fetchProfile()     - get user info using access_token
//
// CSRF mitigation via `state` token stored in Redis (5min TTL).
// ============================================================================

import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { redis, RedisKeys } from "../../../lib/redis.js";
import { BadRequestError, InternalServerError } from "../../../utils/errors.js";
import { logger } from "../../../utils/logger.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// Where Google posts the code back - MUST match Google Console "Authorized redirect URI"
function getRedirectUri(): string {
  // Note: include API_PREFIX/VERSION because Express mounts at /api/v1
  const base = `http://localhost:${env.PORT}`;
  return `${base}/${env.API_PREFIX}/${env.API_VERSION}/auth/google/callback`;
}

function assertConfigured(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new InternalServerError(
      "Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
    );
  }
}

// ============================================================================
// buildAuthUrl - returns Google consent URL with state token
// ============================================================================
// `state` is opaque, random, stored in Redis with `frontendRedirect` payload.
// Callback validates state → prevents CSRF.
// ============================================================================
export async function buildAuthUrl(frontendRedirect: string): Promise<string> {
  assertConfigured();

  const state = crypto.randomBytes(24).toString("hex");

  // Store the frontend redirect tied to this state (5min TTL)
  await redis.set(
    RedisKeys.oauthState(state),
    JSON.stringify({ frontendRedirect }),
    "EX",
    5 * 60,
  );

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  // Minimum scopes - email + profile picture
  url.searchParams.set("scope", "openid email profile");
  // Force consent screen for refresh_token (Google trick)
  // Remove `access_type=offline` if you don't need long-term Google API access
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  return url.toString();
}

// ============================================================================
// consumeState - validate state from callback (one-time use)
// ============================================================================
export async function consumeState(
  state: string,
): Promise<{ frontendRedirect: string } | null> {
  const raw = await redis.get(RedisKeys.oauthState(state));
  if (!raw) return null;
  // Delete after read - one-time use prevents replay attacks
  await redis.del(RedisKeys.oauthState(state));
  try {
    return JSON.parse(raw) as { frontendRedirect: string };
  } catch {
    return null;
  }
}

// ============================================================================
// exchangeCode - swap auth code for access_token
// ============================================================================
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  scope: string;
  token_type: string;
}

export async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  assertConfigured();

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, response: text }, "Google token exchange failed");
    throw new BadRequestError("Failed to exchange authorization code");
  }

  return (await res.json()) as GoogleTokenResponse;
}

// ============================================================================
// fetchProfile - get user info from Google
// ============================================================================
export interface GoogleProfile {
  /** Google's `sub` - immutable user id (use this, not email) */
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    logger.error({ status: res.status }, "Google userinfo fetch failed");
    throw new BadRequestError("Failed to fetch Google profile");
  }

  return (await res.json()) as GoogleProfile;
}
