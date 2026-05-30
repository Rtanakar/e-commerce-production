// ============================================================================
// otp-verify-card.tsx — Reusable 6-digit OTP entry card
// ============================================================================
// Shared by the email-verify and phone-verify phases of step-verify (both are
// sub-states of node 1 "Create Account"). Keeps the OTP UX — input, auto-submit
// on complete, resend cooldown, error reset — in one place.
//
// Parent owns the async work via onVerify/onResend (both may throw → we toast
// and reset the input). This card is purely presentational + local timer.
// ============================================================================

"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { OTP_RESEND_COOLDOWN_SECONDS } from "../constants/constants";

interface Props {
  /** Icon shown in the header bubble */
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  /** Plain description text; `target` is appended in bold (email/phone) */
  description: string;
  target: string;
  verifyLabel?: string;
  /** Verify the code. Throw to signal failure (card resets the input). */
  onVerify: (otp: string) => Promise<void>;
  /** Resend the code. Throw to signal failure. */
  onResend: () => Promise<void>;
}

export function OtpVerifyCard({
  icon: Icon,
  title,
  description,
  target,
  verifyLabel = "Verify & continue",
  onVerify,
  onResend,
}: Props) {
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleVerify = async () => {
    if (otp.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      await onVerify(otp);
      // Parent advances the flow on success; no local state change needed.
    } catch (err) {
      toast.error("Verification failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
      setOtp("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await onResend();
      toast.success("Code sent", { description: `Sent to ${target}` });
      setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error("Could not resend code", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Icon className="size-7" />
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {description}{" "}
          <span className="font-medium text-foreground">{target}</span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={setOtp}
          onComplete={(v) => v.length === 6 && handleVerify()}
          autoFocus
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <Button
          onClick={handleVerify}
          disabled={otp.length !== 6 || submitting}
          className="w-full"
        >
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {verifyLabel}
        </Button>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          Didn&apos;t receive it?
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="ml-1 inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
          >
            {resending && <Loader2 className="size-3 animate-spin" />}
            {!resending && <RotateCw className="size-3" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
