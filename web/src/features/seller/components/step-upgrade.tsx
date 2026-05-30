// ============================================================================
// step-upgrade.tsx — Existing-customer → Seller confirmation
// ============================================================================
// Shown to logged-in CUSTOMER clicking "Become a Seller". One-click upgrade —
// backend flips role automatically AND rotates the session (returns fresh
// tokens). NO admin involvement.
//
// Industry parallel: Amazon "Start selling" / Flipkart Seller Hub "Get
// Started" — instant role flip, no re-signup, no waiting.
// ============================================================================

"use client";

import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  ShieldCheck,
  ShoppingBag,
  Store,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpgradeToSeller } from "../hooks/use-upgrade-to-seller";

interface Props {
  email: string;
  name: string | null;
  onDone: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function StepUpgrade({ email, name, onDone }: Props) {
  const upgrade = useUpgradeToSeller();

  const handleUpgrade = async () => {
    try {
      await upgrade.mutateAsync();
      toast.success("Welcome aboard, seller!", {
        description: "Your account is now upgraded.",
      });
      onDone();
    } catch (err) {
      toast.error("Could not upgrade account", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="rounded-xl border bg-card p-6 shadow-sm sm:p-8"
    >
      {/* ----- Hero ----- */}
      <div className="mb-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 18,
            delay: 0.1,
          }}
          className="relative mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
        >
          <Store className="size-8" />
          {/* Orbiting sparkles — subtle excitement cue */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0"
          >
            <Sparkles className="absolute -right-1 -top-1 size-4 text-amber-400" />
          </motion.div>
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Start selling on Eshop
        </h2>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          You&apos;re signed in as{" "}
          <span className="font-medium text-foreground">
            {name ?? email.split("@")[0]}
          </span>
          . We&apos;ll upgrade this account to a seller instantly — no new
          login, no admin wait.
        </p>
      </div>

      {/* ----- Why convert (stagger-in benefits) ----- */}
      <div className="mb-6 space-y-2">
        {[
          {
            icon: ShoppingBag,
            text: "Keep your existing customer profile — buy and sell from one account",
          },
          {
            icon: ShieldCheck,
            text: "Your email is already verified — skip the OTP step",
          },
          {
            icon: Sparkles,
            text: "Same login everywhere — orders, wishlist, and shop dashboard",
          },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.3, ease: EASE }}
              className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm text-foreground/90">{item.text}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ----- Account summary chip ----- */}
      <div className="mb-6 flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate font-medium">{email}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Customer
        </span>
      </div>

      <Button
        type="button"
        onClick={handleUpgrade}
        disabled={upgrade.isPending}
        className="w-full"
      >
        {upgrade.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Upgrade & continue to shop setup
        {!upgrade.isPending && <ArrowRight className="ml-2 size-4" />}
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        By continuing you agree to our Seller Agreement and Privacy Policy.
      </p>
    </motion.div>
  );
}
