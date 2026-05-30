// ============================================================================
// bank.ts — Step 3 (Connect Bank) Zod schema
// ============================================================================
// Only "direct" mode is form-validated. Stripe mode is a redirect handoff
// (no fields), validated server-side via Stripe webhook later.
// IFSC pattern: 4-letter bank code + "0" + 6-char branch code (RBI standard).
// ============================================================================

import { z } from "zod";

export const bankDirectFormSchema = z.object({
  bankAccountName: z
    .string()
    .min(1, "Account holder name is required")
    .min(2, "Account holder name must be at least 2 characters"),
  bankAccountNumber: z
    .string()
    .min(1, "Account number is required")
    .regex(/^[0-9]{9,18}$/, "Invalid account number"),
  bankIfscCode: z
    .string()
    .min(1, "IFSC is required")
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"),
});

export type BankDirectFormValues = z.infer<typeof bankDirectFormSchema>;
