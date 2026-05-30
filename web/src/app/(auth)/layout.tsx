// ============================================================================
// (auth)/layout.tsx — Centered card layout for auth pages
// ============================================================================
// All auth pages (sign-in, sign-up, forgot-password, verify-otp, reset-password)
// share this layout. Behaviour:
//   - If user ALREADY logged in → useRequireGuest redirects to "/"
//   - While auth status resolving → render skeleton (no flash of form)
//   - Anon user → show form
// ============================================================================

"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useRequireGuest } from "@/lib/auth/guards";
import { SiteHeader } from "@/components/shared/site-header";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function AuthLayout({ children }: { children: ReactNode }) {
  // Guard: agar user already signed-in hai to "/" pe bhej do.
  // isReady = false → either pending OR redirecting → render skeleton
  const { isReady } = useRequireGuest("/");

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Minimal top bar - sirf logo (auth pages mein full header distract karega) */}
      {/* <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Eshop
          </Link>
        </div>
      </header> */}
      <SiteHeader />

      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
        {isReady ? (
          // Form ready - smooth fade-in (motion)
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm"
          >
            {children}
          </motion.div>
        ) : (
          // Loading state - empty card sized like form (no layout shift)
          <div
            className="w-full max-w-md animate-pulse rounded-xl border bg-background p-8 shadow-sm"
            aria-hidden
          >
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="mt-6 space-y-3">
              <div className="h-10 w-full rounded bg-muted" />
              <div className="h-10 w-full rounded bg-muted" />
              <div className="h-10 w-full rounded bg-muted" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
