// ============================================================================
// forgot-password-form.tsx — Step 1: email input, sends OTP
// ============================================================================

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "../validators/forgot-password";
import { forgotPasswordDefaultValues } from "../constants/constants";
import { useForgotPassword } from "@/lib/auth/hooks";

export function ForgotPasswordForm() {
  const router = useRouter();

  const form = useForm<ForgotPasswordValues>({
    resolver: standardSchemaResolver(forgotPasswordSchema),
    defaultValues: forgotPasswordDefaultValues,
  });

  const forgot = useForgotPassword();

  const onSubmit = (values: ForgotPasswordValues) => {
    forgot.mutate(values, {
      onSuccess: () => {
        toast.success(
          "If an account exists, a code has been sent to your email",
        );
        router.push(
          `/reset-password?email=${encodeURIComponent(values.email)}`,
        );
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const isLoading = forgot.isPending;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a 6-digit verification code.
        </p>
      </div>

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

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Sending code…
          </>
        ) : (
          "Send verification code"
        )}
      </Button>

      <Link
        href="/sign-in"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Back to sign in
      </Link>
    </form>
  );
}
