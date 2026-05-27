// ============================================================================
// auth.service.ts - Business logic layer
// ============================================================================
// Pure business rules - HTTP/Express se unaware
// Industry pattern (Express): named function exports - stateless, testable
//
// Two-layer validation (defense in depth - Stripe/AWS SDK pattern):
//   1. Zod (route middleware)        : request shape, types, formats
//   2. assertRequired (service top)  : runtime guard - catches internal callers
//                                       that bypass Zod (workers, scripts, tests)
// ============================================================================

import * as authRepo from "./auth.repository.js";
import * as tokens from "../../lib/tokens.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import * as authHelper from "./auth.helper.js";
import { sendEmail } from "../../lib/mailer.js";
import { welcomeEmail } from "../../mails/templates.js";
import {
  EmailExistsError,
  InvalidCredentialsError,
  AccountSuspendedError,
  NotFoundError,
  SessionRevokedError,
  UnauthorizedError,
  BadRequestError,
} from "../../utils/errors.js";
import { assertRequired } from "../../utils/assert.js";
import { logger } from "../../utils/logger.js";
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
// REGISTER - sends OTP, no tokens yet
// ============================================================================
// Flow:
//   1. Validate required fields (defense-in-depth)
//   2. Check email duplicate
//   3. Hash password
//   4. Create user (status = PENDING_VERIFICATION)
//   5. Send OTP email
//
// Why no tokens until OTP verify?
//   - Prevents fake email signups (free-tier abuse)
//   - Industry: Amazon/Flipkart require email verify before checkout
// ============================================================================
export async function register(input: RegisterDto): Promise<{ email: string; otpSent: boolean }> {
  // Defense in depth - Zod already validated, but workers/scripts might bypass
  assertRequired(input, ["email", "password", "name"]);

  // VENDOR role requires shopName
  if (input.role === "VENDOR" && !input.shopName) {
    throw new BadRequestError("shopName is required for VENDOR role");
  }

  if (await authRepo.emailExists(input.email)) {
    throw new EmailExistsError();
  }

  const passwordHash = await hashPassword(input.password);

  const user = await authRepo.createUser({
    email: input.email,
    password: passwordHash,
    name: input.name,
    role: input.role,
    shopName: input.shopName,
  });

  // ----- OTP email send - GRACEFUL on failure -----
  // User is already in DB. If email fails (SMTP misconfig, provider down),
  // we DO NOT roll back the user - that would lock them out (email exists →
  // can't re-register, no OTP received → can't verify).
  //
  // Senior pattern: log the failure, return otpSent: false. User hits
  // /resend-otp once SMTP is healthy. Production: queue via BullMQ for retry.
  let otpSent = true;
  try {
    await authHelper.sendOtpEmail({
      name: user.name,
      email: user.email,
      purpose: "registration",
    });
  } catch (err) {
    otpSent = false;
    logger.error(
      { err, userId: user.id, email: user.email },
      "Registration: OTP email failed - user can retry via /resend-otp",
    );
  }

  logger.info({ userId: user.id, role: user.role, otpSent }, "User registered");

  return { email: user.email, otpSent };
}

// ============================================================================
// VERIFY OTP - issues tokens
// ============================================================================
export async function verifyOtp(input: VerifyOtpDto): Promise<AuthResponseDto> {
  assertRequired(input, ["email", "otp"]);

  await authHelper.verifyOtp(input.email, input.otp);

  const user = await authRepo.findUserByEmail(input.email);
  if (!user) throw new NotFoundError("User");

  // First verify of registration → activate account + send welcome email
  if (!user.emailVerified) {
    await authRepo.markEmailVerified(user.id);

    // Welcome email - fire-and-forget (non-critical)
    void (async () => {
      try {
        const { subject, html } = await welcomeEmail({
          name: user.name,
          role: user.role === "ADMIN" ? "CUSTOMER" : user.role,
        });
        await sendEmail({ to: user.email, subject, html });
      } catch (err) {
        logger.error({ err, userId: user.id }, "Welcome email failed");
      }
    })();
  }

  const { accessToken, refreshToken } = await tokens.createSession({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken },
  };
}

// ============================================================================
// RESEND OTP
// ============================================================================
// SECURITY: no user enumeration - silent success even if user doesn't exist
// ============================================================================
export async function resendOtp(input: ResendOtpDto): Promise<{ otpSent: boolean }> {
  assertRequired(input, ["email"]);

  const user = await authRepo.findUserByEmail(input.email);
  if (!user) return { otpSent: true };

  await authHelper.sendOtpEmail({
    name: user.name,
    email: user.email,
    purpose: user.emailVerified ? "login" : "registration",
  });

  return { otpSent: true };
}

// ============================================================================
// LOGIN
// ============================================================================
export async function login(
  input: LoginDto,
  context: { ip: string | null },
): Promise<AuthResponseDto> {
  assertRequired(input, ["email", "password"]);

  const user = await authRepo.findUserByEmail(input.email);
  // SECURITY: same error for "user not found" + "wrong password" (enumeration prevention)
  if (!user) throw new InvalidCredentialsError();

  if (user.status === "SUSPENDED" || user.status === "DELETED") {
    throw new AccountSuspendedError();
  }

  const passwordOk = await verifyPassword(input.password, user.password);
  if (!passwordOk) throw new InvalidCredentialsError();

  if (user.status === "PENDING_VERIFICATION" || !user.emailVerified) {
    throw new BadRequestError(
      "Please verify your email first. Check your inbox for the verification code.",
    );
  }

  // Audit trail - last login tracking
  await authRepo.updateLastLogin(user.id, context.ip);

  const { accessToken, refreshToken } = await tokens.createSession({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  logger.info({ userId: user.id, ip: context.ip }, "User logged in");

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken },
  };
}

// ============================================================================
// REFRESH (token rotation - OWASP)
// ============================================================================
export async function refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  const payload = tokens.verifyRefreshToken(refreshToken);

  const valid = await tokens.isSessionValid(payload.sub, payload.sid, refreshToken);
  if (!valid) {
    // OWASP: refresh token reuse → revoke all (theft response)
    await tokens.handleSuspiciousRefresh(payload.sub);
    throw new SessionRevokedError();
  }

  const user = await authRepo.findUserByIdForAuth(payload.sub);
  if (!user) throw new UnauthorizedError("User does not exist");
  if (user.status !== "ACTIVE") throw new AccountSuspendedError();

  const { accessToken, refreshToken: newRefresh } = await tokens.rotateSession(
    { id: user.id, email: user.email, role: user.role },
    payload.sid,
  );

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken: newRefresh },
  };
}

// ============================================================================
// LOGOUT - current session
// ============================================================================
export async function logout(userId: string, sid: string): Promise<void> {
  if (!userId || !sid) {
    throw new BadRequestError("Invalid session");
  }
  await tokens.revokeSession(userId, sid);
}

// ============================================================================
// LOGOUT ALL DEVICES
// ============================================================================
export async function logoutAllDevices(userId: string): Promise<void> {
  if (!userId) {
    throw new BadRequestError("Invalid session");
  }
  await tokens.revokeAllSessions(userId);
}

// ============================================================================
// GET ME
// ============================================================================
export async function getMe(userId: string) {
  if (!userId) {
    throw new BadRequestError("Invalid session");
  }
  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");
  return user;
}

// ============================================================================
// CHANGE PASSWORD - authenticated
// ============================================================================
export async function changePassword(userId: string, input: ChangePasswordDto): Promise<void> {
  if (!userId) {
    throw new BadRequestError("Invalid session");
  }
  assertRequired(input, ["currentPassword", "newPassword"]);

  if (input.currentPassword === input.newPassword) {
    throw new BadRequestError("New password must be different from current password");
  }

  const user = await authRepo.findUserByIdWithPassword(userId);
  if (!user) throw new NotFoundError("User");

  const ok = await verifyPassword(input.currentPassword, user.password);
  if (!ok) throw new InvalidCredentialsError("Current password is incorrect");

  const newHash = await hashPassword(input.newPassword);
  await authRepo.updateUserPassword(userId, newHash);
  await tokens.revokeAllSessions(userId);

  logger.info({ userId }, "Password changed - all sessions revoked");
}

// ============================================================================
// FORGOT PASSWORD - send reset email
// ============================================================================
// SECURITY: no user enumeration - same response whether user exists or not
// ============================================================================
export async function forgotPassword(input: ForgotPasswordDto): Promise<void> {
  assertRequired(input, ["email"]);

  const user = await authRepo.findUserByEmail(input.email);
  if (!user || user.status === "DELETED") return;

  await authHelper.sendPasswordResetEmailHelper({
    name: user.name,
    email: user.email,
    userId: user.id,
  });
}

// ============================================================================
// RESET PASSWORD - via reset token
// ============================================================================
export async function resetPassword(input: ResetPasswordDto): Promise<void> {
  assertRequired(input, ["token", "newPassword"]);

  const userId = await authHelper.consumePasswordResetToken(input.token);
  if (!userId) {
    throw new BadRequestError("Invalid or expired reset token");
  }

  const newHash = await hashPassword(input.newPassword);
  await authRepo.updateUserPassword(userId, newHash);
  await tokens.revokeAllSessions(userId);

  logger.info({ userId }, "Password reset - all sessions revoked");
}
