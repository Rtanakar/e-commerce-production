// ============================================================================
// signin.ts — Seller sign-in form schema
// ============================================================================
// Returning sellers (already onboarded) authenticate here. Sets the seller
// cookie jar (seller-access-token / seller-refresh-token / seller-csrf-token).
// ============================================================================

import { z } from "zod";

export const sellerSignInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email")
    .toLowerCase()
    .trim(),
  password: z.string().min(1, "Password is required"),
});

export type SellerSignInValues = z.infer<typeof sellerSignInSchema>;
