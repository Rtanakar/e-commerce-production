// ============================================================================
// seller-signin-form.tsx — Returning seller login
// ============================================================================
// POST /api/v1/auth/seller/login → sets seller cookie jar. On success we do a
// HARD navigation to /seller/dashboard so the freshly-set seller-access-token
// cookie is included in the RSC page request (the server guard reads it).
//
// Refuses non-VENDOR accounts server-side (403) → shown as a friendly error.
// ============================================================================

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Store } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sellerAuthApi } from "@/lib/seller-auth/api";
import { ApiError } from "@/lib/api";
import {
  sellerSignInSchema,
  type SellerSignInValues,
} from "../validators/signin";

export function SellerSignInForm() {
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SellerSignInValues>({
    resolver: standardSchemaResolver(sellerSignInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SellerSignInValues) => {
    setSubmitting(true);
    try {
      const res = await sellerAuthApi.signIn(values);
      toast.success(`Welcome back, ${res.user.name ?? res.user.email}`);
      // Hard nav → RSC load sees the just-set seller cookie
      window.location.href = "/seller/dashboard";
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        form.setError("email", {
          message: "This isn't a seller account. Apply to sell first.",
        });
      } else if (err instanceof ApiError && err.code === "BAD_REQUEST") {
        // e.g. email not verified
        toast.error("Couldn't sign in", { description: err.message });
      } else {
        form.setError("password", { message: "Invalid email or password" });
      }
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Seller sign in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access your seller dashboard
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@business.com"
            autoComplete="email"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              placeholder="Your password"
              autoComplete="current-password"
              {...form.register("password")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign in
        </Button>

        <p className="pt-1 text-center text-xs text-muted-foreground">
          New seller?{" "}
          <a
            href="/become-seller"
            className="font-medium text-primary hover:underline"
          >
            Start selling
          </a>
        </p>
      </form>
    </motion.div>
  );
}
