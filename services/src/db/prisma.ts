// ============================================================================
// prisma.ts — Prisma Client singleton (Postgres via PG driver adapter)
// ============================================================================
// Prisma 7 me "driver adapters" pattern industry standard ban gaya hai.
// @prisma/adapter-pg use kar rahe hain - node-postgres (pg) underlying driver.
//
// Benefits:
//   - Edge runtimes compatible (Vercel Edge, Cloudflare Workers future-ready)
//   - Connection pooling pg ke through (battle-tested at scale)
//   - Prisma engine binary ki dependency kam - faster cold-start
//   - Direct PG features access (LISTEN/NOTIFY, COPY etc.)
//
// Singleton kyun? Har naya PrismaClient = naya connection pool.
// Dev hot-reload pe leak → "too many connections" error.
// globalThis pe cache karke avoid.
// ============================================================================

import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { env, isDev, isProd } from "../config/env.js";
import { logger } from "../utils/logger.js";

// ============================================================================
// PG adapter - connection pool tuning yaha
// ============================================================================
// Production tuning: max=10 per instance typical (PG default max_connections=100)
// 10 instances x 10 conns = 100 - fits in PG limits
// idleTimeoutMillis low - cloud DBs idle connections drop karte hai
// ============================================================================
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: isProd ? 10 : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// ============================================================================
// Type-safe global cache (dev hot-reload safety)
// ============================================================================
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Dev: query + warnings + errors. Prod: warnings + errors only (queries flood logs)
    log: isDev ? ["query", "warn", "error"] : ["warn", "error"],
  });

// Dev me global pe cache - prod me singleton module-cache se aata hai
if (isDev) globalForPrisma.prisma = prisma;

// ============================================================================
// Graceful disconnect helper - server.ts shutdown me call
// ============================================================================
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info("Prisma client disconnected");
}

// ============================================================================
// Health check helper - readiness probe ke liye
// ============================================================================
// Lightweight query - DB reachable hai ya nahi
// ============================================================================
export async function pingPrisma(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, "Prisma health check failed");
    return false;
  }
}

// Re-exports - consuming code single import path
export { Prisma } from "../generated/prisma/client.js";
export type * from "../generated/prisma/client.js";
