// ============================================================================
// seller/api.ts - Seller onboarding endpoint calls
// ============================================================================

import { api } from "../api";
import { sellerHttp } from "../seller-auth/api";

// Mirrors backend Prisma types (subset that frontend needs)
export type VendorStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type OnboardingStep =
  | "account"  // anon or unverified
  | "upgrade"  // customer needs role flip
  | "blocked"  // admin - cannot become seller
  | "shop"     // vendor without profile yet
  | "bank"     // shop done, bank pending
  | "review"   // submitted, awaiting admin
  | "active";  // approved seller

export interface VendorProfile {
  id: string;
  userId: string;
  shopName: string;
  shopSlug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  businessType: string | null;
  status: VendorStatus;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;
  bankAccountName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingStatus {
  currentStep: OnboardingStep;
  vendor: VendorProfile | null;
  role: "CUSTOMER" | "VENDOR" | "ADMIN";
}

export interface SetupShopInput {
  shopName: string;
  description?: string;
  category: string;
  address: string;
  logo?: string;
  banner?: string;
  website?: string;
  gstNumber?: string;
  panNumber?: string;
  businessType?: string;
}

export type ConnectBankInput =
  | {
      mode: "direct";
      bankAccountName: string;
      bankAccountNumber: string;
      bankIfscCode: string;
    }
  | { mode: "stripe" };

// ============================================================================
// Cookie-jar routing per endpoint (Amazon-style two-jar auth)
// ============================================================================
// /vendors/upgrade-to-seller is called BEFORE the user has seller cookies —
//   uses the customer client (sends `at` + `csrf`). Backend mints + sets
//   seller cookies on the response.
// All other /vendors/* endpoints are post-upgrade or post-register and run
//   on the seller cookie jar (s_at + s_csrf), so we use sellerHttp there.
// ============================================================================
export const sellerApi = {
  // Reads from seller cookies. Backend requireAuth fallback handles the
  // brief window during upgrade where only customer cookies exist (server
  // returns "upgrade" step for CUSTOMER role).
  getStatus: () =>
    sellerHttp.get<OnboardingStatus>("/vendors/onboarding-status"),

  // Customer → Vendor flip — uses customer client (still on customer cookies
  // at this point). Backend rotates DB role + sets fresh s_* cookies in the
  // response. After this call, user has BOTH jars.
  upgradeToSeller: () =>
    api.post<{ role: "VENDOR"; message: string }>(
      "/vendors/upgrade-to-seller",
    ),

  setupShop: (input: SetupShopInput) =>
    sellerHttp.post<{ vendor: VendorProfile; message: string }>(
      "/vendors/setup-shop",
      input,
    ),

  connectBank: (input: ConnectBankInput) =>
    sellerHttp.post<{
      mode: "direct" | "stripe";
      onboardingUrl?: string;
      message: string;
    }>("/vendors/connect-bank", input),
};
