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

import { PrismaClient, Prisma as PrismaNS } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { env, isDev, isProd } from "../config/env.js";
import { logger } from "../utils/logger.js";

// ============================================================================
// Transient connection error detection + retry
// ============================================================================
// Pooled / serverless DBs (pooled.db.prisma.io, RDS Proxy, Neon, Supabase
// pooler) idle connections ko drop kar dete hain. Jab pool ka stale connection
// reuse hota hai to "Server has closed the connection" jaisa transient error
// aata hai — query DB tak pahunchi hi nahi, isliye retry SAFE hai (idempotent).
// Amazon/Netflix pattern: transient infra errors pe chhota exponential backoff
// retry, taaki ek connection blip user ko 500 na de.
// ============================================================================
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // can't reach DB server
  "P1002", // DB server reached but timed out
  "P1008", // operation timed out
  "P1017", // server has closed the connection
]);

function isTransientDbError(err: unknown): boolean {
  if (err instanceof PrismaNS.PrismaClientInitializationError) return true;
  if (
    err instanceof PrismaNS.PrismaClientKnownRequestError &&
    TRANSIENT_PRISMA_CODES.has(err.code)
  ) {
    return true;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("server has closed the connection") ||
    msg.includes("connection terminated") ||
    msg.includes("connection closed") ||
    msg.includes("econnreset") ||
    msg.includes("connection refused") ||
    msg.includes("timeout")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
// Client factory — base client + transient-retry extension
// ============================================================================
// $extends query wrapper har model operation ko intercept karke transient
// connection errors pe retry karta hai (max 3 attempts, 150/300ms backoff).
// Interactive $transaction ke ANDAR retry nahi hota (partial-commit risk) —
// sirf top-level ops. Non-transient errors turant rethrow.
function createPrismaClient() {
  const base = new PrismaClient({
    adapter,
    // Dev: query + warnings + errors. Prod: warnings + errors only (queries flood logs)
    log: isDev ? ["query", "warn", "error"] : ["warn", "error"],
  });

  return base.$extends({
    query: {
      async $allOperations({ args, query, model, operation }) {
        const MAX_ATTEMPTS = 3;
        let lastErr: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastErr = err;
            if (!isTransientDbError(err) || attempt === MAX_ATTEMPTS) throw err;
            logger.warn(
              { model, operation, attempt },
              "[prisma] transient DB error — retrying",
            );
            await sleep(attempt * 150); // 150ms, 300ms backoff
          }
        }
        throw lastErr;
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// ============================================================================
// Type-safe global cache (dev hot-reload safety)
// ============================================================================
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

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
