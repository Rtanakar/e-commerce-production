// ============================================================================
// stepper.tsx — 3-node seller onboarding progress indicator
// ============================================================================
// Matches Amazon Seller Central / Flipkart Seller Hub visual:
//   ① Create Account ─── ② Setup Shop ─── ③ Connect Bank
//
// OTP verify is a SUB-STATE of step 1 — stepper stays on node 1 until verify
// succeeds. Customer-upgrade flow auto-completes node 1 (already verified).
// ============================================================================

"use client";

import { motion } from "motion/react";
import { Check, UserPlus, Store, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep =
  | "account" // step 1 sub-state: registering (anon)
  | "verify" // step 1 sub-state: OTP entry
  | "upgrade" // customer → seller role flip confirmation
  | "shop" // step 2 — vendor profile creation
  | "bank" // step 3 — bank/payout setup
  | "complete" // all done — instant seller, "Under Review" badge
  | "blocked"; // ADMIN cannot become seller

interface StepConfig {
  key: "account" | "shop" | "bank";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  { key: "account", label: "Create Account", icon: UserPlus },
  { key: "shop", label: "Setup Shop", icon: Store },
  { key: "bank", label: "Connect Bank", icon: Landmark },
];

// Map wizard sub-step → main progress index
function progressIndex(step: WizardStep): number {
  switch (step) {
    case "account":
    case "verify":
      return 0; // both are sub-states of "Create Account"
    case "upgrade":
    case "shop":
      return 1;
    case "bank":
      return 2;
    case "complete":
      return 3; // all three nodes filled
    case "blocked":
      return -1; // stepper hidden
  }
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function Stepper({ current }: { current: WizardStep }) {
  if (current === "blocked") return null;

  const activeIdx = progressIndex(current);

  return (
    // Centered band — narrower max-w aligns stepper edges visually closer to
    // the form card (max-w-md) below. Bottom padding gives breathing room
    // before the step content starts (matches Amazon Seller Central spacing).
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-8 sm:pb-12 sm:pt-12">
      <ol className="flex items-center justify-between gap-2 sm:gap-4">
        {STEPS.map((step, idx) => {
          const status: "done" | "active" | "pending" =
            activeIdx > idx ? "done" : activeIdx === idx ? "active" : "pending";
          const Icon = step.icon;

          return (
            <li
              key={step.key}
              className="flex flex-1 items-center gap-2 sm:gap-3"
            >
              {/* ----- Node ----- */}
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  animate={{ scale: status === "active" ? 1.06 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 24 }}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    status === "active" &&
                      "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    status === "done" && "bg-primary text-primary-foreground",
                    status === "pending" && "bg-muted text-muted-foreground",
                  )}
                >
                  {status === "done" ? (
                    <motion.span
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </motion.span>
                  ) : status === "active" ? (
                    <span>{idx + 1}</span>
                  ) : (
                    <Icon className="size-4" />
                  )}
                </motion.div>

                <span
                  className={cn(
                    "text-[11px] font-medium sm:text-xs",
                    status === "pending"
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* ----- Connector line ----- */}
              {idx < STEPS.length - 1 && (
                <div className="relative -mt-6 h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={false}
                    animate={{ width: activeIdx > idx ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="h-full bg-primary"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
