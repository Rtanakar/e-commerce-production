// ============================================================================
// google.controller.ts - OAuth route handlers (init + callback)
// ============================================================================
// Two endpoints:
//   GET /auth/google           - redirects to Google consent (with state)
//   GET /auth/google/callback  - handles Google's response, sets cookies, redirects
// ============================================================================

import type { Request, Response } from "express";
import { z } from "zod";
import {
  buildAuthUrl,
  consumeState,
  exchangeCode,
  fetchProfile,
} from "./google.js";
import { loginWithGoogle } from "./google.service.js";
import { setAuthCookies, computeDeviceFingerprint } from "../../../utils/cookies.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

// ============================================================================
// GET /auth/google - init flow
// ============================================================================
// Query: ?redirect=/dashboard - where to land after success (frontend route)
// Default redirect: "/" (frontend root)
// ============================================================================
export async function initiateGoogleAuth(req: Request, res: Response): Promise<void> {
  const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "/";

  // Validate redirect to prevent open-redirect attack:
  // Only allow same-site paths (start with "/") - blocks `?redirect=https://evil.com`
  const safeRedirect = redirect.startsWith("/") ? redirect : "/";

  const authUrl = await buildAuthUrl(safeRedirect);
  res.redirect(authUrl);
}

// ============================================================================
// GET /auth/google/callback - Google posts back here
// ============================================================================
// Google sends: ?code=...&state=...
// Or on error:  ?error=access_denied
// ============================================================================
const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const parsed = callbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.redirect(buildFailRedirect("invalid_callback"));
  }

  const { code, state, error } = parsed.data;

  // User declined consent or other Google error
  if (error || !code || !state) {
    logger.warn({ error }, "OAuth callback aborted");
    return res.redirect(buildFailRedirect(error ?? "missing_params"));
  }

  // Validate state - prevents CSRF
  const stateData = await consumeState(state);
  if (!stateData) {
    logger.warn({ state }, "OAuth state invalid or expired");
    return res.redirect(buildFailRedirect("invalid_state"));
  }

  try {
    // Exchange code → access token → fetch profile
    const tokens = await exchangeCode(code);
    const profile = await fetchProfile(tokens.access_token);

    // Reject unverified Google emails (rare but possible)
    if (!profile.email_verified) {
      logger.warn({ email: profile.email }, "Google email not verified");
      return res.redirect(buildFailRedirect("email_not_verified"));
    }

    // Find or create user, issue tokens (with device fingerprint binding)
    const result = await loginWithGoogle(profile, {
      ip: req.ip ?? null,
      ua: (req.headers["user-agent"] ?? null) as string | null,
      fingerprint: computeDeviceFingerprint(req),
    });

    // Set auth cookies (httpOnly access + refresh + readable CSRF bound to sid)
    setAuthCookies(res, { ...result.tokens, sid: result.sid });

    // Redirect to frontend with success
    const target = new URL(stateData.frontendRedirect, env.GOOGLE_OAUTH_REDIRECT_BASE);
    res.redirect(target.toString());
  } catch (err) {
    logger.error({ err }, "OAuth callback failed");
    res.redirect(buildFailRedirect("internal_error"));
  }
}

// ============================================================================
// Helper - build failure redirect URL (frontend signin page with error param)
// ============================================================================
function buildFailRedirect(reason: string): string {
  const url = new URL("/signin", env.GOOGLE_OAUTH_REDIRECT_BASE);
  url.searchParams.set("oauth_error", reason);
  return url.toString();
}
