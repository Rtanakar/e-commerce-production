// ============================================================================
// health.routes.ts - Liveness + Readiness probes
// ============================================================================
// Kubernetes/ECS pattern:
//   - Liveness  (/health)       : "process alive" - light check, no deps
//   - Readiness (/health/ready) : "ready to serve traffic" - deep check (DB + Redis)
//
// Why split?
//   - Liveness fail → pod restart
//   - Readiness fail → remove from LB rotation (no restart)
//
// Liveness me DB check NEVER - DB outage pe sab pods restart loop = disaster
// ============================================================================

import { Router, type Request, type Response } from "express";
import { pingPrisma } from "../../db/prisma.js";
import { pingRedis } from "../../lib/redis.js";
import { ApiResponseBuilder } from "../../interfaces/api-response.js";
import { HttpStatus } from "../../utils/http-status.js";
import { env } from "../../config/env.js";

const router: Router = Router();

// ============================================================================
// Liveness - process responsive hai kya (no dependencies)
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
// Readiness - dependencies reachable hai kya (deep check)
// ============================================================================
router.get("/ready", async (req: Request, res: Response) => {
  // Parallel pings - faster than sequential
  const [dbHealthy, redisHealthy] = await Promise.all([pingPrisma(), pingRedis(2000)]);

  const allHealthy = dbHealthy && redisHealthy;
  const body = {
    status: allHealthy ? "ready" : "not_ready",
    checks: {
      database: dbHealthy ? "ok" : "fail",
      redis: redisHealthy ? "ok" : "fail",
    },
    timestamp: new Date().toISOString(),
  };

  res
    .status(allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
    .json({ ...ApiResponseBuilder.success(body), requestId: req.id });
});

export default router;
