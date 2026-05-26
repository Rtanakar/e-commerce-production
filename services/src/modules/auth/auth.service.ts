// ============================================================================
// auth.service.ts - Business logic layer (function-based)
// ============================================================================
// Pure business rules - HTTP/Express se unaware
// Unit testing easy - bina supertest ke direct call kar sakte hai
//
// Industry pattern (Express ecosystem): named function exports
// Functions stateless hai - no DI container needed
// Test me dependencies easily mocked via jest.mock("./auth.repository")
// ============================================================================

import * as authRepo from "./auth.repository.js";
import * as tokens from "../../lib/tokens.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  EmailExistsError,
  InvalidCredentialsError,
  AccountSuspendedError,
  NotFoundError,
  SessionRevokedError,
  UnauthorizedError,
} from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  AuthResponseDto,
} from "./auth.validator.js";

// ============================================================================
// REGISTER
// ============================================================================
// Flow:
//   1. Email duplicate check (early fail - DB hit save)
//   2. Hash password (bcrypt)
//   3. Create user (+ vendor profile if VENDOR role)
//   4. Issue token pair (access + refresh)
// ============================================================================
export async function register(input: RegisterDto): Promise<AuthResponseDto> {
  if (await authRepo.emailExists(input.email)) {
    throw new EmailExistsError();
  }

  const passwordHash = await hashPassword(input.password);

  const user = await authRepo.createUser({
    email: input.email,
    password: passwordHash,
    name: input.name,
    role: input.role,
  });

  const { accessToken, refreshToken } = await tokens.createSession({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  logger.info({ userId: user.id, role: user.role }, "User registered");

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken },
  };
}

// ============================================================================
// LOGIN
// ============================================================================
// Flow:
//   1. Find user by email
//   2. Status check (block suspended/deleted)
//   3. Password verify (timing-safe bcrypt)
//   4. Issue tokens
//
// SECURITY: same error for "user not found" AND "wrong password"
// alag errors → user enumeration attack possible
// ============================================================================
export async function login(input: LoginDto): Promise<AuthResponseDto> {
  const user = await authRepo.findUserByEmail(input.email);
  if (!user) {
    throw new InvalidCredentialsError();
  }

  if (user.status !== "ACTIVE") {
    throw new AccountSuspendedError();
  }

  const passwordOk = await verifyPassword(input.password, user.password);
  if (!passwordOk) {
    throw new InvalidCredentialsError();
  }

  const { accessToken, refreshToken } = await tokens.createSession({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  logger.info({ userId: user.id }, "User logged in");

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tokens: { accessToken, refreshToken },
  };
}

// ============================================================================
// REFRESH (token rotation - OWASP)
// ============================================================================
// Flow:
//   1. Verify signature + expiry
//   2. Redis me valid check (revocation aware)
//   3. User still active hai check
//   4. Rotate - purana revoke, naya issue
//
// Reuse detection: invalid stored token → suspect theft → kill ALL sessions
// ============================================================================
export async function refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
  const payload = tokens.verifyRefreshToken(refreshToken);

  const valid = await tokens.isSessionValid(payload.sub, payload.sid, refreshToken);
  if (!valid) {
    // OWASP: refresh token reuse detected → revoke all (theft response)
    await tokens.handleSuspiciousRefresh(payload.sub);
    // unreachable - handleSuspiciousRefresh throws
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
  await tokens.revokeSession(userId, sid);
}

// ============================================================================
// LOGOUT ALL DEVICES
// ============================================================================
export async function logoutAllDevices(userId: string): Promise<void> {
  await tokens.revokeAllSessions(userId);
}

// ============================================================================
// GET ME
// ============================================================================
export async function getMe(userId: string) {
  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");
  return user;
}

// ============================================================================
// CHANGE PASSWORD
// ============================================================================
// Flow:
//   1. Current password verify (security - re-auth check)
//   2. Hash new password
//   3. Update DB
//   4. Revoke ALL sessions (force re-login on all devices)
//
// Step 4 important - agar attacker ne current session steal kar liya hai to
// password change ke baad bhi access rahega. All revoke = clean slate.
// ============================================================================
export async function changePassword(
  userId: string,
  input: ChangePasswordDto,
): Promise<void> {
  const user = await authRepo.findUserByIdWithPassword(userId);
  if (!user) throw new NotFoundError("User");

  const ok = await verifyPassword(input.currentPassword, user.password);
  if (!ok) throw new InvalidCredentialsError("Current password is incorrect");

  const newHash = await hashPassword(input.newPassword);
  await authRepo.updateUserPassword(userId, newHash);
  await tokens.revokeAllSessions(userId);

  logger.info({ userId }, "Password changed - all sessions revoked");
}
