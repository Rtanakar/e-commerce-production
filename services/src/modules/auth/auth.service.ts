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
  SendPhoneOtpDto,
  VerifyPhoneOtpDto,
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

  // NOTE: shopName NO LONGER required at register time. Sellers create the
  // shop in step 2 (POST /vendors/setup-shop) after OTP verification - matches
  // Amazon Seller Central / Flipkart Seller Hub / Shopify onboarding flow.

  if (await authRepo.emailExists(input.email)) {
    throw new EmailExistsError();
  }

  const passwordHash = await hashPassword(input.password);

  const user = await authRepo.createUser({
    email: input.email,
    password: passwordHash,
    name: input.name,
    role: input.role,
    // Phone is OPTIONAL. Frontend (seller signup) sends it in E.164 format
    // ("+919876543210"). Customer signup currently doesn't collect it; nullable
    // column in schema makes this safe either way. phoneVerified stays NULL
    // until a future SMS-OTP flow sets it (separate endpoint).
    phone: input.phone,
    // shopName intentionally NOT passed - vendor_profile created in setup-shop
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
// VERIFY OTP - marks email verified ONLY (no auto sign-in)
// ============================================================================
// Flow: signup → verify-otp → /signin (user logs in manually)
//
// Why NO tokens here?
//   - Cleaner separation: "verify identity" vs "create session"
//   - Industry: banks/traditional e-commerce use this (Amazon, Flipkart)
//   - User has to enter password ONCE to confirm credentials work
//   - Single source of truth for session = /login endpoint
// ============================================================================
export async function verifyOtp(
  input: VerifyOtpDto,
): Promise<{ email: string; verified: boolean; message: string }> {
  assertRequired(input, ["email", "otp"]);

  await authHelper.verifyOtp(input.email, input.otp);

  const user = await authRepo.findUserByEmail(input.email);
  if (!user) throw new NotFoundError("User");

  // First verification → activate account + send welcome email
  if (!user.emailVerified) {
    await authRepo.markEmailVerified(user.id);

    // Welcome email - fire-and-forget (non-critical, don't fail verify)
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

  logger.info({ userId: user.id }, "Email verified - redirect to /signin");

  return {
    email: user.email,
    verified: true,
    message: "Email verified successfully. Please sign in to continue.",
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
  context: { ip: string | null; ua?: string | null; fingerprint?: string },
  scope: AuthScope = "customer",
): Promise<AuthResponseDto & { sid: string }> {
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

  // Scope param chooses which JWT secret family signs the tokens. Seller
  // login → seller secrets, customer login → customer secrets.
  const { accessToken, refreshToken, sid } = await tokens.createSession(
    { id: user.id, email: user.email, role: user.role },
    { ip: context.ip, ua: context.ua ?? null, fingerprint: context.fingerprint },
    scope,
  );

  logger.info({ userId: user.id, ip: context.ip, sid }, "User logged in");

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken },
    sid,
  };
}

// ============================================================================
// REFRESH (token rotation - OWASP)
// ============================================================================
import type { AuthScope } from "../../utils/cookies.js";

export async function refreshTokens(
  refreshToken: string,
  context: { ip?: string | null; ua?: string | null; fingerprint?: string } = {},
  scope: AuthScope = "customer",
): Promise<AuthResponseDto & { sid: string }> {
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  // Verify with the scope's secret — seller refresh tokens are signed with
  // JWT_SELLER_REFRESH_SECRET and cannot be verified with the customer key.
  const payload = tokens.verifyRefreshToken(refreshToken, scope);

  // validateRefreshSession does: hash compare + replay detect + binding check
  // Throws SessionRevokedError on any anomaly (and revokes-all on theft signals)
  await tokens.validateRefreshSession(payload.sub, payload.sid, refreshToken, {
    fingerprint: context.fingerprint,
  });

  const user = await authRepo.findUserByIdForAuth(payload.sub);
  if (!user) throw new UnauthorizedError("User does not exist");
  if (user.status !== "ACTIVE") throw new AccountSuspendedError();

  const {
    accessToken,
    refreshToken: newRefresh,
    sid,
  } = await tokens.rotateSession(
    { id: user.id, email: user.email, role: user.role },
    payload.sid,
    refreshToken,
    { fingerprint: context.fingerprint },
    scope,
  );

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken: newRefresh },
    sid,
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
// FORGOT PASSWORD - send OTP (mobile-first pattern)
// ============================================================================
// SECURITY: no user enumeration - same response whether user exists or not
// Sends OTP via existing helper (same rate-limit, cooldown, spam-lock logic)
// ============================================================================
export async function forgotPassword(input: ForgotPasswordDto): Promise<void> {
  assertRequired(input, ["email"]);

  const user = await authRepo.findUserByEmail(input.email);
  if (!user || user.status === "DELETED") return;

  // Reuse OTP helper - same cooldown/spam-lock as login OTP
  await authHelper.sendOtpEmail({
    name: user.name,
    email: user.email,
    purpose: "password-reset",
  });
}

// ============================================================================
// RESET PASSWORD - via OTP (Amazon/Flipkart pattern)
// ============================================================================
// Flow:
//   1. Verify OTP (consumes it, throws on invalid/locked)
//   2. Fetch user with current password hash
//   3. Reject if new password equals current (defense-in-depth)
//   4. Hash + update + revoke all sessions
// ============================================================================
export async function resetPassword(input: ResetPasswordDto): Promise<void> {
  assertRequired(input, ["email", "otp", "newPassword"]);

  // Step 1: verify OTP (throws on lock/expired/wrong)
  await authHelper.verifyOtp(input.email, input.otp);

  // Step 2: fetch user with password hash
  const user = await authRepo.findUserByEmail(input.email);
  if (!user || user.status === "DELETED") {
    throw new BadRequestError("Account not found");
  }

  // Step 3: reject reuse of same password (industry security policy)
  const sameAsOld = await verifyPassword(input.newPassword, user.password);
  if (sameAsOld) {
    throw new BadRequestError(
      "New password must be different from your current password",
    );
  }

  // Step 4: hash + persist + revoke all sessions (force re-login everywhere)
  const newHash = await hashPassword(input.newPassword);
  await authRepo.updateUserPassword(user.id, newHash);
  await tokens.revokeAllSessions(user.id);

  logger.info({ userId: user.id }, "Password reset via OTP - all sessions revoked");
}

// ============================================================================
// SEND PHONE OTP - authenticated (SMS verification)
// ============================================================================
// Flow:
//   1. Resolve the target phone — body.phone (set/change) OR the one on file
//   2. If changing: enforce E.164 uniqueness, persist (resets phoneVerified)
//   3. Short-circuit if already verified (no wasted SMS)
//   4. Send OTP via SMS (rate-limited by the shared OTP machinery)
// Returns the (masked) phone so the UI can show "code sent to •••••3210".
// ============================================================================
export async function sendPhoneOtp(
  userId: string,
  input: SendPhoneOtpDto,
): Promise<{ phone: string; otpSent: boolean }> {
  if (!userId) throw new BadRequestError("Invalid session");

  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");

  // Determine the phone to verify
  let phone = input.phone ?? user.phone ?? null;
  if (!phone) {
    throw new BadRequestError(
      "No phone number on file. Provide a phone number to verify.",
    );
  }

  // Changing/setting a new number → uniqueness check + persist (unverifies it)
  const isChanging = input.phone && input.phone !== user.phone;
  if (isChanging) {
    if (await authRepo.phoneExists(input.phone!, userId)) {
      throw new BadRequestError("This phone number is already in use");
    }
    await authRepo.updateUserPhone(userId, input.phone!);
    phone = input.phone!;
  } else if (user.phoneVerified) {
    // Already verified the number on file - nothing to do (idempotent UX)
    return { phone, otpSent: false };
  }

  await authHelper.sendOtpSms({ phone, purpose: "verification" });
  return { phone, otpSent: true };
}

// ============================================================================
// VERIFY PHONE OTP - authenticated
// ============================================================================
// Verifies the code against the user's CURRENT phone, then stamps
// phoneVerified. Brute-force protection inherited from the OTP core.
// ============================================================================
export async function verifyPhoneOtpForUser(
  userId: string,
  input: VerifyPhoneOtpDto,
): Promise<{ phoneVerified: boolean }> {
  if (!userId) throw new BadRequestError("Invalid session");

  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");
  if (!user.phone) {
    throw new BadRequestError("No phone number to verify");
  }

  // Throws on wrong/expired/locked; consumes OTP on success
  await authHelper.verifyPhoneOtp(user.phone, input.otp);

  await authRepo.markPhoneVerified(userId);
  logger.info({ userId }, "Phone verified via SMS OTP");

  return { phoneVerified: true };
}
