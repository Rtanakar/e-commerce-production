// ============================================================================
// auth/server.ts — Server-side auth helpers (Next.js 16 RSC + Server Actions)
// ============================================================================
// FAANG dual-layer pattern (Vercel/Netflix/Stripe dashboards):
//   - Client guards (useRequireAuth in guards.ts) → smooth UX, no flash
//   - Server guards (THIS FILE)                   → real security
//
// Why BOTH?
//   - Client: redirect happens AFTER JS hydrates → there's a brief flash
//   - Server: redirect happens BEFORE HTML ships → no flash, no bypass
//     (attacker can't disable JS to skip the check)
//
// Industry split:
//   Login/signup pages → client guard sufficient (UX-driven)
//   Dashboards / profile / checkout / admin → server guard MANDATORY
//
// Next.js 16 changes:
//   - cookies() is now ASYNC - must await
//   - fetch() defaults to no-cache - we still set cache:"no-store" explicit
// ============================================================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser, UserRole } from "./api";

// SERVER-side fetcher → needs an ABSOLUTE backend URL (relative `/api/v1`
// only works in the browser where there's an origin). Server components run
// in Node, so we hit the backend directly (no proxy hop needed server-side).
// Separate var from the browser's NEXT_PUBLIC_API_URL so leaving that unset
// (→ browser uses relative proxy) doesn't break SSR here.
const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080/api/v1";

// ============================================================================
// Backend envelope (mirrors services/src/interfaces/api-response.ts)
// ============================================================================
interface MeEnvelope {
  success: boolean;
  data: AuthUser;
}

// ============================================================================
// getServerUser - read current user OR null (no redirect)
// ============================================================================
// Forwards ALL browser cookies to backend /auth/me. Backend sees the same
// auth cookies a normal browser request would, returns the user.
//
// Returns null on:
//   - No cookies (anon visitor)
//   - 401 from backend (expired/revoked session)
//   - Network error (backend down) → treat as anon (fail-closed for security)
//
// CRITICAL: cache: "no-store" - auth state must NEVER be cached. A cached
// "logged in" response for one user could leak to another. FAANG rule #1.
// ============================================================================
export async function getServerUser(): Promise<AuthUser | null> {
  // Next.js 16: cookies() is async
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  if (all.length === 0) return null;

  // Reconstruct the Cookie header string browser would send
  const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
      },
      // NEVER cache auth - per-user, per-request
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = (await res.json()) as MeEnvelope;
    return json?.data ?? null;
  } catch (err) {
    // Backend down / network error - fail closed (treat as anon)
    // Logging: in prod you'd send to Sentry/Datadog. Console for now.
    console.error("[auth/server] getServerUser failed:", err);
    return null;
  }
}

// ============================================================================
// requireAuth - "must be logged in" - redirects to /sign-in if not
// ============================================================================
// Use at the TOP of any Server Component / Server Action / Route Handler
// that needs auth. After the await, `user` is guaranteed non-null.
//
// Usage in Server Component:
//   export default async function ProfilePage() {
//     const user = await requireAuth();
//     return <h1>Hello {user.name}</h1>;
//   }
//
// ?next=<path> preserves intent - after sign-in, user lands back here
// ============================================================================
export async function requireAuth(opts?: {
  redirectTo?: string;
  /** Current path to encode in ?next= so post-login redirect works */
  from?: string;
}): Promise<AuthUser> {
  const user = await getServerUser();
  if (!user) {
    const dest = opts?.redirectTo ?? "/sign-in";
    const url = opts?.from
      ? `${dest}?next=${encodeURIComponent(opts.from)}`
      : dest;
    redirect(url);
  }
  return user;
}

// ============================================================================
// requireGuest - "must NOT be logged in" - redirects logged-in users away
// ============================================================================
// Use on auth pages (sign-in, sign-up, forgot-password, etc.) as the SERVER
// counterpart of useRequireGuest. Belt-and-suspenders: both work together.
//
// Server-rendered redirect = ZERO flash. User never sees the auth form
// (which would be confusing if they're already signed in).
// ============================================================================
export async function requireGuest(fallback: string = "/"): Promise<void> {
  const user = await getServerUser();
  if (user) {
    // Role-aware landing - admin → /admin, vendor → /vendor, customer → /
    redirect(landingForRole(user.role, fallback));
  }
}

// ============================================================================
// requireRole - "logged in AND has one of these roles"
// ============================================================================
// Use in role-gated pages: /admin/*, /vendor/*.
// Wrong role → send to their natural home (don't expose what they were
// trying to access).
// ============================================================================
export async function requireRole(...allowed: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    // Don't redirect to / blindly - send to their role's dashboard
    // (so admins/vendors don't bounce out of their workspace on a typo)
    redirect(landingForRole(user.role, "/"));
  }
  return user;
}

// ============================================================================
// landingForRole - role-aware "home" URL
// ============================================================================
// Customer: shopping is home (/)
// Vendor:   dashboard (/vendor) - their primary workflow surface
// Admin:    dashboard (/admin)
//
// `fallback` used when no specific role landing makes sense.
// ============================================================================
export function landingForRole(role: UserRole, fallback: string = "/"): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "VENDOR":
      return "/vendor";
    case "CUSTOMER":
      return fallback;
  }
}

// ============================================================================
// forwardCookiesHeader - helper for direct fetches from RSC
// ============================================================================
// Sometimes you need to call backend from a Server Component directly
// (not via getServerUser). Use this to build the Cookie header.
//
// Example:
//   const res = await fetch(`${API_URL}/orders`, {
//     headers: await forwardCookiesHeader(),
//     cache: "no-store",
//   });
// ============================================================================
export async function forwardCookiesHeader(): Promise<{ Cookie: string }> {
  const store = await cookies();
  return {
    Cookie: store
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; "),
  };
}
