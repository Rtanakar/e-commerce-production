// ============================================================================
// templates.ts - Typed wrappers around EJS templates
// ============================================================================
// Why wrappers?
//   - Type-safe inputs (callers don't pass raw object to EJS)
//   - Subject lines colocated with template (single source of truth)
//   - Preheader text (inbox preview) defined per template
//   - Callers can swap to React Email later WITHOUT changing call sites
//
// Industry: Stripe/Linear use exactly this pattern - typed factory functions
// returning { subject, html } that get passed to mailer.
// ============================================================================

import { renderTemplate } from "./render.js";

// ============================================================================
// OTP email
// ============================================================================
export async function otpEmail(input: {
  name: string;
  otp: string;
  purpose: "registration" | "login" | "password-reset" | "email-change";
  ttlMinutes?: number;
}): Promise<{ subject: string; html: string }> {
  const ttlMinutes = input.ttlMinutes ?? 5;
  const subject = `Your verification code: ${input.otp}`;

  const html = await renderTemplate(
    "otp",
    {
      name: input.name,
      otp: input.otp,
      purpose: input.purpose,
      ttlMinutes,
    },
    {
      title: subject,
      preheader: `Your one-time code is ${input.otp}. It expires in ${ttlMinutes} minutes.`,
    },
  );

  return { subject, html };
}

// ============================================================================
// Welcome email
// ============================================================================
export async function welcomeEmail(input: {
  name: string;
  role: "CUSTOMER" | "VENDOR";
}): Promise<{ subject: string; html: string }> {
  const subject =
    input.role === "VENDOR"
      ? "Welcome - your vendor account is created"
      : "Welcome aboard!";

  const html = await renderTemplate(
    "welcome",
    {
      name: input.name,
      role: input.role,
    },
    {
      title: subject,
      preheader:
        input.role === "VENDOR"
          ? "We're reviewing your vendor details - typically 24-48 hours."
          : "Discover thousands of products from verified sellers.",
    },
  );

  return { subject, html };
}

// ============================================================================
// Password reset email
// ============================================================================
export async function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
  ttlMinutes?: number;
}): Promise<{ subject: string; html: string }> {
  const ttlMinutes = input.ttlMinutes ?? 60;
  const subject = "Reset your password";

  const html = await renderTemplate(
    "password-reset",
    {
      name: input.name,
      resetUrl: input.resetUrl,
      ttlMinutes,
    },
    {
      title: subject,
      preheader: `Click the secure link to reset your password. Expires in ${ttlMinutes} minutes.`,
    },
  );

  return { subject, html };
}
