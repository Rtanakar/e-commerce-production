// ============================================================================
// startup-banner.ts — Production boot diagnostics
// ============================================================================
// Jab app boot ho to clearly dikhe:
//   - Environment (dev/prod)
//   - DB connected ya nahi
//   - Redis reachable ya nahi
//   - JWT secrets configured
//   - Server URL + docs URL
//
// Industry standard - Netflix, Vercel, Stripe boot logs me ye dikhta hai
// Debugging time bachata hai: immediately pata "DB down" vs "code crash"
// ============================================================================

import { prisma } from "../db/prisma.js";
import { pingRedis } from "../lib/redis.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

interface ServiceStatus {
  name: string;
  status: "ok" | "fail" | "skipped";
  detail?: string;
}

// ----------------------------------------------------------------------------
// PostgreSQL - actual query maar ke connection verify
// ----------------------------------------------------------------------------
async function checkDatabase(): Promise<ServiceStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "PostgreSQL", status: "ok", detail: "connected" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name: "PostgreSQL", status: "fail", detail: msg };
  }
}

// ----------------------------------------------------------------------------
// Redis - ioredis ping (TCP)
// ----------------------------------------------------------------------------
async function checkRedis(): Promise<ServiceStatus> {
  const ok = await pingRedis(2000);
  return ok
    ? { name: "Redis", status: "ok", detail: "PONG" }
    : { name: "Redis", status: "fail", detail: "ping failed" };
}

// ----------------------------------------------------------------------------
// JWT - secrets configured hai ya nahi (length-based heuristic)
// ----------------------------------------------------------------------------
function checkJwt(): ServiceStatus {
  if (env.JWT_ACCESS_SECRET.length < 32 || env.JWT_REFRESH_SECRET.length < 32) {
    return { name: "JWT", status: "fail", detail: "secrets too short" };
  }
  return { name: "JWT", status: "ok", detail: "secrets configured" };
}

// ----------------------------------------------------------------------------
// Sentry - DSN configured hai ya nahi
// ----------------------------------------------------------------------------
function checkSentry(): ServiceStatus {
  if (!env.SENTRY_DSN) {
    return { name: "Sentry", status: "skipped", detail: "no DSN" };
  }
  return { name: "Sentry", status: "ok", detail: "tracking enabled" };
}

// ============================================================================
// Main banner - sab checks chalakar print
// ============================================================================
export async function printStartupBanner(port: number): Promise<void> {
  // Parallel checks - boot time bachao
  const [db, redisStatus, jwt, sentry] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkJwt()),
    Promise.resolve(checkSentry()),
  ]);

  const services = [db, redisStatus, jwt, sentry];
  const allOk = services.every((s) => s.status !== "fail");

  // Plain ASCII - Windows cmd safe (no emoji garbage)
  const line = "-".repeat(60);
  const baseUrl = `http://localhost:${port}/${env.API_PREFIX}/${env.API_VERSION}`;

  logger.info(line);
  logger.info(`  E-Commerce API`);
  logger.info(`  Environment : ${env.NODE_ENV.toUpperCase()}`);
  logger.info(`  Node        : ${process.version}`);
  logger.info(`  PID         : ${process.pid}`);
  logger.info(`  Base URL    : ${baseUrl}`);
  logger.info(`  Health      : ${baseUrl}/health`);
  logger.info(`  Docs        : ${baseUrl}/docs`);
  logger.info(line);
  logger.info(`  Service checks:`);

  for (const s of services) {
    const tag =
      s.status === "ok" ? "[ OK    ]" : s.status === "fail" ? "[ FAIL  ]" : "[ SKIP  ]";
    logger.info(`  ${tag}  ${s.name.padEnd(12)} ${s.detail ?? ""}`);
  }

  logger.info(line);
  if (allOk) {
    logger.info(`  Server READY - accepting connections on port ${port}`);
  } else {
    logger.warn(`  Server started - some services FAILED (see above)`);
  }
  logger.info(line);
}
