// ============================================================================
// signup.ts — Sign-up form Zod schema
// ============================================================================
// Backend: name + email + password (+ role + shopName for VENDOR)
// Confirm password kept for UX (visual confirmation reduces typo accounts)
// ============================================================================

import { z } from "zod";

export const signUpFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name is required")
      .min(2, "Name must be at least 2 characters")
      .max(60, "Name must be less than 60 characters")
      .trim(),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address")
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/\d/, "Must contain at least one number")
      .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    // No .default() here - keeps z.input === z.output (RHF type alignment)
    // Default value provided via `signUpDefaultValues` in constants
    role: z.enum(["CUSTOMER", "VENDOR"]),
    shopName: z.string().min(2).max(100).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role !== "VENDOR" || !!data.shopName, {
    error: "Shop name is required for vendor signup",
    path: ["shopName"],
  });

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
