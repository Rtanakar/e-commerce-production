// ============================================================================
// auth/guards.ts — Auth guard hooks (client-side)
// ============================================================================
// Three hooks for three intents:
//   - useAuth()         → read-only: { user, isAuthenticated, isPending }
//   - useRequireGuest() → redirect AWAY if logged in (sign-in/sign-up pages)
//   - useRequireAuth()  → redirect TO sign-in if NOT logged in (protected pages)
//
// Industry pattern (Amazon/Flipkart/Vercel):
//   - Server Components → use server-side cookie check + redirect()
//   - Client Components → use these hooks + useEffect redirect
//
// We use client-side here because Next.js 16 + cookie-based auth needs the
// session to be hydrated by TanStack Query. Layout-level redirect is fine -
// flash is mitigated by `isPending` skeleton.
// ============================================================================

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "./hooks";
import type { AuthUser, UserRole } from "./api";

// ============================================================================
// useAuth - read-only auth state
// ============================================================================
// Use this in any component that needs to know "is user logged in?".
// Doesn't redirect anywhere - just exposes the state.
// ============================================================================
export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isPending: boolean;
  isError: boolean;
}

export function useAuth(): AuthState {
  const { data: user, isLoading, isError } = useMe();
  return {
    user: user ?? null,
    // isAuthenticated true ONLY when query has resolved with a user object
    // (not during pending - prevents flash of authenticated UI on first paint)
    isAuthenticated: !!user && !isLoading && !isError,
    isPending: isLoading,
    isError,
  };
}

// ============================================================================
// useRequireGuest - "must be logged OUT" guard
// ============================================================================
// Use on auth pages (sign-in, sign-up, forgot-password, verify-otp, reset).
// If user is already logged in, redirects to fallback (default `/`).
//
// Returns { isReady } - render auth form only when ready (prevents flash).
// ============================================================================
export function useRequireGuest(fallback: string = "/"): { isReady: boolean } {
  const router = useRouter();
  const { isAuthenticated, isPending } = useAuth();

  useEffect(() => {
    // Skip while pending - don't redirect on first paint
    if (isPending) return;
    if (isAuthenticated) {
      router.replace(fallback);
    }
  }, [isAuthenticated, isPending, router, fallback]);

  // Ready = no user AND query has resolved. Pending OR authenticated → wait.
  return { isReady: !isPending && !isAuthenticated };
}

// ============================================================================
// useRequireAuth - "must be logged IN" guard
// ============================================================================
// Use on protected pages (profile, orders, vendor dashboard, etc.).
// If user is NOT logged in, redirects to /sign-in?next=<current-path>.
//
// `roles` optional - restrict to specific role(s). Role mismatch → / (home).
// ============================================================================
export function useRequireAuth(opts?: {
  roles?: UserRole[];
  redirectTo?: string;
}): { isReady: boolean; user: AuthUser | null } {
  const router = useRouter();
  const { user, isAuthenticated, isPending } = useAuth();

  useEffect(() => {
    if (isPending) return;

    if (!isAuthenticated) {
      // Save current path for post-login redirect (?next=)
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname : "/";
      const redirectTo = opts?.redirectTo ?? "/sign-in";
      const url = `${redirectTo}?next=${encodeURIComponent(currentPath)}`;
      router.replace(url);
      return;
    }

    // Role gate - logged in but wrong role
    if (opts?.roles && user && !opts.roles.includes(user.role)) {
      router.replace("/");
    }
  }, [isAuthenticated, isPending, user, router, opts?.roles, opts?.redirectTo]);

  return {
    isReady:
      !isPending &&
      isAuthenticated &&
      (!opts?.roles || (!!user && opts.roles.includes(user.role))),
    user,
  };
}
