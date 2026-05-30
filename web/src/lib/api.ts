// ============================================================================
// api.ts — Thin fetch wrapper (FAANG pattern)
// ============================================================================
// Features:
//   - credentials: "include"           → httpOnly auth cookies auto-travel
//   - Typed envelope unwrapping        → { success, data } → data
//   - Auto-refresh on 401 (single-flight de-dupe)
//   - AUTOMATIC CSRF integration       → reads X-CSRF-Token from every
//                                        response, stores in memory, echoes
//                                        on every mutating request
//   - Typed ApiError on failure
//
// CSRF model (Stripe/GitHub Dashboard):
//   Backend pushes new CSRF token via X-CSRF-Token RESPONSE header on
//   /auth/me, /auth/login, /auth/refresh, etc. We capture it into a
//   module-level variable (memory only - XSS-resistant) and echo it back
//   as a REQUEST header on every POST/PUT/PATCH/DELETE.
// ============================================================================

// RELATIVE base by default — the browser calls same-origin `/api/v1/*`, which
// next.config.ts proxies to the backend. Same-origin = cookies keyed to the
// current host (localhost vs seller.localhost) = proper jar isolation.
// Override with NEXT_PUBLIC_API_URL only for non-proxied setups (e.g. native).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

// ============================================================================
// Backend envelope (mirrors services/src/interfaces/api-response.ts)
// ============================================================================
export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: unknown;
  requestId?: string;
};

export type ApiErrorPayload = {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
};

// ============================================================================
// ApiError - typed error class for instanceof checks in components
// ============================================================================
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ============================================================================
// CSRF in-memory store (XSS-resistant - JS variable, not DOM)
// ============================================================================
// Set by captureCsrfFromResponse on every backend response that carries
// X-CSRF-Token (login/refresh/verify-otp/me). Read by request() on every
// mutating call.
//
// Cookie fallback (document.cookie) used ONLY if memory empty - protects
// against initial cold-start before /auth/me has been called.
// ============================================================================
let csrfTokenMemory: string | null = null;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "X-CSRF-Token";

function captureCsrfFromResponse(res: Response): void {
  // Header name is case-insensitive per Fetch spec
  const token = res.headers.get("x-csrf-token");
  if (token) csrfTokenMemory = token;
}

function readCsrfFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function getCsrfToken(): string | null {
  // Memory is canonical, cookie is fallback (for first request before
  // any response has populated memory)
  return csrfTokenMemory ?? readCsrfFromCookie();
}

/** Programmatic access - useful if a component needs to refetch CSRF */
export function getCurrentCsrfToken(): string | null {
  return getCsrfToken();
}

/** Clear CSRF on sign-out so next user gets a fresh one */
export function clearCsrfToken(): void {
  csrfTokenMemory = null;
}

// ============================================================================
// Single-flight refresh - prevents N concurrent 401s firing N refresh calls
// ============================================================================
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const csrf = getCsrfToken();
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf && { [CSRF_HEADER]: csrf }),
        },
        body: JSON.stringify({}),
      });
      // Capture rotated CSRF on success (refresh response has new token)
      if (res.ok) captureCsrfFromResponse(res);
      return res.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

// ============================================================================
// Core request - handles retry-on-401 + envelope unwrap + CSRF auto-attach
// ============================================================================
type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipRefresh?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = opts;

  const method = (rest.method ?? "GET").toUpperCase();
  const needsCsrf = !SAFE_METHODS.has(method);
  const csrf = needsCsrf ? getCsrfToken() : null;

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

  // Capture any rotated CSRF token from response (login/refresh/me/etc)
  captureCsrfFromResponse(res);

  // ----- Auto-refresh on 401 (one retry) -----
  if (res.status === 401 && !skipRefresh) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // After refresh, CSRF was rotated → use freshly captured token
      const newCsrf = needsCsrf ? getCsrfToken() : null;
      res = await fetch(`${API_URL}${path}`, buildInit(newCsrf));
      captureCsrfFromResponse(res);
    }
  }

  // ----- Parse JSON (some endpoints return 204 no-content) -----
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
// Convenience method exports
// ============================================================================
export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
