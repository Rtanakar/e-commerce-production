// ============================================================================
// wishlist.repository.ts - DB access for wishlist (NO business logic)
// ============================================================================

import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

// Wishlist card render karne ke liye product + variant ki light info
const LINE_INCLUDE = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      brand: true,
      currency: true,
      regularPrice: true,
      salePrice: true,
      discountPercent: true,
      stock: true,
      status: true,
      images: {
        orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
        take: 1,
        select: { url: true, alt: true },
      },
    },
  },
  variant: {
    select: { id: true, title: true, color: true, price: true, stock: true },
  },
} as const satisfies Prisma.WishlistItemInclude;

export async function listByUser(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    include: LINE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function findLine(userId: string, productId: string, variantId: string | null) {
  return prisma.wishlistItem.findFirst({
    where: { userId, productId, variantId: variantId ?? null },
  });
}

export async function createLine(userId: string, productId: string, variantId: string | null) {
  return prisma.wishlistItem.create({
    data: { userId, productId, variantId: variantId ?? null },
    include: LINE_INCLUDE,
  });
}

export async function deleteLine(id: string) {
  return prisma.wishlistItem.delete({ where: { id } });
}

export async function countByUser(userId: string) {
  return prisma.wishlistItem.count({ where: { userId } });
}

// IDs only — frontend "is this product wishlisted?" fast check ke liye
export async function listProductIds(userId: string) {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    select: { productId: true, variantId: true },
  });
  return rows;
}
