// ============================================================================
// seller-auth.controller.ts - Seller portal auth (Amazon Seller Central style)
// ============================================================================
// Parallel auth surface for sellers. Reuses auth.service business logic but
// emits SELLER-scoped cookies (s_at / s_rt / s_csrf) so seller sessions are
// fully isolated from customer sessions (different cookie jar, different sid).
//
// Endpoints (mounted under /api/v1/auth/seller):
//   POST /register     create vendor account + send OTP (anon)
//   POST /verify-otp   mark email verified (no tokens)
//   POST /resend-otp   re-send OTP
//   POST /login        login - requires user.role === VENDOR, sets s_* cookies
//   POST /refresh      rotate seller session via s_rt cookie
//   POST /logout       revoke seller session, clear s_* cookies
//   GET  /me           return current seller, scoped to s_at cookie
//
// Why duplicate vs. parameterize the existing controller?
//   - Two cookie jars must NEVER clobber each other - one bug there breaks
//     security boundary. Explicit duplication is safer than a flag.
//   - Seller flow has different policy (login refuses non-VENDOR roles).
// ============================================================================

import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import {
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from "../../utils/errors.js";
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromRequest,
  computeDeviceFingerprint,
  emitCsrfHeader,
} from "../../utils/cookies.js";
import type {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  AuthResponseDto,
} from "./auth.validator.js";

const SCOPE = "seller" as const;

// ============================================================================
// Internal helper - emit seller cookies + body (parallel to customer version)
// ============================================================================
function sendSellerAuthResponse(
  req: Request,
  res: Response,
  result: AuthResponseDto & { sid?: string },
  status: number,
) {
  setAuthCookies(res, { ...result.tokens, sid: result.sid }, SCOPE);
  const { sid: _omit, ...publicBody } = result as AuthResponseDto & {
    sid?: string;
  };
  void _omit;
  res.status(status).json({
    ...ApiResponseBuilder.success(publicBody),
    requestId: req.id,
  });
}

// ============================================================================
// POST /seller/register - force role=VENDOR, send OTP
// ============================================================================
// Body may omit `role`; we always coerce to VENDOR here (seller portal).
// ============================================================================
export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body as RegisterDto;
  const result = await authService.register({ ...body, role: "VENDOR" });

  const message = result.otpSent
    ? "Seller account created. Please check your email for the verification code."
    : "Seller account created, but we couldn't send the verification email right now. " +
      "Please use the 'Resend OTP' endpoint to try again in a moment.";

  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success({ ...result, message }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /seller/verify-otp - mark email verified (no cookies)
// ============================================================================
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyOtp(req.body as VerifyOtpDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// POST /seller/resend-otp
// ============================================================================
export async function resendOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.resendOtp(req.body as ResendOtpDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      ...result,
      message: "If a seller account exists, a new code has been sent.",
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /seller/login - only allow VENDOR users; set s_* cookies
// ============================================================================
// If the user exists but role !== VENDOR, return 403 with hint to use the
// shop login or upgrade flow. Prevents a customer accidentally landing in
// the seller portal with shop cookies issued via seller endpoint.
// ============================================================================
export async function login(req: Request, res: Response): Promise<void> {
  // Pass scope="seller" so createSession signs with JWT_SELLER_* secrets.
  const result = await authService.login(
    req.body as LoginDto,
    {
      ip: req.ip ?? null,
      ua: (req.headers["user-agent"] ?? null) as string | null,
      fingerprint: computeDeviceFingerprint(req),
    },
    SCOPE,
  );

  if (result.user.role !== "VENDOR") {
    throw new ForbiddenError(
      "This is not a seller account. Please sign in on the shop or upgrade to selling.",
    );
  }

  sendSellerAuthResponse(req, res, result, HttpStatus.OK);
}

// ============================================================================
// POST /seller/refresh - reads s_rt cookie or body refreshToken
// ============================================================================
export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = getRefreshTokenFromRequest(req, SCOPE);
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  // Pass scope so verifyRefreshToken uses JWT_SELLER_REFRESH_SECRET and the
  // new pair is signed with seller secrets too.
  const result = await authService.refreshTokens(
    refreshToken,
    {
      ip: req.ip ?? null,
      ua: (req.headers["user-agent"] ?? null) as string | null,
      fingerprint: computeDeviceFingerprint(req),
    },
    SCOPE,
  );

  if (result.user.role !== "VENDOR") {
    // Defensive: if role was downgraded since session creation, refuse and
    // force re-login on the customer surface.
    throw new ForbiddenError("Seller session is no longer valid");
  }

  sendSellerAuthResponse(req, res, result, HttpStatus.OK);
}

// ============================================================================
// POST /seller/logout - revoke seller session, clear s_* cookies only
// ============================================================================
// Important: ONLY clears seller cookies. Customer session (if any) untouched.
// ============================================================================
export async function logout(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  await authService.logout(req.user.sub, req.user.sid);
  clearAuthCookies(res, SCOPE);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ message: "Seller logout successful" }),
    requestId: req.id,
  });
}

// ============================================================================
// GET /seller/me - protected (requireSellerAuth)
// ============================================================================
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const user = await authService.getMe(req.user.sub);

  // Echo seller CSRF token in response header (scoped to seller cookies)
  emitCsrfHeader(req, res, req.user.sid, SCOPE);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(user),
    requestId: req.id,
  });
}
