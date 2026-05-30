// ============================================================================
// vendor.validator.ts - Zod schemas for seller onboarding
// ============================================================================
// Single source of truth - TS types + runtime validation + OpenAPI metadata
// All endpoints in this module are VENDOR-role-gated (auth.middleware checks)
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================================
// Business types (must match Prisma enum or string union upstream)
// ============================================================================
export const businessTypeSchema = z.enum([
  "INDIVIDUAL",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "LLP",
]);

// ============================================================================
// SETUP SHOP - step 2 of seller onboarding
// ============================================================================
// Idempotent: PUT-like semantics. Creates vendor_profile if missing,
// updates if already exists (allows seller to edit during draft phase).
//
// Required fields: shopName (unique), category (free-text), address (basic)
// Optional: description, logo, banner, GST/PAN (compliance later)
// ============================================================================
export const setupShopSchema = z
  .object({
    shopName: z
      .string()
      .min(2, "Shop name must be at least 2 characters")
      .max(80)
      .trim()
      .openapi({ example: "Awesome Goods Store" }),
    description: z.string().max(500).trim().optional(),
    // Single primary category - real category tree comes later
    category: z.string().min(2).max(60).trim(),
    // Address as a single field for now (structured Address model exists
    // separately for shipping/billing). This is the shop's HQ address.
    address: z.string().min(5).max(500).trim(),
    logo: z.string().url().optional().openapi({
      description: "URL of shop logo (uploaded separately via /uploads)",
    }),
    banner: z.string().url().optional(),
    website: z.string().url().optional(),
    // Compliance - optional at this step, mandatory at "Connect Bank" step
    gstNumber: z
      .string()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GSTIN format",
      )
      .optional(),
    panNumber: z
      .string()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
      .optional(),
    businessType: businessTypeSchema.optional(),
  })
  .openapi("VendorSetupShopRequest");

// ============================================================================
// CONNECT BANK - step 3
// ============================================================================
// Two flows possible:
//   1. Direct bank input (India: account + IFSC) - simple but high PCI burden
//   2. Stripe Connect (account_link onboarding) - PCI offloaded to Stripe
//
// We support BOTH. Frontend chooses based on country/region.
// ============================================================================
export const connectBankDirectSchema = z
  .object({
    mode: z.literal("direct"),
    bankAccountName: z.string().min(2).max(120).trim(),
    bankAccountNumber: z
      .string()
      .regex(/^[0-9]{9,18}$/, "Invalid bank account number"),
    bankIfscCode: z
      .string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format")
      .openapi({ example: "HDFC0001234" }),
  })
  .openapi("VendorConnectBankDirectRequest");

export const connectBankStripeSchema = z
  .object({
    mode: z.literal("stripe"),
    // No payload - server generates Stripe Connect onboarding URL
  })
  .openapi("VendorConnectBankStripeRequest");

// Discriminated union - frontend picks mode, schema validates accordingly
export const connectBankSchema = z.discriminatedUnion("mode", [
  connectBankDirectSchema,
  connectBankStripeSchema,
]);

// ============================================================================
// Onboarding status - tells frontend WHICH step to land on
// ============================================================================
// Response shape: { currentStep, completedSteps, vendor }
// Used by frontend on /become-seller page load to resume the wizard.
// ============================================================================
export const onboardingStepSchema = z.enum([
  "account", // not yet registered OR registered but not email-verified
  "upgrade", // existing CUSTOMER - needs to confirm role flip first
  "blocked", // ADMIN - cannot become seller
  "shop", // VENDOR but no vendor_profile yet
  "bank", // shop set up, bank not connected
  "review", // submitted, awaiting admin approval (PENDING_REVIEW)
  "active", // APPROVED - full seller dashboard available
]);

export type SetupShopDto = z.infer<typeof setupShopSchema>;
export type ConnectBankDto = z.infer<typeof connectBankSchema>;
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;
