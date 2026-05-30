// ============================================================================
// seller-auth.routes.ts - Seller portal auth routing
// ============================================================================
// Mounted at /api/v1/auth/seller (see app.ts). Parallel to /api/v1/auth.
// Uses requireSellerAuth + requireSellerCsrf (seller cookie jar isolation).
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireSellerAuth } from "../../middlewares/require-auth.js";
import { requireSellerCsrf } from "../../middlewares/csrf.js";
import {
  authRateLimit,
  otpRateLimit,
} from "../../middlewares/rate-limit.js";
import * as sellerAuthController from "./seller-auth.controller.js";
// Phone verify handlers are scope-agnostic (req.user.sub only) → reuse the
// customer auth.controller versions, just guard them with seller middleware.
import * as authController from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  verifyOtpSchema,
  resendOtpSchema,
  sendPhoneOtpSchema,
  verifyPhoneOtpSchema,
} from "./auth.validator.js";

const router: Router = Router();

// ----- PUBLIC (rate limited) -----

router.post(
  "/register",
  authRateLimit,
  validate(registerSchema),
  asyncHandler(sellerAuthController.register),
);

router.post(
  "/verify-otp",
  authRateLimit,
  validate(verifyOtpSchema),
  asyncHandler(sellerAuthController.verifyOtp),
);

router.post(
  "/resend-otp",
  otpRateLimit,
  validate(resendOtpSchema),
  asyncHandler(sellerAuthController.resendOtp),
);

router.post(
  "/login",
  authRateLimit,
  validate(loginSchema),
  asyncHandler(sellerAuthController.login),
);

// CSRF enforced on refresh (cookie-auth requests must echo X-CSRF-Token)
router.post(
  "/refresh",
  requireSellerCsrf,
  validate(refreshSchema),
  asyncHandler(sellerAuthController.refresh),
);

// ----- PROTECTED (requireSellerAuth) -----

router.post(
  "/logout",
  requireSellerCsrf,
  requireSellerAuth,
  asyncHandler(sellerAuthController.logout),
);

router.get(
  "/me",
  requireSellerAuth,
  asyncHandler(sellerAuthController.me),
);

// ----- Phone verification (SMS OTP) - seller cookie jar -----
// Same handlers as the customer routes, gated by seller middleware so the
// seller wizard verifies phone using the seller session (s_at cookie).
router.post(
  "/phone/send-otp",
  otpRateLimit,
  requireSellerCsrf,
  requireSellerAuth,
  validate(sendPhoneOtpSchema),
  asyncHandler(authController.sendPhoneOtp),
);

router.post(
  "/phone/verify",
  authRateLimit,
  requireSellerCsrf,
  requireSellerAuth,
  validate(verifyPhoneOtpSchema),
  asyncHandler(authController.verifyPhoneOtp),
);

export default router;
