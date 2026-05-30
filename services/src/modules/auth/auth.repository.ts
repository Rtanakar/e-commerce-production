// ============================================================================
// auth.repository.ts - Data access layer
// ============================================================================
// Repository = DB queries only
// Service    = business logic
// Controller = HTTP concerns
//
// Industry convention (Express): named function exports - stateless
// Prisma already singleton, no class wrapping needed
// ============================================================================

import { prisma } from "../../db/prisma.js";
import type { UserRole } from "../../generated/prisma/client.js";

// ============================================================================
// Find user by email (login flow - includes password hash)
// ============================================================================
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

// ============================================================================
// Find user by id - safe fields (no password) - "me" endpoint
// ============================================================================
export async function findUserByIdSafe(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      image: true,
      emailVerified: true,
      phoneVerified: true,
      lastLoginAt: true,
      createdAt: true,
      vendorProfile: {
        select: {
          shopName: true,
          shopSlug: true,
          status: true,
          verifiedAt: true,
        },
      },
    },
  });
}

// ============================================================================
// Find user by id - minimal auth fields (refresh flow)
// ============================================================================
export async function findUserByIdForAuth(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
}

// ============================================================================
// Find user by id - WITH password (change-password flow)
// ============================================================================
export async function findUserByIdWithPassword(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, password: true },
  });
}

// ============================================================================
// Check email exists - register pre-check
// ============================================================================
export async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user !== null;
}

// ============================================================================
// Create user - with role-specific profile (transactional)
// ============================================================================
// CUSTOMER → CustomerProfile (default opt-ins)
// VENDOR   → VendorProfile (PENDING_REVIEW status)
// ============================================================================
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string; // E.164 format, e.g. "+919876543210"
  shopName?: string; // VENDOR only
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role,
        // Phone is OPTIONAL on User but @unique - skip writing empty/null so
        // multiple users without phone don't collide on the unique index.
        // (Postgres treats multiple nulls as distinct, but being explicit
        // here avoids `undefined` surprise on Prisma's side.)
        ...(data.phone ? { phone: data.phone } : {}),
        // New user → PENDING_VERIFICATION until email verified.
        // phoneVerified intentionally NULL — SMS OTP flow can set it later.
        status: "PENDING_VERIFICATION",
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (data.role === "CUSTOMER") {
      await tx.customerProfile.create({
        data: { userId: user.id },
      });
    }

    // VENDOR role: vendor_profile NOT created here. Seller onboarding flow
    // creates it in step 2 (POST /vendors/setup-shop) - matches Amazon Seller
    // Central / Flipkart Seller Hub / Shopify Partners pattern.
    //
    // Backward-compatible escape hatch: if shopName was explicitly provided
    // (legacy callers / seed scripts / direct admin create), still create it.
    if (data.role === "VENDOR" && data.shopName) {
      await tx.vendorProfile.create({
        data: {
          userId: user.id,
          shopName: data.shopName,
          shopSlug: slugify(`${data.shopName}-${user.id.slice(-6)}`),
          status: "PENDING_REVIEW",
        },
      });
    }

    return user;
  });
}

// ============================================================================
// Mark email verified - OTP/link verify flow
// ============================================================================
export async function markEmailVerified(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: new Date(),
      // PENDING → ACTIVE jab email verify ho
      status: "ACTIVE",
    },
    select: { id: true, status: true },
  });
}

// ============================================================================
// Phone verification helpers
// ============================================================================
// phoneExists - is this E.164 number already on ANOTHER user? (unique index)
// excludeUserId lets the same user re-verify their own number without a clash.
export async function phoneExists(
  phone: string,
  excludeUserId?: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (!user) return false;
  return excludeUserId ? user.id !== excludeUserId : true;
}

// updateUserPhone - set/replace a user's phone (resets phoneVerified to NULL
// since the new number is unverified until OTP succeeds).
export async function updateUserPhone(userId: string, phone: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { phone, phoneVerified: null },
    select: { id: true, phone: true },
  });
}

// markPhoneVerified - stamp phoneVerified after successful SMS OTP.
// Does NOT touch `status` (email verification owns the PENDING→ACTIVE flip).
export async function markPhoneVerified(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { phoneVerified: new Date() },
    select: { id: true, phoneVerified: true },
  });
}

// ============================================================================
// Update password
// ============================================================================
export async function updateUserPassword(id: string, passwordHash: string) {
  return prisma.user.update({
    where: { id },
    data: { password: passwordHash },
    select: { id: true },
  });
}

// ============================================================================
// Update last login - audit trail
// ============================================================================
export async function updateLastLogin(id: string, ip: string | null) {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    },
    select: { id: true },
  });
}

// ============================================================================
// OAuth: find user by provider + providerAccountId
// ============================================================================
// Lookup via OAuthAccount table - one provider account = one user.
// Returns null if not linked.
// ============================================================================
export async function findUserByOAuth(
  provider: string,
  providerAccountId: string,
) {
  const account = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, status: true },
      },
    },
  });
  return account?.user ?? null;
}

// ============================================================================
// OAuth: link existing user to provider (for account merging)
// ============================================================================
export async function linkOAuthAccount(input: {
  userId: string;
  provider: string;
  providerAccountId: string;
  email?: string;
  name?: string;
  image?: string;
}) {
  return prisma.oAuthAccount.create({
    data: input,
  });
}

// ============================================================================
// OAuth: create new user from OAuth profile (auto-verified email)
// ============================================================================
// Google has already verified the email - we trust it and skip OTP step.
// Industry: all OAuth providers do this (Google/GitHub vetted emails).
// ============================================================================
export async function createUserFromOAuth(input: {
  email: string;
  name: string;
  image?: string;
  provider: string;
  providerAccountId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        image: input.image,
        // OAuth users have no password (signin via provider only)
        password: null,
        // Email verified by Google - skip PENDING_VERIFICATION
        emailVerified: new Date(),
        status: "ACTIVE",
        role: "CUSTOMER",
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    // Link the OAuth identity
    await tx.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        email: input.email,
        name: input.name,
        image: input.image,
      },
    });

    // Auto-create customer profile
    await tx.customerProfile.create({ data: { userId: user.id } });

    return user;
  });
}

// ============================================================================
// Soft delete
// ============================================================================
export async function softDeleteUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "DELETED", deletedAt: new Date() },
    select: { id: true },
  });
}

// ============================================================================
// Helper: URL-safe slug
// ============================================================================
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
