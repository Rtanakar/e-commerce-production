// ============================================================================
// wishlist.validator.ts - Zod schemas for customer wishlist
// ============================================================================
// Wishlist = "save for later" bookmark (heart icon). Quantity nahi.
// ============================================================================

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const itemRef = {
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional().nullable(),
};

export const addToWishlistSchema = z.object(itemRef).openapi("AddToWishlistRequest");
export const removeFromWishlistSchema = z.object(itemRef).openapi("RemoveFromWishlistRequest");

// Guest wishlist merge on login
export const mergeWishlistSchema = z
  .object({ items: z.array(z.object(itemRef)).max(200) })
  .openapi("MergeWishlistRequest");

export type AddToWishlistDto = z.infer<typeof addToWishlistSchema>;
export type RemoveFromWishlistDto = z.infer<typeof removeFromWishlistSchema>;
export type MergeWishlistDto = z.infer<typeof mergeWishlistSchema>;
