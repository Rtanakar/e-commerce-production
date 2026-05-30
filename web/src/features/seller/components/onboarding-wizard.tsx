// ============================================================================
// onboarding-wizard.tsx — Seller onboarding orchestrator (dual cookie jar)
// ============================================================================
// Auth resolution priority:
//   1. Seller cookie jar (s_at) — post-register or post-upgrade users
//   2. Customer cookie jar (at) — pre-upgrade customers (show upgrade step)
//   3. Anon                     — show account step
//
// State sources (priority for resolved step):
//   1. nuqs URL ?step=...                     (shareable + refresh-resilient)
//   2. backend /vendors/onboarding-status     (authoritative for any auth)
//   3. role-based fallback                    (if backend down)
//
// Derived via useMemo — NO useState + useEffect setState chain (avoids the
// React 19 "synchronous setState in effect" cascading-render warning).
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { Stepper, type WizardStep } from "./stepper";
import { StepAccount } from "./step-account";
import { StepVerify } from "./step-verify";
import { StepUpgrade } from "./step-upgrade";
import { StepShop } from "./step-shop";
import { StepBank } from "./step-bank";
import { StepComplete } from "./step-complete";
import { StepBlocked } from "./step-blocked";
import { useAuth } from "@/lib/auth/guards";
import { useOnboardingStatus } from "../hooks/use-onboarding-status";
import { useSellerMe } from "../hooks/use-seller-me";
import { useSellerParams } from "../hooks/use-seller-params";
import type { OnboardingStep } from "@/lib/seller/api";

// Maps backend currentStep → frontend wizard step
function backendStepToWizard(backendStep: OnboardingStep): WizardStep {
  switch (backendStep) {
    case "account":
      return "account";
    case "upgrade":
      return "upgrade";
    case "blocked":
      return "blocked";
    case "shop":
      return "shop";
    case "bank":
      return "bank";
    case "review":
    case "active":
      return "complete";
  }
}

export function SellerOnboardingWizard() {
  // ── Customer auth (for the "upgrade" branch — user is a customer here) ──
  const {
    user: customerUser,
    isAuthenticated: isCustomerAuthed,
    isPending: customerPending,
  } = useAuth();

  // ── Seller auth (post-register or post-upgrade — has s_at cookie) ──
  const sellerMeQuery = useSellerMe();
  const sellerUser = sellerMeQuery.data ?? null;
  const isSellerAuthed = !!sellerUser;
  const sellerPending = sellerMeQuery.isPending;

  // URL state via nuqs — async setter, no sync setState cascade
  const [{ step: urlStep }, setSellerParams] = useSellerParams();

  // Backend status — only meaningful once SOME auth is resolved
  const statusQuery = useOnboardingStatus({
    enabled:
      !sellerPending &&
      !customerPending &&
      (isSellerAuthed || isCustomerAuthed),
  });

  // Step-1 credentials kept in memory for auto-signin after OTP verify.
  // NOT localStorage — lost on refresh by design (security: avoid persisting
  // plaintext password). Refresh during verify → user re-enters manually.
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [pendingPassword, setPendingPassword] = useState<string | undefined>(
    undefined,
  );

  // ----- Derived resolved step ------------------------------------------
  const step = useMemo<WizardStep | null>(() => {
    // Wait for BOTH auth probes (seller + customer) before deciding
    if (sellerPending || customerPending) return null;

    // ── Authenticated branch (seller OR customer) — backend is truth ──
    if (isSellerAuthed || isCustomerAuthed) {
      if (statusQuery.data) {
        return backendStepToWizard(statusQuery.data.currentStep);
      }
      if (statusQuery.error) {
        // Backend down — URL hint if reasonable, else role-based fallback
        if (urlStep && urlStep !== "blocked") return urlStep;
        if (isSellerAuthed) return "shop";
        return "upgrade"; // customer only
      }
      // Still loading status — show URL hint if any, else null (loading)
      return urlStep ?? null;
    }

    // ── Anon branch — URL hint or default to account ──
    return urlStep ?? "account";
  }, [
    sellerPending,
    customerPending,
    isSellerAuthed,
    isCustomerAuthed,
    statusQuery.data,
    statusQuery.error,
    urlStep,
  ]);

  // ----- Handlers --------------------------------------------------------
  const handleAccountDone = (creds: { email: string; password: string }) => {
    setPendingEmail(creds.email);
    setPendingPassword(creds.password);
    void setSellerParams({ step: "verify" });
  };

  const handleVerifyDone = () => {
    setPendingPassword(undefined);
    void setSellerParams({ step: "shop" });
  };

  const handleUpgradeDone = () => void setSellerParams({ step: "shop" });
  const handleShopDone = () => void setSellerParams({ step: "bank" });
  const handleBankDone = () => void setSellerParams({ step: "complete" });

  // ----- Loading state while we resolve initial step ---------------------
  if (step === null) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-muted/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ----- Email + name for child steps (prefer seller, fallback customer) -
  const displayUser = sellerUser ?? customerUser;

  // ----- Render ----------------------------------------------------------
  // Complete + blocked are TERMINAL screens — center them vertically for
  // visual emphasis (success/blocked celebration). In-flight steps (forms)
  // stay top-aligned so the user's scroll context matches form-fill UX.
  const isTerminal = step === "complete" || step === "blocked";

  return (
    <div
      className={
        isTerminal
          ? "flex min-h-[calc(100vh-3.5rem)] flex-col bg-muted/30 pb-16"
          : "min-h-[calc(100vh-3.5rem)] bg-muted/30 pb-16"
      }
    >
      <Stepper current={step} />

      <div
        className={
          isTerminal
            ? "mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4"
            : "mx-auto w-full max-w-2xl px-4"
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === "account" && (
            <StepAccount key="account" onDone={handleAccountDone} />
          )}
          {step === "verify" && (
            <StepVerify
              key="verify"
              email={pendingEmail || displayUser?.email || ""}
              storedPassword={pendingPassword}
              onDone={handleVerifyDone}
            />
          )}
          {step === "upgrade" && customerUser && (
            <StepUpgrade
              key="upgrade"
              email={customerUser.email}
              name={customerUser.name}
              onDone={handleUpgradeDone}
            />
          )}
          {step === "shop" && <StepShop key="shop" onDone={handleShopDone} />}
          {step === "bank" && <StepBank key="bank" onDone={handleBankDone} />}
          {step === "complete" && <StepComplete key="complete" />}
          {step === "blocked" && <StepBlocked key="blocked" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
