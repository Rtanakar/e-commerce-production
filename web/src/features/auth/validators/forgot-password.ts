// ============================================================================
// forgot-password.ts — Forgot password Zod schema
// ============================================================================

import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
