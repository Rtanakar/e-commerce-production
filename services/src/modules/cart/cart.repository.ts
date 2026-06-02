// ============================================================================
// cart.repository.ts - DB access for cart (NO business logic)
// ============================================================================
// variantId nullable hai, isliye Prisma ke compound-unique (userId_productId_
// variantId) ko hum manually findFirst se handle karte hain — Postgres me NULL
// !=  NULL hota hai, to upsert-on-null reliable nahi. findFirst + create/update.
// ============================================================================

import { prisma } from "../../db/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

// Cart line ke saath product + variant ki live info (price/stock/image/title)
// taaki frontend ko ek hi call me poora cart render karne ka data mile.
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
    select: {
      id: true,
      title: true,
      color: true,
      price: true,
      stock: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true, alt: true },
      },
    },
  },
} as const satisfies Prisma.CartItemInclude;

export async function listByUser(userId: string) {
  return prisma.cartItem.findMany({
    where: { userId },
    include: LINE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

// variantId null-safe lookup (compound unique NULL ke saath kaam nahi karta)
export async function findLine(userId: string, productId: string, variantId: string | null) {
  return prisma.cartItem.findFirst({
    where: { userId, productId, variantId: variantId ?? null },
  });
}

export async function createLine(
  userId: string,
  productId: string,
  variantId: string | null,
  quantity: number,
) {
  return prisma.cartItem.create({
    data: { userId, productId, variantId: variantId ?? null, quantity },
    include: LINE_INCLUDE,
  });
}

export async function updateQty(id: string, quantity: number) {
  return prisma.cartItem.update({ where: { id }, data: { quantity }, include: LINE_INCLUDE });
}

export async function deleteLine(id: string) {
  return prisma.cartItem.delete({ where: { id } });
}

export async function clearUser(userId: string) {
  return prisma.cartItem.deleteMany({ where: { userId } });
}

export async function countByUser(userId: string) {
  // distinct lines nahi, total quantity chahiye badge ke liye
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    select: { quantity: true },
  });
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}
