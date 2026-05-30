// ============================================================================
// vendor.controller.ts - HTTP layer for seller onboarding
// ============================================================================

import type { Request, Response } from "express";
import * as vendorService from "./vendor.service.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { setAuthCookies } from "../../utils/cookies.js";
import type { SetupShopDto, ConnectBankDto } from "./vendor.validator.js";

// ============================================================================
// GET /vendors/onboarding-status - which step to resume on?
// ============================================================================
export async function getOnboardingStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const result = await vendorService.getOnboardingStatus(req.user.sub);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success(result),
    requestId: req.id,
  });
}

// ============================================================================
// POST /vendors/upgrade-to-seller - CUSTOMER → VENDOR + mint seller session
// ============================================================================
// Issues a SECOND set of cookies (s_at / s_rt / s_csrf) on top of the existing
// customer cookies. Customer session is NOT revoked — Amazon-style dual jar.
// Frontend should refresh the customer /me query so its role claim catches up.
// ============================================================================
export async function upgradeToSeller(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const fresh = await vendorService.upgradeToSeller(req.user.sub, req.user.sid);

  // Emit SELLER cookies (s_at / s_rt / s_csrf) — controller's job, not the
  // service. Customer cookies untouched (req.user came from `at` cookie).
  setAuthCookies(
    res,
    {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      sid: fresh.sid,
    },
    "seller",
  );

  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      role: "VENDOR",
      message: "Account upgraded. Continue to set up your shop.",
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /vendors/setup-shop - step 2
// ============================================================================
export async function setupShop(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const vendor = await vendorService.setupShop(req.user.sub, req.body as SetupShopDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      vendor,
      message: "Shop setup complete. Connect a bank account to start selling.",
    }),
    requestId: req.id,
  });
}

// ============================================================================
// POST /vendors/connect-bank - step 3
// ============================================================================
export async function connectBank(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const result = await vendorService.connectBank(req.user.sub, req.body as ConnectBankDto);
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      ...result,
      message:
        result.mode === "direct"
          ? "Bank connected. Your shop is now under review."
          : "Continue to Stripe to complete bank setup.",
    }),
    requestId: req.id,
  });
}
