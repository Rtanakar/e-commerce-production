// ============================================================================
// logger.ts — Pino logger setup
// ============================================================================
// Industry me console.log NAHI use karte production me. Kyon?
//   1. console.log SYNCHRONOUS hai → event loop block karta hai under load
//   2. No log levels (info/warn/error filtering nahi)
//   3. No structured JSON → log aggregators (Datadog, Loki, Better Stack) parse nahi karte
//   4. No request correlation IDs
//
// Pino: fastest Node.js logger, JSON output, async transport, structured.
// Dev me human-readable chahiye → pino-pretty worker thread me chalta hai
// Prod me raw JSON → log aggregator ke liye perfect
// ============================================================================

import pino from "pino";
import { env, isDev } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,

  // Dev: pretty-print (colored). Prod: raw JSON.
  // pino-pretty transport worker thread me - main thread block nahi
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Production tag - log aggregator me filter karne ke liye
  base: isDev ? undefined : { service: "ecommerce-api", env: env.NODE_ENV },

  // ISO timestamps - aggregators parse easily
  timestamp: pino.stdTimeFunctions.isoTime,

  // Sensitive fields automatic redact - GDPR/PCI compliance
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.secret",
      "*.apiKey",
      "*.cardNumber",
      "*.cvv",
    ],
    censor: "[REDACTED]",
  },

  // Standard serializers - Error stack/cause + Request/Response shape
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
