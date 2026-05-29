// ============================================================================
// reset-password-form.tsx — Step 2: OTP + new password
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertCircle, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "../validators/reset-password";
import { passwordRules } from "../constants/constants";
import { useResetPassword, useResendOtp } from "@/lib/auth/hooks";

const RESEND_COOLDOWN_SECONDS = 60;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const form = useForm<ResetPasswordValues>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    defaultValues: { email, otp: "", newPassword: "", confirmPassword: "" },
  });

  const password = useWatch({ control: form.control, name: "newPassword" });
  const strengthCount = passwordRules.filter((r) =>
    r.test(password ?? ""),
  ).length;
  const canSubmit = strengthCount === passwordRules.length;

  const reset = useResetPassword();
  const resend = useResendOtp();

  const onSubmit = (values: ResetPasswordValues) => {
    reset.mutate(
      {
        email: values.email,
        otp: values.otp,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          toast.success(
            "Password reset successful. Please sign in with your new password.",
          );
          router.push("/sign-in");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleResend = () => {
    if (cooldown > 0) return;
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
          Email missing — start from forgot password.
        </p>
        <Button asChild>
          <Link href="/forgot-password">Forgot password</Link>
        </Button>
      </div>
    );
  }

  const isLoading = reset.isPending;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
      noValidate
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the code sent to{" "}
          <span className="font-medium text-foreground">{email}</span> and
          choose a new password.
        </p>
      </div>

      <Controller
        name="otp"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Label>Verification code</Label>
            <InputOTP
              maxLength={6}
              value={field.value}
              onChange={field.onChange}
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
            <p className="text-center text-xs text-muted-foreground">
              {cooldown > 0 ? (
                <>Resend in {cooldown}s</>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resend.isPending}
                  className="font-medium text-primary hover:underline"
                >
                  {resend.isPending ? "Sending…" : "Resend code"}
                </button>
              )}
            </p>
          </div>
        )}
      />

      <Controller
        name="newPassword"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative">
              <Input
                {...field}
                id="newPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                aria-invalid={fieldState.invalid}
                className={cn(
                  "pr-10",
                  fieldState.invalid && "border-destructive",
                )}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {(password?.length ?? 0) > 0 && (
              <ul className="space-y-1 pt-1">
                {passwordRules.map((rule) => {
                  const passed = rule.test(password ?? "");
                  return (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        passed ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {passed ? (
                        <Check className="size-3" />
                      ) : (
                        <X className="size-3" />
                      )}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      />

      <Controller
        name="confirmPassword"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative">
              <Input
                {...field}
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                aria-invalid={fieldState.invalid}
                className={cn(
                  "pr-10",
                  fieldState.invalid && "border-destructive",
                )}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {fieldState.error && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="size-3" />
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      <Button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Resetting…
          </>
        ) : (
          "Reset password"
        )}
      </Button>
    </form>
  );
}
