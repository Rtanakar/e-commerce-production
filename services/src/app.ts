// ============================================================================
// app.ts — Express app configuration (Netflix/Uber-grade security)
// ============================================================================
// Middleware ORDER (industry production stack):
//   1.  Express native hardening (x-powered-by, etag, trust proxy)
//   2.  Helmet                    ← HTTP security headers
//   3.  Permissions-Policy        ← browser API restrictions
//   4.  No-store cache headers    ← sensitive data leak prevention
//   5.  Request ID                ← log/Sentry correlation
//   6.  Response time tracking    ← SLO monitoring
//   7.  CORS                      ← cross-origin policy
//   8.  Compression               ← response size optimization
//   9.  Body parsers              ← JSON + urlencoded
//  10.  Cookie parser             ← cookies access
//  11.  HPP prevention            ← duplicate query params
//  12.  Request logging (morgan→pino)
//  13.  Global rate limit         ← distributed (Upstash)
//  14.  Routes (health, /api/v1/*, docs)
//  15.  404 handler
//  16.  Error handler (4-arg, SABSE last)
// ============================================================================
// IMPORTANT: Order matters! Galat order me security holes ya broken UX
// ============================================================================

// Side-effect import - Express Request types augment (req.id, req.user, req.log)
// import "./@types/express.js";

import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { env, isDev, isProd, corsOrigins } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import {
  permissionsPolicy,
  noStoreCache,
  requestId,
  responseTime,
  preventHpp,
} from "./middlewares/security.js";
import { globalRateLimit } from "./middlewares/rate-limit.js";
import { ApiResponseBuilder } from "./interfaces/api-response.js";
import { HttpStatus } from "./utils/http-status.js";

// ─── Feature modules ───
import authRoutes from "./modules/auth/auth.routes.js";
import healthRoutes from "./modules/health/health.routes.js";
import docsRoutes from "./modules/docs/docs.routes.js";

const app = express();

// ============================================================================
// 1. Express native hardening
// ============================================================================
app.disable("x-powered-by");

// Trust first proxy in production - nginx/ALB/Vercel/Cloudflare
// req.ip aur req.protocol correct value denge (warna rate-limit galat IP pe lagega)
if (isProd) app.set("trust proxy", 1);

// ETag responses me sensitive data ka hash leak kar sakta - disable
app.set("etag", false);
app.set("strict routing", false);

// ============================================================================
// 2. Helmet - HTTP security headers
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    strictTransportSecurity: isProd
      ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    referrerPolicy: { policy: "no-referrer" },
    frameguard: { action: "deny" },
    noSniff: true,
    hidePoweredBy: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    originAgentCluster: true,
    xssFilter: true,
  }),
);

// ============================================================================
// 3. Permissions-Policy
// ============================================================================
app.use(permissionsPolicy());

// ============================================================================
// 4. No-store cache headers
// ============================================================================
app.use(noStoreCache());

// ============================================================================
// 5. Request ID
// ============================================================================
app.use(requestId());

// ============================================================================
// 6. Response time tracking
// ============================================================================
app.use(responseTime());

// ============================================================================
// 7. CORS
// ============================================================================
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["X-Request-Id", "X-Response-Time"],
    maxAge: 86400,
  }),
);

// ============================================================================
// 8. Compression
// ============================================================================
app.use(compression({ threshold: 1024, level: 6 }));

// ============================================================================
// 9. Body parsers
// ============================================================================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ============================================================================
// 10. Cookie parser
// ============================================================================
app.use(cookieParser());

// ============================================================================
// 11. HPP prevention
// ============================================================================
app.use(preventHpp([]));

// ============================================================================
// 12. Request logging - morgan piped to pino
// ============================================================================
const apiBase = `/${env.API_PREFIX}/${env.API_VERSION}`;

app.use(
  morgan(isDev ? "dev" : "combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    // Health probe + docs noise reduce - log aggregator costs save
    skip: (req) =>
      req.path === `${apiBase}/health` ||
      req.path === `${apiBase}/health/ready` ||
      req.path.startsWith(`${apiBase}/docs`),
  }),
);

// ============================================================================
// 13. Global rate limit - distributed (Upstash Redis)
// ============================================================================
// Per-route rate limits ADDITIONALLY auth routes pe lagte hai
// Health probes ko bypass karte hai - K8s probes throttle nahi hone chahiye
// ============================================================================
app.use((req, res, next) => {
  // Health checks aur docs - rate limit skip
  if (
    req.path === `${apiBase}/health` ||
    req.path === `${apiBase}/health/ready` ||
    req.path.startsWith(`${apiBase}/docs`)
  ) {
    return next();
  }
  return globalRateLimit(req, res, next);
});

// ============================================================================
// 14. Routes
// ============================================================================

// ----- Welcome -----
app.get("/", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      message: "E-Commerce API",
      version: env.API_VERSION,
      docs: `${apiBase}/docs`,
      health: `${apiBase}/health`,
    }),
    requestId: req.id,
  });
});

// Test
app.get("/test", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({
    message: "Test",
    requestId: req.id,
  });
});

// ----- Health probes (liveness + readiness) -----
app.use(`${apiBase}/health`, healthRoutes);

// ----- API documentation (Swagger UI + OpenAPI JSON) -----
// Production policy choice: public docs (Stripe-style) vs auth-gated
// For now: open in dev/staging, env flag se prod me toggle kar sakte hai
if (env.NODE_ENV !== "production" || process.env["ENABLE_DOCS"] === "true") {
  app.use(`${apiBase}/docs`, docsRoutes);
}

// ----- Auth module -----
app.use(`${apiBase}/auth`, authRoutes);

// ----- FUTURE MODULES (uncomment as they are built) -----
// app.use(`${apiBase}/users`,         userRoutes);
// app.use(`${apiBase}/products`,      productRoutes);
// app.use(`${apiBase}/vendors`,       vendorRoutes);
// app.use(`${apiBase}/cart`,          cartRoutes);
// app.use(`${apiBase}/orders`,        orderRoutes);
// app.use(`${apiBase}/payments`,      paymentRoutes);
// app.use(`${apiBase}/uploads`,       uploadRoutes);
// app.use(`${apiBase}/notifications`, notificationRoutes);
// app.use(`${apiBase}/search`,        searchRoutes);
// app.use(`${apiBase}/reviews`,       reviewRoutes);

// ============================================================================
// 15. 404 handler - sare routes ke baad
// ============================================================================
app.use(notFoundHandler);

// ============================================================================
// 16. Error handler - SABSE LAST (Express 4-arg signature)
// ============================================================================
app.use(errorHandler);

export default app;
