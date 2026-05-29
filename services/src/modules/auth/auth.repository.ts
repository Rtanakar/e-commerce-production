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
  shopName?: string; // VENDOR only
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role,
        // New user → PENDING_VERIFICATION until email verified
        status: "PENDING_VERIFICATION",
      },
      select: {
        id: true,
        email: true,
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

    if (data.role === "VENDOR") {
      const shopName = data.shopName ?? `${data.name}'s Shop`;
      await tx.vendorProfile.create({
        data: {
          userId: user.id,
          shopName,
          shopSlug: slugify(`${shopName}-${user.id.slice(-6)}`),
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
