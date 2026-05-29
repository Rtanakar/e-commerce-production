// ============================================================================
// verify-otp.ts — Verify OTP Zod schema
// ============================================================================

import { z } from "zod";

export const verifyOtpFormSchema = z.object({
  email: z.string().email("Invalid email").toLowerCase().trim(),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must contain only digits"),
});

export type VerifyOtpFormValues = z.infer<typeof verifyOtpFormSchema>;
