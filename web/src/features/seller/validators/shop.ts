// ============================================================================
// shop.ts — Step 2 (Setup Shop) Zod schema
// ============================================================================
// Optional fields use .refine() instead of transforms so RHF resolver
// input/output types stay aligned. Empty strings → coerced to undefined at
// submit-time in the component, not via Zod transform.
// ============================================================================

import { z } from "zod";

export const shopFormSchema = z.object({
  shopName: z
    .string()
    .min(1, "Shop name is required")
    .min(2, "Shop name must be at least 2 characters")
    .max(80, "Shop name must be less than 80 characters"),
  category: z.string().min(2, "Pick a category"),
  description: z.string().max(500).optional().or(z.literal("")),
  address: z
    .string()
    .min(5, "Address is required")
    .max(500, "Address must be less than 500 characters"),
  website: z
    .string()
    .refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Invalid URL")
    .optional(),
  // GSTIN: 2-digit state + 5 letters + 4 digits + 1 letter + 1 alphanumeric + "Z" + 1 alphanumeric
  gstNumber: z
    .string()
    .refine(
      (v) =>
        v === "" ||
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
      "Invalid GSTIN",
    )
    .optional(),
  // PAN: 5 letters + 4 digits + 1 letter
  panNumber: z
    .string()
    .refine(
      (v) => v === "" || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v),
      "Invalid PAN",
    )
    .optional(),
});

export type ShopFormValues = z.infer<typeof shopFormSchema>;
