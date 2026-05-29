// ============================================================================
// signup-form.tsx — Name + email + password + confirm + strength meter
// ============================================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertCircle, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signUpFormSchema, type SignUpFormValues } from "../validators/signup";
import { signUpDefaultValues, passwordRules } from "../constants/constants";
import { useSignUp } from "@/lib/auth/hooks";
import { GoogleAuthButton } from "./google-auth-button";

export function SignUpForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: standardSchemaResolver(signUpFormSchema),
    defaultValues: signUpDefaultValues,
  });

  const passwordValue = useWatch({ control: form.control, name: "password" });
  const strengthCount = passwordRules.filter((r) =>
    r.test(passwordValue ?? ""),
  ).length;

  const signUp = useSignUp();

  const onSubmit = (values: SignUpFormValues) => {
    signUp.mutate(
      {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        ...(values.role === "VENDOR" && { shopName: values.shopName }),
      },
      {
        onSuccess: (data) => {
          if (data.otpSent) {
            toast.success("Account created! Check your email for the code.");
          } else {
            toast.warning(
              "Account created, but we couldn't send the email. Use resend.",
            );
          }
          router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const isLoading = signUp.isPending;
  const canSubmit = strengthCount === passwordRules.length;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Already a member?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      <GoogleAuthButton mode="sign-up" disabled={isLoading} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or with email
          </span>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                {...field}
                id="name"
                placeholder="Ratnakar Mishra"
                autoComplete="name"
                disabled={isLoading}
                aria-invalid={fieldState.invalid}
                className={cn(fieldState.invalid && "border-destructive")}
              />
              {fieldState.error && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                {...field}
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                disabled={isLoading}
                aria-invalid={fieldState.invalid}
                className={cn(fieldState.invalid && "border-destructive")}
              />
              {fieldState.error && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  {...field}
                  id="password"
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

              {(passwordValue?.length ?? 0) > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i < strengthCount
                            ? strengthCount <= 2
                              ? "bg-destructive"
                              : strengthCount <= 4
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <ul className="space-y-1">
                    {passwordRules.map((rule) => {
                      const passed = rule.test(passwordValue ?? "");
                      return (
                        <li
                          key={rule.label}
                          className={cn(
                            "flex items-center gap-1.5 text-xs",
                            passed
                              ? "text-emerald-600"
                              : "text-muted-foreground",
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
                </div>
              )}
            </div>
          )}
        />

        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
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
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </div>
  );
}
