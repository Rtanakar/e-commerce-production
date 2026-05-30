// ============================================================================
// step-bank.tsx — Step 3: Connect bank account
// ============================================================================
// Two modes:
//   - Direct (Indian bank: account + IFSC) — immediate, basic compliance
//   - Stripe Connect — PCI offloaded, recommended for non-India
// ============================================================================

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toast } from "sonner";
import { Loader2, Landmark, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  bankDirectFormSchema,
  type BankDirectFormValues,
} from "../validators/bank";
import { bankDirectDefaultValues } from "../constants/constants";
import { useConnectBank } from "../hooks/use-connect-bank";

interface Props {
  onDone: () => void;
}

type Mode = "direct" | "stripe";

export function StepBank({ onDone }: Props) {
  const [mode, setMode] = useState<Mode>("direct");
  const connectBank = useConnectBank();

  const form = useForm<BankDirectFormValues>({
    resolver: standardSchemaResolver(bankDirectFormSchema),
    defaultValues: bankDirectDefaultValues,
  });

  const handleDirect = async (values: BankDirectFormValues) => {
    try {
      await connectBank.mutateAsync({ mode: "direct", ...values });
      toast.success("Bank connected");
      onDone();
    } catch (err) {
      toast.error("Could not save bank details", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  const handleStripe = async () => {
    try {
      const res = await connectBank.mutateAsync({ mode: "stripe" });
      if (res.onboardingUrl) {
        // Real Stripe flow — redirect to Stripe-hosted onboarding
        window.location.href = res.onboardingUrl;
      } else {
        toast.success("Stripe Connect started");
        onDone();
      }
    } catch (err) {
      toast.error("Could not start Stripe Connect", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  const submitting = connectBank.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Landmark className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Connect your bank
          </h2>
          <p className="text-sm text-muted-foreground">
            Step 3 of 3 — Where should payouts land?
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Your bank details are encrypted and only used for seller payouts. We
          never charge your account.
        </p>
      </div>

      {/* ----- Mode tabs ----- */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("direct")}
          className={cn(
            "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
            mode === "direct"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode === "direct" && (
            <motion.span
              layoutId="bankTab"
              className="absolute inset-0 rounded-md bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative">Indian Bank</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("stripe")}
          className={cn(
            "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
            mode === "stripe"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode === "stripe" && (
            <motion.span
              layoutId="bankTab"
              className="absolute inset-0 rounded-md bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative">Stripe Connect</span>
        </button>
      </div>

      {/* ----- Form panels (AnimatePresence crossfade) ----- */}
      <AnimatePresence mode="wait" initial={false}>
        {mode === "direct" ? (
          <motion.form
            key="direct"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onSubmit={form.handleSubmit(handleDirect)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="bankAccountName">Account holder name</Label>
              <Input
                id="bankAccountName"
                placeholder="As per bank records"
                {...form.register("bankAccountName")}
              />
              {form.formState.errors.bankAccountName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bankAccountName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bankAccountNumber">Account number</Label>
              <Input
                id="bankAccountNumber"
                inputMode="numeric"
                placeholder="9-18 digits"
                {...form.register("bankAccountNumber")}
              />
              {form.formState.errors.bankAccountNumber && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bankAccountNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bankIfscCode">IFSC code</Label>
              <Input
                id="bankIfscCode"
                placeholder="HDFC0001234"
                {...form.register("bankIfscCode")}
                className="uppercase"
              />
              {form.formState.errors.bankIfscCode && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bankIfscCode.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Finish & start selling
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="stripe"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">
                Stripe handles your payouts
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Bank details never touch our servers (PCI-compliant)</li>
                <li>• Supports 40+ countries</li>
                <li>• Standard 2-day payout cycle</li>
              </ul>
            </div>
            <Button
              type="button"
              onClick={handleStripe}
              disabled={submitting}
              className="w-full"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Continue with Stripe
              <ExternalLink className="ml-2 size-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
