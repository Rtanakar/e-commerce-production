// ============================================================================
// vendor.routes.ts - Seller onboarding endpoints
// ============================================================================
// Per-route auth gating:
//   - GET /onboarding-status : either auth scope (cust starts wizard, seller resumes)
//   - POST /upgrade-to-seller: CUSTOMER cookie scope (one-time role flip)
//   - POST /setup-shop       : SELLER cookie scope (s_at) - VENDOR enforced
//   - POST /connect-bank     : SELLER cookie scope
//
// Cookie isolation (Amazon Seller Central): /vendors/* are seller-portal
// endpoints, so we read from the s_at cookie jar, not the customer at cookie.
// This way logging out of /shop doesn't drop the seller session, and a stolen
// shop refresh token can't be used against /vendors/* routes.
// ============================================================================

import { Router } from "express";
import { asyncHandler } from "../../middlewares/async-handler.js";
import { validate } from "../../middlewares/validate.js";
import {
  requireAuth,
  requireSellerAuth,
  requireAnyAuth,
} from "../../middlewares/require-auth.js";
import { requireCsrf, requireSellerCsrf } from "../../middlewares/csrf.js";
import * as vendorController from "./vendor.controller.js";
import { setupShopSchema, connectBankSchema } from "./vendor.validator.js";

const router: Router = Router();

// ----- Status (dual-auth: accept either cookie jar) -----
// Anon → 401. Customer logged in → returns "upgrade". Seller logged in →
// returns current onboarding step. The controller branches on req.user.role.
//
// Auth resolution: try seller cookie first (so a customer-who-upgraded
// returns seller status), fall back to customer cookie. Implemented as
// requireAuth which reads the customer cookie - if user has both cookies
// and the seller flow is what we want, frontend should call from the seller
// portal which only sends seller cookies anyway.
// Dual-auth: works whether user has customer cookies (pre-upgrade) or seller
// cookies (post-register / post-upgrade). Service branches on role internally.
router.get(
  "/onboarding-status",
  requireAnyAuth,
  asyncHandler(vendorController.getOnboardingStatus),
);

// ----- Customer → Vendor role upgrade -----
// Uses CUSTOMER cookies (the user is currently a customer when this fires).
// Controller will ALSO emit seller cookies in addition to rotating customer
// session, so the user has both jars going forward (Amazon dual-session).
router.post(
  "/upgrade-to-seller",
  requireCsrf,
  requireAuth,
  asyncHandler(vendorController.upgradeToSeller),
);

// ----- VENDOR-only routes (seller cookie jar) -----
router.post(
  "/setup-shop",
  requireSellerCsrf,
  requireSellerAuth,
  validate(setupShopSchema),
  asyncHandler(vendorController.setupShop),
);

router.post(
  "/connect-bank",
  requireSellerCsrf,
  requireSellerAuth,
  validate(connectBankSchema),
  asyncHandler(vendorController.connectBank),
);

export default router;
