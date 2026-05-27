// ============================================================================
// auth.routes.ts - Auth module routing
// ============================================================================
// app.ts me /api/v1/auth prefix lagega
// Order: middleware (rate-limit → validate → auth) → controller
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import {
  authRateLimit,
  otpRateLimit,
  passwordResetRateLimit,
} from "../../middlewares/rate-limit.js";
import * as authController from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validator.js";

const router: Router = Router();

// ============================================================================
// PUBLIC - rate limited (brute force prevention)
// ============================================================================

// Register - sends OTP, no tokens yet
/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user and send OTP to email/phone
 * @access Public (but rate-limited)
 * @body { email, phone, password }
 * @returns 200 OK if OTP sent (even if email/phone already exists, to prevent enumeration)
 */
router.post(
  "/register",
  authRateLimit,
  validate(registerSchema),
  asyncHandler(authController.register),
);

// Verify OTP - issues tokens
/**
 * @route POST /api/v1/auth/verify-otp
 * @desc Verify the OTP and issue authentication tokens
 * @access Public (but rate-limited)
 * @body { email, otp }
 * @returns 200 OK with authentication tokens
 */
router.post(
  "/verify-otp",
  authRateLimit,
  validate(verifyOtpSchema),
  asyncHandler(authController.verifyOtp),
);

// Resend OTP - strict limit (SMS/email cost)
/**
 * @route POST /api/v1/auth/resend-otp
 * @desc Resend OTP to email/phone
 * @access Public (but rate-limited)
 * @body { email }
 * @returns 200 OK if OTP sent
 */
router.post(
  "/resend-otp",
  otpRateLimit,
  validate(resendOtpSchema),
  asyncHandler(authController.resendOtp),
);

// Login (requires email verified)
/**
 * @route POST /api/v1/auth/login
 * @desc Login a user and issue authentication tokens
 * @access Public (but rate-limited)
 * @body { email, password }
 * @returns 200 OK with authentication tokens
 */
router.post("/login", authRateLimit, validate(loginSchema), asyncHandler(authController.login));

// Refresh - relaxed limit (auto-called by clients)
/**
 * @route POST /api/v1/auth/refresh
 * @desc Refresh the authentication tokens
 * @access Public (but rate-limited)
 * @body { refresh_token }
 * @returns 200 OK with new authentication tokens
 */
router.post("/refresh", validate(refreshSchema), asyncHandler(authController.refresh));

// Forgot password - very strict limit (email spam)
/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Initiate the password reset process
 * @access Public (but rate-limited)
 * @body { email }
 * @returns 200 OK if reset email sent
 */
router.post(
  "/forgot-password",
  passwordResetRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

// Reset password via token
/**
 * @route POST /api/v1/auth/reset-password
 * @desc Reset the user's password using a reset token
 * @access Public (but rate-limited)
 * @body { email, resetToken, newPassword }
 * @returns 200 OK if password reset
 */
router.post(
  "/reset-password",
  authRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

// ============================================================================
// PROTECTED - requireAuth
// ============================================================================

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout the current user
 * @access Protected
 */
router.post("/logout", requireAuth, asyncHandler(authController.logout));

/**
 * @route POST /api/v1/auth/logout-all
 * @desc Logout the user from all devices (invalidate all tokens)
 * @access Protected
 */
router.post("/logout-all", requireAuth, asyncHandler(authController.logoutAll));

/**
 * @route GET /api/v1/auth/me
 * @desc Get the current user's profile
 * @access Protected
 */
router.get("/me", requireAuth, asyncHandler(authController.me));

/** * @route POST /api/v1/auth/change-password
 * @desc Change the current user's password
 * @access Protected
 * @body { currentPassword, newPassword }
 * @returns 200 OK if password changed
 */
router.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

export default router;
