// ============================================================================
// auth.repository.ts - Data access layer (function-based Repository)
// ============================================================================
// Repository pattern - SOLID's Single Responsibility
//   Repository = DB queries only
//   Service    = business logic
//   Controller = HTTP concerns
//
// Industry convention (Express ecosystem): named function exports
// Stateless functions - DB client se direct interaction
// Class wrapping unnecessary - prisma already singleton
//
// Why repo separate?
//   - Service tests me prisma mock karna easy
//   - Future me DB switch (Postgres → MongoDB) to sirf repo badle
// ============================================================================

import { prisma } from "../../db/prisma.js";
import type { UserRole } from "@prisma/client";

// ============================================================================
// Find user by email (login flow - full object with password hash)
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
      createdAt: true,
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
    select: { id: true, email: true, password: true },
  });
}

// ============================================================================
// Check email exists - register pre-check
// ============================================================================
// findUnique with select id - sirf existence check, full row fetch nahi
// Performance: minimal data transfer
// ============================================================================
export async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user !== null;
}

// ============================================================================
// Create user - with optional vendor profile (transaction)
// ============================================================================
// Atomic: agar vendor profile create fail ho to user bhi rollback
// Prisma $transaction - ACID guarantees
// ============================================================================
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Vendor profile auto-create with default values
    // isVerified false - admin manual approve karega
    if (user.role === "VENDOR") {
      await tx.vendorProfile.create({
        data: {
          userId: user.id,
          shopName: `${user.name ?? user.email}'s Shop`,
          shopSlug: `shop-${user.id.slice(-8)}`,
        },
      });
    }

    return user;
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
// Soft delete - data preserve compliance ke liye
// ============================================================================
export async function softDeleteUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { status: "DELETED", deletedAt: new Date() },
    select: { id: true },
  });
}
