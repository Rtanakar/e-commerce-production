// ============================================================================
// verify-otp-form.tsx — 6-digit OTP entry + resend timer
// ============================================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  verifyOtpFormSchema,
  type VerifyOtpFormValues,
} from "../validators/verify-otp";
import { useVerifyOtp, useResendOtp } from "@/lib/auth/hooks";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const form = useForm<VerifyOtpFormValues>({
    resolver: standardSchemaResolver(verifyOtpFormSchema),
    defaultValues: { email, otp: "" },
  });

  // Flow: signup → verify-otp → SIGNIN (manual login, NOT auto-login)
  // No tokens issued here. User goes to /sign-in with email prefilled.
  const verify = useVerifyOtp({
    onSuccess: () => {
      toast.success("Email verified! Please sign in to continue.");
      router.push(`/sign-in?verified=1&email=${encodeURIComponent(email)}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const resend = useResendOtp();

  const onSubmit = useCallback(
    (values: VerifyOtpFormValues) => {
      verify.mutate(values);
    },
    [verify],
  );

  const handleResend = () => {
    if (!email || cooldown > 0) return;
    resend.mutate(
      { email },
      {
        onSuccess: () => {
          toast.success("New code sent");
          setCooldown(RESEND_COOLDOWN_SECONDS);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (!email) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Email is missing — start from sign-in.
        </p>
        <Button asChild>
          <Link href="/sign-in">Go to Sign In</Link>
        </Button>
      </div>
    );
  }

  const isLoading = verify.isPending;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <Controller
        name="otp"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <InputOTP
              maxLength={6}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                if (v.length === 6) form.handleSubmit(onSubmit)();
              }}
              disabled={isLoading}
            >
              <InputOTPGroup className="w-full justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="size-12 text-lg font-semibold"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {fieldState.error && (
              <p className="text-center text-xs text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      <Button
        type="submit"
        disabled={isLoading || form.watch("otp").length !== 6}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Verifying…
          </>
        ) : (
          "Verify"
        )}
      </Button>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get the code?{" "}
          {cooldown > 0 ? (
            <span className="font-medium text-foreground">
              Resend in {cooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resend.isPending}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              {resend.isPending ? "Sending…" : "Resend code"}
            </button>
          )}
        </p>

        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
