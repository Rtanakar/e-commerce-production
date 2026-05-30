// ============================================================================
// google-auth-button.tsx — Google OAuth CTA
// ============================================================================
// Industry pattern: full-page navigation to backend OAuth init route
// (NOT fetch — OAuth requires browser redirects through Google's domain).
//
// Flow:
//   1. User clicks → window.location = `${API}/auth/google?redirect=/dashboard`
//   2. Backend redirects → Google consent screen
//   3. User approves → Google → backend callback → cookies set → redirect to frontend
//
// Used by: Vercel, Linear, Cal.com (all use the same redirect pattern)
// ============================================================================

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoogleAuthButtonProps {
  mode: "sign-in" | "sign-up";
  disabled?: boolean;
  /** Where to land after successful OAuth (default: "/") */
  redirectTo?: string;
}

// Relative base — same-origin proxy (see lib/api.ts). The window.location
// redirect to /api/v1/auth/google is forwarded to the backend by Next.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export function GoogleAuthButton({
  mode,
  disabled,
  redirectTo = "/",
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    // Full-page nav - OAuth requires real browser redirects (not fetch)
    // Backend will redirect to Google, then back to /auth/google/callback,
    // then finally to `redirectTo` with cookies set.
    const url = new URL(`${API_URL}/auth/google`);
    url.searchParams.set("redirect", redirectTo);
    window.location.href = url.toString();
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled || loading}
      className="w-full"
    >
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <GoogleIcon />
      )}
      <span className="ml-2">
        {mode === "sign-in" ? "Continue with Google" : "Sign up with Google"}
      </span>
    </Button>
  );
}

// ─── Google brand SVG (inline — no separate asset file) ──────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.7 6.2 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.7 6.2 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.6 2.3-5 0-9.4-3.3-11.1-8H6.3C9.5 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C41.6 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
