// ============================================================================
// vendor.service.ts - Seller onboarding business logic
// ============================================================================

import * as vendorRepo from "./vendor.repository.js";
import * as authRepo from "../auth/auth.repository.js";
import { prisma } from "../../db/prisma.js";
import * as tokens from "../../lib/tokens.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import type { SetupShopDto, ConnectBankDto, OnboardingStep } from "./vendor.validator.js";

// ============================================================================
// slugify - shop name → URL slug
// ============================================================================
// "Awesome Goods!!" → "awesome-goods"
// Append last 6 of userId for uniqueness collision-resistance.
// ============================================================================
function slugify(input: string, userId: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base}-${userId.slice(-6)}`;
}

// ============================================================================
// getOnboardingStatus - which step is the seller on?
// ============================================================================
// Driven entirely by DB state - no client-trusted "currentStep" parameter.
// Frontend calls this to resume the wizard at the right step.
// ============================================================================
export async function getOnboardingStatus(userId: string): Promise<{
  currentStep: OnboardingStep;
  vendor: Awaited<ReturnType<typeof vendorRepo.findVendorProfile>>;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
}> {
  // findUserByIdSafe returns emailVerified + role + status (richer projection)
  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");

  // Step 0 - account exists but email not verified yet
  if (!user.emailVerified) {
    return { currentStep: "account", vendor: null, role: user.role };
  }

  // Customer that hasn't upgraded yet - show upgrade confirmation step
  if (user.role === "CUSTOMER") {
    return { currentStep: "upgrade", vendor: null, role: "CUSTOMER" };
  }

  // ADMIN cannot become a seller - block at controller layer for nicer UX
  if (user.role === "ADMIN") {
    return { currentStep: "blocked", vendor: null, role: "ADMIN" };
  }

  const vendor = await vendorRepo.findVendorProfile(userId);

  // Step 2 not done: no vendor_profile created yet
  if (!vendor) {
    return { currentStep: "shop", vendor: null, role: "VENDOR" };
  }

  // Step 3 not done: shop exists but no bank details
  if (!vendor.bankAccountNumber) {
    return { currentStep: "bank", vendor, role: "VENDOR" };
  }

  // Step 3 done: bank attached. APPROVED → active dashboard, else awaiting review
  if (vendor.status === "APPROVED") {
    return { currentStep: "active", vendor, role: "VENDOR" };
  }

  return { currentStep: "review", vendor, role: "VENDOR" };
}

// ============================================================================
// upgradeToSeller - flip CUSTOMER role to VENDOR + mint a seller session
// ============================================================================
// Amazon Seller Central / Flipkart Seller Hub pattern: same User row, role
// upgraded, customer session PRESERVED (they can still shop), and a brand-new
// VENDOR session created for the seller cookie jar (s_at / s_rt / s_csrf).
//
// Dual-session outcome after this call:
//   • Customer cookie jar (at/rt/csrf) → still active, role claim refreshes
//     to VENDOR on next /auth/refresh (DB is source of truth)
//   • Seller cookie jar (s_at/s_rt/s_csrf) → fresh session, controller emits
//
// Safety:
//   - ADMIN cannot become seller (separation of duties)
//   - VENDOR is no-op (idempotent retry-safe — controller still re-issues
//     seller cookies so the user can resume from any device)
//   - email-verified required
// ============================================================================
export async function upgradeToSeller(
  userId: string,
  // Customer's current sid - accepted for signature symmetry / future use
  // (could be used to log "upgraded from session X" audit trail). We DO NOT
  // revoke it - that would log the user out of /shop.
  _oldSid: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  sid: string;
}> {
  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");

  if (user.role === "ADMIN") {
    throw new ForbiddenError(
      "Admin accounts cannot be converted to seller accounts",
    );
  }

  if (!user.emailVerified) {
    throw new ForbiddenError(
      "Please verify your email before becoming a seller",
    );
  }

  // Idempotent — already VENDOR? Skip DB write, but still mint seller session
  // so a logged-in vendor on another device hitting /upgrade gets seller cookies.
  if (user.role !== "VENDOR") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "VENDOR" },
    });
    logger.info({ userId }, "User upgraded CUSTOMER → VENDOR");
  }

  // Mint a NEW session with VENDOR role — this populates the seller cookie
  // jar in the controller. Customer cookie jar (old sid) is untouched.
  // Scope="seller" → tokens signed with JWT_SELLER_ACCESS_SECRET /
  // JWT_SELLER_REFRESH_SECRET. Customer key compromise cannot forge these.
  const fresh = await tokens.createSession(
    {
      id: user.id,
      email: user.email,
      role: "VENDOR",
    },
    {},
    "seller",
  );

  logger.info({ userId, sellerSid: fresh.sid }, "Seller session minted");
  return fresh;
}

// ============================================================================
// setupShop - step 2 (idempotent: PUT-like)
// ============================================================================
// Preconditions:
//   - User exists and is VENDOR role (route gate via requireRole)
//   - User email verified (status=ACTIVE) - else 403 "verify first"
//   - Shop name globally unique (excluding self)
// ============================================================================
export async function setupShop(userId: string, input: SetupShopDto) {
  const user = await authRepo.findUserByIdSafe(userId);
  if (!user) throw new NotFoundError("User");

  if (user.role !== "VENDOR") {
    throw new ForbiddenError("Only sellers can set up a shop");
  }

  if (!user.emailVerified) {
    throw new ForbiddenError(
      "Please verify your email before setting up your shop",
    );
  }

  // Uniqueness check - exclude self so re-save with same name works
  const taken = await vendorRepo.shopNameTaken(input.shopName, userId);
  if (taken) {
    throw new BadRequestError("This shop name is already taken");
  }

  const slug = slugify(input.shopName, userId);
  const vendor = await vendorRepo.upsertShop(userId, {
    shopName: input.shopName,
    shopSlug: slug,
    description: input.description,
    category: input.category,
    address: input.address,
    logo: input.logo,
    banner: input.banner,
    website: input.website,
    gstNumber: input.gstNumber,
    panNumber: input.panNumber,
    businessType: input.businessType,
  });

  logger.info({ userId, shopId: vendor.id }, "Vendor shop setup");
  return vendor;
}

// ============================================================================
// connectBank - step 3
// ============================================================================
// MVP: direct bank input. Stripe Connect flow returns an onboarding URL
// (real Stripe SDK integration deferred).
// ============================================================================
export async function connectBank(
  userId: string,
  input: ConnectBankDto,
): Promise<{ mode: "direct" | "stripe"; onboardingUrl?: string }> {
  const vendor = await vendorRepo.findVendorProfile(userId);
  if (!vendor) {
    throw new BadRequestError("Please complete shop setup first");
  }

  if (input.mode === "direct") {
    await vendorRepo.updateBank(userId, {
      bankAccountName: input.bankAccountName,
      bankAccountNumber: input.bankAccountNumber,
      bankIfscCode: input.bankIfscCode,
    });
    logger.info({ userId }, "Vendor bank connected (direct)");
    return { mode: "direct" };
  }

  // Stripe Connect mode - stub
  // PRODUCTION:
  //   1. Create Stripe Connect Express account (stripe.accounts.create)
  //   2. Generate account_link (stripe.accountLinks.create) with refresh_url + return_url
  //   3. Persist stripeAccountId on vendor_profile
  //   4. Return onboardingUrl - frontend redirects user there
  //   5. Stripe webhook (account.updated) marks bank as connected
  logger.info({ userId }, "Vendor bank connect requested (stripe mode - stub)");
  return {
    mode: "stripe",
    onboardingUrl: "/become-seller?step=bank&stripe=pending",
  };
}
