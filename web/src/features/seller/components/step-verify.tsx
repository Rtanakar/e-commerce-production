// ============================================================================
// step-verify.tsx — Step 1 sub-state: email OTP → phone OTP → continue
// ============================================================================
// Two sequential phases (both belong to node 1 "Create Account", matching the
// step-account hint "Email + phone verified upfront"):
//
//   Phase "email":  verify email OTP → auto sign-in (sets seller cookies) →
//                   trigger phone OTP send → advance to phase "phone".
//   Phase "phone":  verify SMS OTP → onDone() (→ shop setup).
//
// Auto sign-in uses the password held in parent memory (NOT localStorage —
// lost on refresh by design). On refresh we can't auto-login, so we bounce to
// re-enter. Phone phase only runs once we hold seller cookies (the phone
// endpoints are auth-protected on the seller jar).
// ============================================================================

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { sellerAuthApi } from "@/lib/seller-auth/api";
import { sellerMeQueryKey } from "../hooks/use-seller-me";
import { onboardingStatusQueryKey } from "../hooks/use-onboarding-status";
import { OtpVerifyCard } from "./otp-verify-card";

interface Props {
  email: string;
  // Held in parent state from step 1 — undefined on refresh
  storedPassword?: string;
  onDone: () => void;
}

type Phase = "email" | "phone";

export function StepVerify({ email, storedPassword, onDone }: Props) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("email");
  // Masked phone returned by send-otp (e.g. "+91•••••3210") for display
  const [maskedPhone, setMaskedPhone] = useState<string>("your phone");

  // ----- Phase 1: email -------------------------------------------------
  const verifyEmail = async (otp: string) => {
    await sellerAuthApi.verifyOtp({ email, otp });
    toast.success("Email verified");

    if (!storedPassword) {
      // Refresh wiped the password — can't auto-login. Send to seller sign-in.
      toast.info("Please sign in to continue setting up your shop");
      window.location.href = `/seller-login`;
      return;
    }

    // Auto sign-in as seller (sets seller-* cookies). Customer jar untouched.
    await sellerAuthApi.signIn({ email, password: storedPassword });
    await Promise.all([
      qc.invalidateQueries({ queryKey: sellerMeQueryKey }),
      qc.invalidateQueries({ queryKey: onboardingStatusQueryKey }),
    ]);

    // Kick off phone verification. If the account has no phone or it's already
    // verified, the server returns otpSent:false → skip straight to shop.
    try {
      const res = await sellerAuthApi.sendPhoneOtp();
      if (!res.otpSent) {
        onDone();
        return;
      }
      setMaskedPhone(res.phone);
      setPhase("phone");
    } catch {
      // Phone send failed (e.g. SMS provider hiccup) — don't block onboarding.
      // User can verify phone later from the dashboard.
      toast.message("Skipping phone verification for now", {
        description: "You can verify your phone later from the dashboard.",
      });
      onDone();
    }
  };

  const resendEmail = async () => {
    await sellerAuthApi.resendOtp({ email });
  };

  // ----- Phase 2: phone -------------------------------------------------
  const verifyPhone = async (otp: string) => {
    await sellerAuthApi.verifyPhoneOtp({ otp });
    await Promise.all([
      qc.invalidateQueries({ queryKey: sellerMeQueryKey }),
      qc.invalidateQueries({ queryKey: onboardingStatusQueryKey }),
    ]);
    toast.success("Phone verified");
    onDone();
  };

  const resendPhone = async () => {
    const res = await sellerAuthApi.sendPhoneOtp();
    if (res.phone) setMaskedPhone(res.phone);
  };

  if (phase === "phone") {
    return (
      <OtpVerifyCard
        key="phone"
        icon={Smartphone}
        title="Verify your phone"
        description="We sent a 6-digit code to"
        target={maskedPhone}
        verifyLabel="Verify phone & continue"
        onVerify={verifyPhone}
        onResend={resendPhone}
      />
    );
  }

  return (
    <OtpVerifyCard
      key="email"
      icon={Mail}
      title="Verify your email"
      description="We sent a 6-digit code to"
      target={email}
      onVerify={verifyEmail}
      onResend={resendEmail}
    />
  );
}
