// ============================================================================
// wishlist.service.ts - Wishlist business logic
// ============================================================================
// Toggle-friendly: add idempotent (already hai to wahi return), remove safe.
// ============================================================================

import * as wishlistRepo from "./wishlist.repository.js";
import { prisma } from "../../db/prisma.js";
import { BadRequestError, NotFoundError } from "../../utils/errors.js";
import type {
  AddToWishlistDto,
  RemoveFromWishlistDto,
  MergeWishlistDto,
} from "./wishlist.validator.js";

async function validateRef(productId: string, variantId: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, deletedAt: true },
  });
  // Wishlist me out-of-stock bhi allowed (save for later), par deleted/archived nahi
  if (!product || product.deletedAt || product.status === "DELETED" || product.status === "ARCHIVED") {
    throw new NotFoundError("Product");
  }
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true },
    });
    if (!variant || variant.productId !== productId) {
      throw new BadRequestError("Selected variant does not belong to this product");
    }
  }
}

// ── Full wishlist list ──
export async function getWishlist(userId: string) {
  const items = await wishlistRepo.listByUser(userId);
  return { items, count: items.length };
}

// ── Add (idempotent) ──
export async function addToWishlist(userId: string, dto: AddToWishlistDto) {
  await validateRef(dto.productId, dto.variantId ?? null);
  const existing = await wishlistRepo.findLine(userId, dto.productId, dto.variantId ?? null);
  if (!existing) {
    await wishlistRepo.createLine(userId, dto.productId, dto.variantId ?? null);
  }
  return getWishlist(userId);
}

// ── Remove (safe) ──
export async function removeFromWishlist(userId: string, dto: RemoveFromWishlistDto) {
  const existing = await wishlistRepo.findLine(userId, dto.productId, dto.variantId ?? null);
  if (existing) await wishlistRepo.deleteLine(existing.id);
  return getWishlist(userId);
}

// ── Toggle — heart click. Returns { wishlisted } + fresh list ──
export async function toggleWishlist(userId: string, dto: AddToWishlistDto) {
  const existing = await wishlistRepo.findLine(userId, dto.productId, dto.variantId ?? null);
  if (existing) {
    await wishlistRepo.deleteLine(existing.id);
    const wl = await getWishlist(userId);
    return { ...wl, wishlisted: false };
  }
  await validateRef(dto.productId, dto.variantId ?? null);
  await wishlistRepo.createLine(userId, dto.productId, dto.variantId ?? null);
  const wl = await getWishlist(userId);
  return { ...wl, wishlisted: true };
}

// ── Merge guest wishlist on login ──
export async function mergeWishlist(userId: string, dto: MergeWishlistDto) {
  for (const item of dto.items) {
    try {
      await addToWishlist(userId, { productId: item.productId, variantId: item.variantId ?? null });
    } catch {
      // unavailable item skip
    }
  }
  return getWishlist(userId);
}

// ── Light count (header badge) ──
export async function getCount(userId: string) {
  const count = await wishlistRepo.countByUser(userId);
  return { count };
}

// ── Product IDs (frontend "is wishlisted" hydration) ──
export async function getProductIds(userId: string) {
  const items = await wishlistRepo.listProductIds(userId);
  return { items };
}
