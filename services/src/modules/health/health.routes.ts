// ============================================================================
// health.routes.ts - Liveness + Readiness probes
// ============================================================================
// Kubernetes/ECS pattern:
//   - Liveness  (/health)       : "process alive" - light check, no deps
//   - Readiness (/health/ready) : "ready to serve traffic" - deep check (DB + Redis)
//   - Startup   (/health/startup): "startup complete" - one-time (optional)
//
// Why split?
//   - Liveness fail → pod restart
//   - Readiness fail → remove from LB rotation (no restart)
//
// Liveness me DB check NEVER - DB outage me sab pods restart loop = disaster
// ============================================================================

import { Router, type Request, type Response } from "express";
import { pingPrisma } from "../../db/prisma.js";
import { redis } from "../../lib/redis.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

const router: Router = Router();

// ============================================================================
// Liveness - process responsive hai kya
// ============================================================================
router.get("/", (req: Request, res: Response) => {
  res.status(HttpStatus.OK).json({
    ...ApiResponseBuilder.success({
      status: "ok",
      service: "ecommerce-api",
      env: env.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
    requestId: req.id,
  });
});

// ============================================================================
// Readiness - dependencies reachable hai kya
// ============================================================================
router.get("/ready", async (req: Request, res: Response) => {
  // Parallel pings - faster than sequential
  const [dbHealthy, redisHealthy] = await Promise.all([pingPrisma(), pingRedis()]);

  const allHealthy = dbHealthy && redisHealthy;
  const body = {
    status: allHealthy ? "ready" : "not_ready",
    checks: {
      database: dbHealthy ? "ok" : "fail",
      redis: redisHealthy ? "ok" : "fail",
    },
    timestamp: new Date().toISOString(),
  };

  if (allHealthy) {
    res.status(HttpStatus.OK).json({
      ...ApiResponseBuilder.success(body),
      requestId: req.id,
    });
  } else {
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      ...ApiResponseBuilder.success(body),
      requestId: req.id,
    });
  }
});

// ============================================================================
// Redis ping helper - timeout-bounded
// ============================================================================
// Upstash REST - HTTP timeout default high, hum 2s bound
async function pingRedis(): Promise<boolean> {
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), 2000),
      ),
    ]);
    return result === "PONG";
  } catch (err) {
    logger.error({ err }, "Redis health check failed");
    return false;
  }
}

export default router;
