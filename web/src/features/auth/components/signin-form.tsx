// ============================================================================
// signin-form.tsx — Email + password sign-in
// ============================================================================
// Backend at /api/v1/auth/login. On success cookies (at + rt) set by backend.
// EMAIL_NOT_VERIFIED case → redirect to /verify-otp with email prefilled.
//
// Uses standardSchemaResolver (Zod 4 implements Standard Schema natively).
// ============================================================================

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signInFormSchema, type SignInFormValues } from "../validators/signin";
import { signInDefaultValues } from "../constants/constants";
import { useSignIn } from "@/lib/auth/hooks";
import { ApiError } from "@/lib/api";
import { GoogleAuthButton } from "./google-auth-button";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/";
  const prefilledEmail = params.get("email") ?? "";
  const justVerified = params.get("verified") === "1";

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInFormValues>({
    resolver: standardSchemaResolver(signInFormSchema),
    defaultValues: { ...signInDefaultValues, email: prefilledEmail },
  });

  // Welcome toast after just-verified user lands here
  useEffect(() => {
    if (justVerified && prefilledEmail) {
      toast.success("Email verified! Sign in to continue.");
    }
  }, [justVerified, prefilledEmail]);

  const signIn = useSignIn({
    onSuccess: (data) => {
      toast.success(`Welcome back, ${data.user.name ?? data.user.email}`);
      router.push(redirectTo);
      router.refresh();
    },
    onError: (err: ApiError) => {
      if (
        err.code === "BAD_REQUEST" &&
        err.message.toLowerCase().includes("verify")
      ) {
        const email = form.getValues("email");
        toast.error("Please verify your email first");
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
        return;
      }
      toast.error(err.message);
    },
  });

  const onSubmit = (values: SignInFormValues) => {
    signIn.mutate(values);
  };

  const isLoading = signIn.isPending;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <GoogleAuthButton mode="sign-in" disabled={isLoading} redirectTo={redirectTo} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-5"
        noValidate
      >
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  {...field}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {fieldState.error && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="size-3" />
                  {fieldState.error.message}
                </p>
              )}
            </div>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By signing in you agree to our{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms
          </Link>{" "}
          &{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy
          </Link>
        </p>
      </form>
    </div>
  );
}
