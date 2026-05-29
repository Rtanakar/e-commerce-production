// ============================================================================
// auth.controller.ts - HTTP layer (function-based)
// ============================================================================
// Thin controllers: extract req data → call service → format response.
// NO business logic - sirf HTTP <-> Service translation.
//
// Cookie strategy (FAANG dual-cookie):
//   - Access token  → httpOnly cookie "at"  (path=/api/v1, 15m)  + response body
//   - Refresh token → httpOnly cookie "rt"  (path=/auth, 30d)    + response body
//   - Body has both → mobile/native clients without cookie jar work too
//   - Browser/Postman → cookies auto-travel, no header juggling
// ============================================================================

import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError, BadRequestError } from "../../utils/errors.js";
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
  ChangePasswordDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
} from "./auth.validator.js";

// ============================================================================
// Internal helper - send auth response (cookie + body) consistently
// ============================================================================
// Used by login / verifyOtp / refresh - all three flows return tokens.
// Centralizing prevents drift between endpoints.
// ============================================================================
function sendAuthResponse(
  req: Request,
  res: Response,
  result: AuthResponseDto & { sid?: string },
  status: number,
) {
  // Set httpOnly access + refresh cookies + (readable) CSRF cookie HMAC-bound to sid
  //   - access  cookie "at"   → path=/api/v1            → auto-sent on every API call
  //   - refresh cookie "rt"   → path=/api/v1/auth       → only on auth endpoints
  //   - csrf    cookie "csrf" → path=/api/v1, JS reads  → echo as X-CSRF-Token
  setAuthCookies(res, { ...result.tokens, sid: result.sid });

  // Body returns tokens (mobile/native), NOT sid (server-only correlation id)
  const { sid: _omit, ...publicBody } = result as AuthResponseDto & { sid?: string };
  void _omit;
  res.status(status).json({
    ...ApiResponseBuilder.success(publicBody),
    requestId: req.id,
  });
}

// ============================================================================
// POST /register
// ============================================================================
// Returns OTP-pending state, no tokens yet (issued at /verify-otp)
// ============================================================================
export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterDto);

  // Differentiated UX based on email delivery outcome
  const message = result.otpSent
    ? "Account created. Please check your email for the verification code."
    : "Account created, but we couldn't send the verification email right now. " +
      "Please use the 'Resend OTP' endpoint to try again in a moment.";

  res.status(HttpStatus.CREATED).json({
    ...ApiResponseBuilder.success({ ...result, message }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /verify-otp - marks email verified (NO tokens, NO cookies)
// ============================================================================
// User must sign in manually after verification (industry: Amazon/Flipkart flow)
// ============================================================================
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyOtp(req.body as VerifyOtpDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// POST /resend-otp
// ============================================================================
export async function resendOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.resendOtp(req.body as ResendOtpDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      ...result,
      message: "If an account exists, a new code has been sent.",
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /login - issues tokens, sets refresh cookie
// ============================================================================
export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginDto, {
    ip: req.ip ?? null,
    ua: (req.headers["user-agent"] ?? null) as string | null,
    fingerprint: computeDeviceFingerprint(req),
  });
  sendAuthResponse(req, res, result, HttpStatus.OK);
}

// ============================================================================
// POST /refresh - reads refresh token from cookie OR body
// ============================================================================
// Web client → cookie (auto-sent by browser)
// Mobile/native → body (no cookie jar)
// ============================================================================
export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = getRefreshTokenFromRequest(req);
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  const result = await authService.refreshTokens(refreshToken, {
    ip: req.ip ?? null,
    ua: (req.headers["user-agent"] ?? null) as string | null,
    fingerprint: computeDeviceFingerprint(req),
  });
  // Rotation - new refresh cookie + rotated CSRF replace old ones
  sendAuthResponse(req, res, result, HttpStatus.OK);
}

// ============================================================================
// POST /logout - clears cookie + revokes session
// ============================================================================
export async function logout(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  await authService.logout(req.user.sub, req.user.sid);
  // Clear the httpOnly cookie - browser drops it
  clearAuthCookies(res);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ message: "Logout successful" }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /logout-all - all devices + clear current cookie
// ============================================================================
export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  await authService.logoutAllDevices(req.user.sub);
  clearAuthCookies(res);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({ message: "Logged out from all devices" }),
    requestId: req.id,
  });
}

// ============================================================================
// GET /me - protected
// ============================================================================
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const user = await authService.getMe(req.user.sub);

  // Echo existing CSRF token via response header - frontend caches in memory
  // and echoes on subsequent mutating requests. Token is STABLE across /me
  // calls (set at login, rotated only on /refresh) - prevents memory/cookie
  // drift that was breaking the equality-mode CSRF check.
  emitCsrfHeader(req, res, req.user.sid);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(user),
    requestId: req.id,
  });
}

// ============================================================================
// POST /change-password - revokes all sessions + clears cookie
// ============================================================================
export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  await authService.changePassword(req.user.sub, req.body as ChangePasswordDto);
  // All sessions revoked → current cookie is dead → clear it client-side too
  clearAuthCookies(res);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      message: "Password changed successfully, all sessions revoked",
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /forgot-password
// ============================================================================
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body as ForgotPasswordDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      message: "If an account exists, a password reset link has been sent.",
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /reset-password - clears any stale cookie
// ============================================================================
export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body as ResetPasswordDto);
  // Reset revokes all sessions → any stale cookie is dead → clear
  clearAuthCookies(res);

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      message: "Password reset successful. Please log in with your new password.",
    }),
    requestId: req.id,
  });
}
