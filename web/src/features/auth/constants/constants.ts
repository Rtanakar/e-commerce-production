// ============================================================================
// constants.ts — Form default values + shared rules
// ============================================================================

import type { SignInFormValues } from "../validators/signin";
import type { SignUpFormValues } from "../validators/signup";
import type { ForgotPasswordValues } from "../validators/forgot-password";
import type { ResetPasswordValues } from "../validators/reset-password";
import type { VerifyOtpFormValues } from "../validators/verify-otp";

export const signInDefaultValues: SignInFormValues = {
  email: "",
  password: "",
};

export const signUpDefaultValues: SignUpFormValues = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "CUSTOMER",
};

export const forgotPasswordDefaultValues: ForgotPasswordValues = {
  email: "",
};

export const resetPasswordDefaultValues: ResetPasswordValues = {
  email: "",
  otp: "",
  newPassword: "",
  confirmPassword: "",
};

export const verifyOtpDefaultValues: VerifyOtpFormValues = {
  email: "",
  otp: "",
};

// ============================================================================
// Password strength rules — used in signup + reset-password meters
// ============================================================================
export const passwordRules = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];
