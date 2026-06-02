// ============================================================================
// cart.validator.ts - Zod schemas for customer cart
// ============================================================================
// Cart logged-in customer ka server-side hota hai. Guest cart client (Zustand +
// localStorage) me rehta; login pe `merge` endpoint se server me aata hai.
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// productId + optional variantId (color/size choice). variantId null = base product.
const itemRef = {
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().nullable(),
};

// ── Add / increment ──
export const addToCartSchema = z
  .object({
    ...itemRef,
    // kitne add karne hain (default 1). Absolute set ke liye setQty use karo.
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .openapi("AddToCartRequest");

// ── Absolute quantity set (stepper "3" type karna) — 0 = remove ──
export const setQtySchema = z
  .object({
    ...itemRef,
    quantity: z.number().int().min(0).max(99),
  })
  .openapi("SetCartQtyRequest");

// ── Remove ek line ──
export const removeFromCartSchema = z.object(itemRef).openapi("RemoveFromCartRequest");

// ── Guest cart merge (login ke baad localStorage → server) ──
export const mergeCartSchema = z
  .object({
    items: z
      .array(
        z.object({
          ...itemRef,
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .max(100), // sane cap
  })
  .openapi("MergeCartRequest");

export type AddToCartDto = z.infer<typeof addToCartSchema>;
export type SetQtyDto = z.infer<typeof setQtySchema>;
export type RemoveFromCartDto = z.infer<typeof removeFromCartSchema>;
export type MergeCartDto = z.infer<typeof mergeCartSchema>;
