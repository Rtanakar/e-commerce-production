// ============================================================================
// auth.routes.ts - Auth module routing
// ============================================================================
// app.ts me /api/v1/auth prefix lagega
// Order: middleware (rate limit → validate → auth) → controller
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { authRateLimit } from "../../middlewares/rate-limit.js";
import * as authController from "./auth.controller.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  changePasswordSchema,
} from "./auth.validator.js";

const router: Router = Router();

// ============================================================================
// PUBLIC ROUTES - rate limited (brute force prevention)
// ============================================================================

// POST /api/v1/auth/register
router.post(
  "/register",
  authRateLimit,
  validate(registerSchema),
  asyncHandler(authController.register),
);

// POST /api/v1/auth/login
router.post(
  "/login",
  authRateLimit,
  validate(loginSchema),
  asyncHandler(authController.login),
);

// POST /api/v1/auth/refresh
// Refresh pe strict rate limit nahi - automatic background calls hote hai
router.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(authController.refresh),
);

// ============================================================================
// PROTECTED ROUTES - requireAuth zaruri
// ============================================================================

router.post("/logout", requireAuth, asyncHandler(authController.logout));

router.post("/logout-all", requireAuth, asyncHandler(authController.logoutAll));

router.get("/me", requireAuth, asyncHandler(authController.me));

router.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);

export default router;
