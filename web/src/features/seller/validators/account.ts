// ============================================================================
// account.ts — Step 1 (Create Account) Zod schema
// ============================================================================
// Mirrors backend registerSchema but adds frontend-only UX:
//   - phone is national-number only (no dial prefix) — combined with country
//     dial-code at submit time to form E.164 ("+91...").
//   - country is required here (backend treats it as optional default IN, but
//     UX-wise seller MUST pick to drive currency/tax later).
// ============================================================================

import { z } from "zod";

export const accountFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email")
    .toLowerCase()
    .trim(),
  // National number only — country code prepended on submit
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^[0-9]{7,14}$/, "7-14 digit phone number"),
  // ISO-3166 alpha-2 (e.g. "IN", "US")
  country: z.string().length(2, "Pick your country"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "At least 8 characters")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number")
    .regex(/[^a-zA-Z0-9]/, "Must include a special character"),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;
