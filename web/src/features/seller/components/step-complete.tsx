// ============================================================================
// step-complete.tsx — Onboarding complete! Seller is LIVE (Amazon-style)
// ============================================================================
// Amazon/Flipkart model: seller is instantly active and can list products.
// Trust & Safety reviews happen in the background (non-blocking) — if flagged,
// listings get held or account suspended. We do NOT gate portal access on it.
// ============================================================================

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { shopUrl } from "@/lib/portal-urls";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StepComplete() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border bg-card p-8 text-center shadow-sm sm:p-10"
    >
      {/* Success burst — spring scale + sparkle */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 18,
          delay: 0.1,
        }}
        className="relative mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
      >
        <CheckCircle2 className="size-9" strokeWidth={2} />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
        >
          <Sparkles className="absolute -top-1 -right-1 size-4 text-amber-400" />
          <Sparkles className="absolute -bottom-1 -left-1 size-3 text-amber-400" />
        </motion.div>
      </motion.div>

      <h2 className="text-2xl font-semibold tracking-tight">
        You&apos;re live!
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your seller account is active. Head to the dashboard to list your first
        product. Quality review runs in the background — you can sell right
        away.
      </p>

      {/* Non-blocking review hint (Amazon-style "Under quality review" badge) */}
      <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
        </span>
        Quality review in progress
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button asChild>
          {/* Same-host (seller portal) → next/link is fine */}
          <Link href="/seller/dashboard">Go to seller dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          {/* Cross-host → plain <a> to the shop origin (clean jar switch) */}
          <a href={shopUrl("/")}>Back to shop</a>
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Questions? Email{" "}
        <a
          href="mailto:sellers@eshop.com"
          className="text-primary hover:underline"
        >
          sellers@eshop.com
        </a>
      </p>
    </motion.div>
  );
}
