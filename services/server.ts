// ============================================================================
// server.ts - HTTP server bootstrap (ROOT level - not in src/)
// ============================================================================
// Why root not src/?
// - Cleaner separation: server orchestration vs application code
// - Docker COPY pattern: copy src/ + server.ts separately, optimize layers
// - User preference (NestJS pattern: main.ts at root of source)
//
// Responsibilities:
//   1. Create Express app
//   2. Start HTTP server
//   3. Handle graceful shutdown (SIGTERM/SIGINT)
//   4. Catch unhandled errors (last resort)
// ============================================================================

import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";
import { disconnectPrisma } from "./src/db/prisma.js";
import { disconnectRedis } from "./src/lib/redis.js";
import { closeMailer } from "./src/lib/mailer.js";
import { printStartupBanner } from "./src/utils/startup-banner.js";
import app from "@/app.js";

// ============================================================================
// Bootstrap
// ============================================================================

const server = app.listen(env.PORT, () => {
  // Async banner - DB/Redis pings + boot diagnostics
  // Listen callback ke andar async chala sakte hai, server already listening hai
  void printStartupBanner(env.PORT).catch((err) => {
    logger.error({ err }, "Startup banner failed");
  });
});

// Server-level timeouts - hanging connections prevent
// Production load balancer ke peeche - LB ka timeout > server timeout zaruri
server.keepAliveTimeout = 65_000; // 65s - AWS ALB default 60s se zyada
server.headersTimeout = 70_000; // headersTimeout > keepAliveTimeout (Node bug fix)
server.requestTimeout = 30_000; // 30s per request

// ============================================================================
// Graceful shutdown
// ============================================================================
// SIGTERM - Kubernetes/Docker pod kill se pehle bhejta hai
// SIGINT - Ctrl+C dev me
//
// Flow:
//   1. Naye connections accept band
//   2. Existing in-flight requests complete hone do
//   3. DB connection close
//   4. Process exit clean
//
// 10s timeout - infinite hang prevent (k8s pod kill 30s after SIGTERM)
// ============================================================================
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, "Already shutting down, ignoring signal");
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, "Graceful shutdown initiated");

  // Force exit timeout - hanging requests forever wait nahi karenge
  const forceExitTimer = setTimeout(() => {
    logger.fatal("Forced shutdown - 10s timeout exceeded");
    process.exit(1);
  }, 10_000);
  // unref - timer khud process keep alive na kare
  forceExitTimer.unref();

  // Server close - naye connections band, existing complete hone do
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error while closing server");
      clearTimeout(forceExitTimer);
      process.exit(1);
    }

    try {
      // Drain connections in parallel - DB + Redis + Mailer
      await Promise.allSettled([
        disconnectPrisma(),
        disconnectRedis(),
        closeMailer(),
      ]);
      logger.info("✅ Cleanly shut down");
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (cleanupErr) {
      logger.error({ err: cleanupErr }, "Error during cleanup");
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// ============================================================================
// Last resort error handlers
// ============================================================================
// Ye hone nahi chahiye - har async error catch hona chahiye normally
// Agar yahan pahuncha to bug hai - crash karo, PM2/k8s restart kar dega
// Silent recovery se data corrupt ho sakta hai
// ============================================================================
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.fatal({ reason, promise }, "Unhandled Promise rejection - CRASHING");
  // Allow logs to flush before exit
  setTimeout(() => process.exit(1), 100).unref();
});

process.on("uncaughtException", (err: Error) => {
  logger.fatal({ err }, "Uncaught exception - CRASHING");
  setTimeout(() => process.exit(1), 100).unref();
});

// Warning events - log only, don't crash
process.on("warning", (warning) => {
  logger.warn({ warning }, "Node.js warning");
});
