// ============================================================================
// vendor.repository.ts - DB access for vendor onboarding
// ============================================================================

import { prisma } from "../../db/prisma.js";

// ============================================================================
// findVendorProfile - by userId (1:1)
// ============================================================================
export async function findVendorProfile(userId: string) {
  return prisma.vendorProfile.findUnique({ where: { userId } });
}

// ============================================================================
// findVendorIdByUserId - userId → VendorProfile.id (catalog scoping ke liye)
// ============================================================================
// Product / discount modules ko vendorId chahiye (userId nahi). Light projection.
// ============================================================================
export async function findVendorIdByUserId(userId: string): Promise<string | null> {
  const v = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return v?.id ?? null;
}

// ============================================================================
// shopNameTaken - uniqueness check before create/update
// ============================================================================
// Excludes current userId so a vendor can re-save same name without conflict
// ============================================================================
export async function shopNameTaken(shopName: string, excludeUserId?: string): Promise<boolean> {
  const existing = await prisma.vendorProfile.findUnique({
    where: { shopName },
    select: { userId: true },
  });
  if (!existing) return false;
  if (excludeUserId && existing.userId === excludeUserId) return false;
  return true;
}

// ============================================================================
// upsertShop - create OR update vendor profile (idempotent step 2)
// ============================================================================
export async function upsertShop(
  userId: string,
  data: {
    shopName: string;
    shopSlug: string;
    description?: string;
    category?: string;
    address?: string;
    logo?: string;
    banner?: string;
    website?: string;
    gstNumber?: string;
    panNumber?: string;
    businessType?: string;
  },
) {
  return prisma.vendorProfile.upsert({
    where: { userId },
    create: {
      userId,
      shopName: data.shopName,
      shopSlug: data.shopSlug,
      description: data.description,
      logo: data.logo,
      banner: data.banner,
      gstNumber: data.gstNumber,
      panNumber: data.panNumber,
      businessType: data.businessType,
      status: "PENDING_REVIEW",
    },
    update: {
      shopName: data.shopName,
      shopSlug: data.shopSlug,
      description: data.description,
      logo: data.logo,
      banner: data.banner,
      gstNumber: data.gstNumber,
      panNumber: data.panNumber,
      businessType: data.businessType,
    },
  });
}

// ============================================================================
// updateBank - store bank details (step 3 direct mode)
// ============================================================================
// PRODUCTION: encrypt at column level (KMS) OR use Stripe Connect
// (the bank details never touch our DB). This is plaintext storage for dev.
// ============================================================================
export async function updateBank(
  userId: string,
  data: {
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfscCode: string;
  },
) {
  return prisma.vendorProfile.update({
    where: { userId },
    data: {
      bankAccountName: data.bankAccountName,
      bankAccountNumber: data.bankAccountNumber,
      bankIfscCode: data.bankIfscCode,
    },
  });
}
