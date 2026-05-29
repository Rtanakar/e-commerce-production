// ============================================================================
// signin.ts — Sign-in form Zod schema
// ============================================================================

import { z } from "zod";

export const signInFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;
