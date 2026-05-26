// ============================================================================
// security.ts - Netflix/Uber grade security middlewares
// ============================================================================
// Helmet ke alawa ye additional defense-in-depth layers:
//   1. permissionsPolicy  - browser feature restrictions
//   2. noStoreCache       - sensitive responses CDN/proxy me cache na ho
//   3. requestId          - distributed tracing correlation
//   4. responseTime       - X-Response-Time header (SLO/APM)
//   5. preventHpp         - HTTP Parameter Pollution prevention
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

// ============================================================================
// 1. Permissions-Policy
// ============================================================================
// XSS hone par bhi attacker camera/mic/location nahi le sakta
// Helmet 8 me built-in nahi - manually set
// ============================================================================
export function permissionsPolicy() {
  const policy = [
    "accelerometer=()",
    "ambient-light-sensor=()",
    "autoplay=()",
    "battery=()",
    "camera=()",
    "display-capture=()",
    "document-domain=()",
    "encrypted-media=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "sync-xhr=()",
    "usb=()",
    "web-share=()",
    "xr-spatial-tracking=()",
    "interest-cohort=()", // FLoC opt-out
  ].join(", ");

  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Permissions-Policy", policy);
    next();
  };
}

// ============================================================================
// 2. No-Store cache headers
// ============================================================================
// Authenticated APIs ke responses shared cache/CDN me leak na ho
// Banks/healthcare/FAANG - sab enforce karte hai
// ============================================================================
export function noStoreCache() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
  };
}

// ============================================================================
// 3. Request ID - distributed tracing
// ============================================================================
// Har request unique ID - logs/Sentry/downstream services me correlate karte hai
// Client X-Request-Id bheje to wahi use karo, warna naya generate
// ============================================================================
export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"] ?? req.headers["x-correlation-id"];
    const id = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();

    req.id = id;
    res.setHeader("X-Request-Id", id);

    // Per-request scoped child logger - is request ke saare logs me requestId attach
    req.log = logger.child({ requestId: id });

    next();
  };
}

// ============================================================================
// 4. Response time - X-Response-Time header
// ============================================================================
// CRITICAL FIX: res.on("finish") ke baad setHeader = ERR_HTTP_HEADERS_SENT
// Solution: res.writeHead ko override karke header set karte hai - jab headers
//   actually flush hone wali hoti hai, tabhi.
// Industry: ye exact pattern `response-time` npm package use karta hai
// ============================================================================
export function responseTime() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    const originalWriteHead = res.writeHead.bind(res);

    // Override writeHead - headers flush hone se PEHLE X-Response-Time inject
    // any cast: writeHead ka overloaded signature TS me messy hai
    (res as unknown as { writeHead: (...args: unknown[]) => Response }).writeHead = (
      ...args: unknown[]
    ): Response => {
      // Headers already sent ho gaye to skip (double-call edge case)
      if (!res.headersSent) {
        const diffNs = process.hrtime.bigint() - start;
        const ms = Number(diffNs) / 1_000_000;
        res.setHeader("X-Response-Time", `${ms.toFixed(2)}ms`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalWriteHead as any)(...args);
    };

    next();
  };
}

// ============================================================================
// 5. HTTP Parameter Pollution prevention
// ============================================================================
// ?id=1&id=2 → req.query.id = ["1", "2"] - business logic break ho sakta
// Pehla value rakho, baaki drop (whitelist me jo hai woh array allowed)
// ============================================================================
export function preventHpp(whitelist: string[] = []) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.query) return next();
    for (const key of Object.keys(req.query)) {
      if (whitelist.includes(key)) continue;
      const val = req.query[key];
      if (Array.isArray(val)) {
        req.query[key] = val[0];
      }
    }
    next();
  };
}
