// ============================================================================
// cart.service.ts - Cart business logic
// ============================================================================
// Responsibilities:
//   - Product/variant existence + purchasable (ACTIVE) check
//   - Stock guard (cart qty kabhi available stock se zyada na ho)
//   - Variant product se match karta hai (kisi aur product ka variant na ho)
//   - Add = increment (existing line), setQty = absolute (0 → remove)
//   - Guest cart merge (login pe) — quantities add, stock pe clamp
//   - Live totals compute (effective price = variant price ?? product salePrice)
// ============================================================================

import * as cartRepo from "./cart.repository.js";
import { prisma } from "../../db/prisma.js";
import { BadRequestError, NotFoundError } from "../../utils/errors.js";
import type { AddToCartDto, SetQtyDto, RemoveFromCartDto, MergeCartDto } from "./cart.validator.js";

// ── Effective price: variant override ?? product salePrice (minor units) ──
function effectivePrice(line: {
  product: { salePrice: number };
  variant: { price: number | null } | null;
}): number {
  return line.variant?.price ?? line.product.salePrice;
}

// ── Available stock: variant stock (agar variant) warna product stock ──
function availableStock(p: { stock: number }, v: { stock: number } | null): number {
  return v ? v.stock : p.stock;
}

// ============================================================================
// Validate product + variant — purchasable hai, variant isi product ka hai
// ============================================================================
async function validateRef(productId: string, variantId: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true, deletedAt: true, stock: true },
  });
  if (!product || product.deletedAt || product.status !== "ACTIVE") {
    throw new NotFoundError("Product");
  }

  let variant: { id: string; productId: string; stock: number } | null = null;
  if (variantId) {
    variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, productId: true, stock: true },
    });
    if (!variant || variant.productId !== productId) {
      throw new BadRequestError("Selected variant does not belong to this product");
    }
  }

  return { product, variant };
}

// ============================================================================
// GET cart — lines + computed totals (frontend ek call me sab render kare)
// ============================================================================
export async function getCart(userId: string) {
  const lines = await cartRepo.listByUser(userId);

  let subtotal = 0; // minor units
  let mrpTotal = 0; // regularPrice ka total (saving dikhane ke liye)
  let totalItems = 0;

  const items = lines.map((line) => {
    const unit = effectivePrice(line);
    const mrp = line.product.regularPrice;
    subtotal += unit * line.quantity;
    mrpTotal += mrp * line.quantity;
    totalItems += line.quantity;
    return {
      ...line,
      unitPrice: unit,
      lineTotal: unit * line.quantity,
      availableStock: availableStock(line.product, line.variant),
    };
  });

  return {
    items,
    summary: {
      totalItems,
      totalLines: lines.length,
      subtotal,
      mrpTotal,
      savings: Math.max(0, mrpTotal - subtotal),
      currency: lines[0]?.product.currency ?? "INR",
    },
  };
}

// ============================================================================
// ADD (increment) — naya line ya existing qty + delta. Stock pe clamp.
// ============================================================================
export async function addToCart(userId: string, dto: AddToCartDto) {
  const { product, variant } = await validateRef(dto.productId, dto.variantId ?? null);
  const max = availableStock(product, variant);
  if (max <= 0) throw new BadRequestError("Product is out of stock");

  const existing = await cartRepo.findLine(userId, dto.productId, dto.variantId ?? null);
  const desired = (existing?.quantity ?? 0) + dto.quantity;
  const quantity = Math.min(desired, max); // stock se zyada na ho

  if (existing) {
    await cartRepo.updateQty(existing.id, quantity);
  } else {
    await cartRepo.createLine(userId, dto.productId, dto.variantId ?? null, quantity);
  }
  return getCart(userId);
}

// ============================================================================
// SET absolute quantity — 0 = remove line. Stock pe clamp.
// ============================================================================
export async function setQuantity(userId: string, dto: SetQtyDto) {
  const existing = await cartRepo.findLine(userId, dto.productId, dto.variantId ?? null);

  if (dto.quantity === 0) {
    if (existing) await cartRepo.deleteLine(existing.id);
    return getCart(userId);
  }

  const { product, variant } = await validateRef(dto.productId, dto.variantId ?? null);
  const max = availableStock(product, variant);
  if (max <= 0) throw new BadRequestError("Product is out of stock");
  const quantity = Math.min(dto.quantity, max);

  if (existing) {
    await cartRepo.updateQty(existing.id, quantity);
  } else {
    await cartRepo.createLine(userId, dto.productId, dto.variantId ?? null, quantity);
  }
  return getCart(userId);
}

// ============================================================================
// REMOVE one line
// ============================================================================
export async function removeFromCart(userId: string, dto: RemoveFromCartDto) {
  const existing = await cartRepo.findLine(userId, dto.productId, dto.variantId ?? null);
  if (existing) await cartRepo.deleteLine(existing.id);
  return getCart(userId);
}

// ============================================================================
// CLEAR cart
// ============================================================================
export async function clearCart(userId: string) {
  await cartRepo.clearUser(userId);
  return getCart(userId);
}

// ============================================================================
// MERGE guest cart (login pe) — har item add (increment), invalid skip
// ============================================================================
// Best-effort: out-of-stock / deleted products silently skip ho jaate (guest ne
// jo localStorage me purana rakha ho). Baaki sab merge + stock clamp.
// ============================================================================
export async function mergeCart(userId: string, dto: MergeCartDto) {
  for (const item of dto.items) {
    try {
      await addToCart(userId, {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
      });
    } catch {
      // invalid/unavailable item skip — merge kabhi fail na ho
    }
  }
  return getCart(userId);
}

// ── Lightweight count (header badge) ──
export async function getCount(userId: string) {
  const count = await cartRepo.countByUser(userId);
  return { count };
}
