// ============================================================================
// seller-auth/server.ts — Server-side seller session guard (RSC)
// ============================================================================
// Seller portal counterpart of lib/auth/server.ts. Reads the SELLER cookie
// jar (seller-access-token / seller-refresh-token) and verifies it against
// the backend `/auth/seller/me`. Used by the /seller/* dashboard layout so
// the redirect happens BEFORE HTML ships (no flash, no JS-disable bypass).
//
// Isolation: we forward ALL cookies (the backend's requireSellerAuth only
// reads `seller-access-token`), so a customer-only session won't authenticate
// here — it'll 401 → redirect to onboarding. Exactly the boundary we want.
// ============================================================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthUser } from "@/lib/auth/api";

// Absolute backend URL — server runs in Node, hits the API directly (no proxy
// hop). Mirrors lib/auth/server.ts.
const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080/api/v1";

const SELLER_ACCESS_COOKIE = "seller-access-token";

interface MeEnvelope {
  success: boolean;
  data: AuthUser;
}

// ============================================================================
// getServerSeller — current seller OR null (no redirect)
// ============================================================================
// Fast-path: if the seller access cookie isn't even present, skip the network
// call. Otherwise forward cookies to /auth/seller/me. cache:"no-store" —
// auth state is per-user, per-request and must NEVER be cached.
// ============================================================================
export async function getServerSeller(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();

  // No seller session cookie → definitely not a seller session
  if (!all.some((c) => c.name === SELLER_ACCESS_COOKIE)) return null;

  const cookieHeader = all.map((c) => `${c.name}=${c.value}`).join("; ");

  try {
    const res = await fetch(`${API_URL}/auth/seller/me`, {
      method: "GET",
      headers: { Cookie: cookieHeader, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as MeEnvelope;
    return json?.data ?? null;
  } catch (err) {
    // Backend down / network error → fail closed (treat as unauthenticated)
    console.error("[seller-auth/server] getServerSeller failed:", err);
    return null;
  }
}

// ============================================================================
// requireSeller — must be a signed-in VENDOR; else send to onboarding
// ============================================================================
// Use at the top of /seller/* server layouts/pages. After the await, the
// returned user is guaranteed a VENDOR with an active seller session.
//
// No seller session → /become-seller (the portal's natural entry point,
// where they sign in or finish onboarding).
// ============================================================================
export async function requireSeller(): Promise<AuthUser> {
  const user = await getServerSeller();
  if (!user || user.role !== "VENDOR") {
    redirect("/become-seller");
  }
  return user;
}
