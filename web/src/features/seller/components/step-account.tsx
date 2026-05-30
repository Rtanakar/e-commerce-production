// ============================================================================
// step-account.tsx — Step 1: Create seller account (Amazon-style instant signup)
// ============================================================================
// Anon user → registers with role=VENDOR. No admin approval — backend creates
// the seller account instantly (Amazon "Sell on Amazon" / Flipkart Seller Hub).
//
// Phone stored E.164: "+<dialCode><nationalNumber>". Country drives later
// currency/tax formatting + dial-prefix.
// ============================================================================

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sellerAuthApi } from "@/lib/seller-auth/api";
import { ApiError } from "@/lib/api";
import {
  accountFormSchema,
  type AccountFormValues,
} from "../validators/account";
import { accountDefaultValues } from "../constants/constants";
import { COUNTRIES, findCountry } from "../constants/countries";

interface Props {
  onDone: (creds: { email: string; password: string }) => void;
}

export function StepAccount({ onDone }: Props) {
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: standardSchemaResolver(accountFormSchema),
    defaultValues: accountDefaultValues,
  });

  // Watch country so the dial-code prefix label updates live as user changes it
  const selectedCountry = form.watch("country");
  const dialCode = findCountry(selectedCountry)?.dial ?? "91";

  const onSubmit = async (values: AccountFormValues) => {
    setSubmitting(true);
    try {
      const phoneE164 = `+${dialCode}${values.phone}`;
      // Seller portal route — role=VENDOR enforced server-side.
      // Backend creates seller account in PENDING_VERIFICATION state. No
      // cookies issued yet (industry pattern: tokens only after OTP verify).
      await sellerAuthApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
        phone: phoneE164,
        country: values.country,
      });

      toast.success("Account created", {
        description: "We sent a 6-digit code to your email.",
      });
      onDone({ email: values.email, password: values.password });
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_EXISTS") {
        form.setError("email", { message: "Email already registered" });
      } else {
        toast.error("Could not create account", {
          description: err instanceof Error ? err.message : "Try again",
        });
      }
    } finally {
      setSubmitting(false);
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
      <h2 className="mb-1 text-center text-2xl font-semibold tracking-tight">
        Create Account
      </h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Step 1 of 3 — Your seller account
      </p>

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Email + phone verified upfront — start selling immediately, no waiting
          for admin approval.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
        {/* ----- Name ----- */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="shahriar"
            autoComplete="name"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* ----- Email ----- */}
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

        {/* ----- Phone Number (dial-code prefix + national number) ----- */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="flex">
            <span className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground tabular-nums">
              +{dialCode}
            </span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="8801785834**"
              autoComplete="tel-national"
              className="rounded-l-none"
              {...form.register("phone")}
            />
          </div>
          {form.formState.errors.phone && (
            <p className="text-xs text-destructive">
              {form.formState.errors.phone.message}
            </p>
          )}
        </div>

        {/* ----- Country dropdown ----- */}
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Controller
            control={form.control}
            name="country"
            render={({ field }) => (
              <select
                id="country"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select your country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            )}
          />
          {form.formState.errors.country && (
            <p className="text-xs text-destructive">
              {form.formState.errors.country.message}
            </p>
          )}
        </div>

        {/* ----- Password ----- */}
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
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

        <Button type="submit" disabled={submitting} className="mt-2 w-full">
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Signup
        </Button>

        <p className="pt-1 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <a
            href="/seller-login"
            className="font-medium text-primary hover:underline"
          >
            Login
          </a>
        </p>
      </form>
    </motion.div>
  );
}
