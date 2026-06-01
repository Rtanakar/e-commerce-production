// ============================================================================
// lib/seller-auth/api.ts — Seller portal API client (separate cookie jar)
// ============================================================================
// Mirrors lib/api.ts but talks to /api/v1/auth/seller/* and reads/writes the
// SELLER CSRF cookie (s_csrf), not the customer one (csrf).
//
// Why a second client?
//   - Seller cookies (s_at / s_rt / s_csrf) live in a parallel cookie jar.
//   - The browser sends s_csrf as a cookie automatically; we just need to
//     echo it correctly. But the IN-MEMORY CSRF token must NOT mix with the
//     customer one — that would leak the wrong token between portals.
//   - Auto-refresh must hit /auth/seller/refresh to rotate s_rt → s_at, not
//     the customer /auth/refresh (which rotates at/rt).
//
// Production parallel: Amazon Seller Central JS bundle has its own auth
// shim that posts to sellers-only endpoints; never touches www.amazon.com auth.
// ============================================================================

// RELATIVE base (same-origin proxy) — see lib/api.ts for the why. Critical
// for seller-cookie isolation: this client runs on seller.localhost, so its
// requests stay same-origin and cookies bind to seller.localhost only.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

// Reuse the same envelope shape + ApiError class from customer client so
// existing TanStack `instanceof ApiError` checks work for seller flows too.
import { ApiError, type ApiSuccess, type ApiErrorPayload } from "../api";

// ============================================================================
// CSRF memory — SEPARATE from customer's csrfTokenMemory
// ============================================================================
// The two jars MUST NOT cross-contaminate. If we wrote to the customer
// memory variable from a seller response (or vice versa), a /shop request
// could echo the seller CSRF and fail HMAC verification.
// ============================================================================
let sellerCsrfMemory: string | null = null;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "X-CSRF-Token";

function captureSellerCsrf(res: Response): void {
  const token = res.headers.get("x-csrf-token");
  if (token) sellerCsrfMemory = token;
}

function readSellerCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  // Must match backend SellerCookieNames.CSRF in services/src/utils/cookies.ts
  const match = document.cookie.match(/(?:^|;\s*)seller-csrf-token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getSellerCsrf(): string | null {
  return sellerCsrfMemory ?? readSellerCsrfCookie();
}

export function getCurrentSellerCsrfToken(): string | null {
  return getSellerCsrf();
}

export function clearSellerCsrfToken(): void {
  sellerCsrfMemory = null;
}

// ============================================================================
// Single-flight seller refresh
// ============================================================================
let sellerRefreshPromise: Promise<boolean> | null = null;

async function refreshSellerTokens(): Promise<boolean> {
  if (sellerRefreshPromise) return sellerRefreshPromise;

  sellerRefreshPromise = (async () => {
    try {
      const csrf = getSellerCsrf();
      const res = await fetch(`${API_URL}/auth/seller/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf && { [CSRF_HEADER]: csrf }),
        },
        body: JSON.stringify({}),
      });
      if (res.ok) captureSellerCsrf(res);
      return res.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        sellerRefreshPromise = null;
      }, 0);
    }
  })();

  return sellerRefreshPromise;
}

// ============================================================================
// Core seller request
// ============================================================================
type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipRefresh?: boolean;
};

async function sellerRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = opts;

  const method = (rest.method ?? "GET").toUpperCase();
  const needsCsrf = !SAFE_METHODS.has(method);
  const csrf = needsCsrf ? getSellerCsrf() : null;

  const buildInit = (csrfToken: string | null): RequestInit => ({
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(csrfToken && { [CSRF_HEADER]: csrfToken }),
      ...headers,
    },
    ...(body !== undefined && {
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  });

  let res = await fetch(`${API_URL}${path}`, buildInit(csrf));
  captureSellerCsrf(res);

  // Auto-refresh on 401 (one retry) — uses seller refresh endpoint
  if (res.status === 401 && !skipRefresh) {
    const refreshed = await refreshSellerTokens();
    if (refreshed) {
      const newCsrf = needsCsrf ? getSellerCsrf() : null;
      res = await fetch(`${API_URL}${path}`, buildInit(newCsrf));
      captureSellerCsrf(res);
    }
  }

  const text = await res.text();
  const json = text
    ? (JSON.parse(text) as ApiSuccess<T> | ApiErrorPayload)
    : null;

  if (!res.ok || (json && "success" in json && !json.success)) {
    const errPayload = json as ApiErrorPayload | null;
    throw new ApiError(
      res.status,
      errPayload?.error?.code ?? "UNKNOWN",
      errPayload?.error?.message ?? `Request failed: ${res.status}`,
      errPayload?.error?.details,
      errPayload?.requestId,
    );
  }

  return (json as ApiSuccess<T>).data;
}

// ============================================================================
// sellerApi — convenience methods
// ============================================================================
export const sellerHttp = {
  get: <T>(path: string, opts?: RequestOptions) =>
    sellerRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    sellerRequest<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    sellerRequest<T>(path, { ...opts, method: "PATCH", body }),
  // delete body optional (uploads delete bhejta hai { key })
  del: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    sellerRequest<T>(path, { ...opts, method: "DELETE", body }),
};

// ============================================================================
// Typed endpoint wrappers
// ============================================================================
import type { AuthUser, AuthResponse } from "../auth/api";

export const sellerAuthApi = {
  /** Register a seller account (role=VENDOR forced server-side) - sends OTP */
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
  }) =>
    sellerHttp.post<{ email: string; otpSent: boolean; message?: string }>(
      "/auth/seller/register",
      input,
      { skipRefresh: true },
    ),

  /** Verify OTP — marks email verified, NO tokens issued (industry pattern) */
  verifyOtp: (input: { email: string; otp: string }) =>
    sellerHttp.post<{ email: string; verified: boolean; message: string }>(
      "/auth/seller/verify-otp",
      input,
      { skipRefresh: true },
    ),

  /** Resend OTP */
  resendOtp: (input: { email: string }) =>
    sellerHttp.post<{ otpSent: boolean; message?: string }>(
      "/auth/seller/resend-otp",
      input,
      { skipRefresh: true },
    ),

  /** Seller login — refuses non-VENDOR users. Sets s_at/s_rt/s_csrf cookies. */
  signIn: (input: { email: string; password: string }) =>
    sellerHttp.post<AuthResponse>("/auth/seller/login", input, {
      skipRefresh: true,
    }),

  /** Current seller (from s_at cookie). Captures X-CSRF-Token on response. */
  me: () => sellerHttp.get<AuthUser>("/auth/seller/me"),

  /** Logout — revokes seller session, clears s_* cookies only */
  signOut: () => sellerHttp.post<{ message: string }>("/auth/seller/logout"),

  // ── Phone verification (SMS OTP, seller cookie jar) ──────────────────────
  /** Send SMS OTP to the seller's phone (optionally set/change it first).
   *  Returns the masked phone for UI display. */
  sendPhoneOtp: (input: { phone?: string } = {}) =>
    sellerHttp.post<{ phone: string; otpSent: boolean; message: string }>(
      "/auth/seller/phone/send-otp",
      input,
    ),

  /** Verify the SMS OTP → stamps phoneVerified on the account. */
  verifyPhoneOtp: (input: { otp: string }) =>
    sellerHttp.post<{ phoneVerified: boolean; message: string }>(
      "/auth/seller/phone/verify",
      input,
    ),
};
