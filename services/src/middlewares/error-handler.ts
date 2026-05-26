// ============================================================================
// error-handler.ts - Centralized error & 404 handlers
// ============================================================================
// Express me 4-arg signature error middleware ko identify karta hai
// SABSE LAST mount karna - routes ke baad, warna chain me skip ho jata
// ============================================================================

import type { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors.js";
import { ApiResponseBuilder } from "../interfaces/api-response.js";
import { HttpStatus, ErrorCode } from "../utils/http-status.js";
import { logger } from "../utils/logger.js";
import { isProd } from "../config/env.js";

// ============================================================================
// 404 handler
// ============================================================================
export function notFoundHandler(req: Request, res: Response): void {
  res.status(HttpStatus.NOT_FOUND).json(
    ApiResponseBuilder.error(
      ErrorCode.NOT_FOUND,
      `Route ${req.method} ${req.originalUrl} does not exist`,
    ),
  );
}

// ============================================================================
// Main error handler - 4-arg signature (DO NOT remove _next)
// ============================================================================
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const log = req.log ?? logger;
  const requestId = req.id;

  // ===== 1. Custom AppError (all expected errors) =====
  if (err instanceof AppError) {
    const logLevel = err.isOperational ? "warn" : "error";
    log[logLevel]({ err: err.toJSON(), requestId }, `${err.code}: ${err.message}`);

    res.status(err.statusCode).json({
      ...ApiResponseBuilder.error(err.code, err.message, err.details),
      requestId,
    });
    return;
  }

  // ===== 2. Zod validation errors (uncaught - normally caught by validate middleware) =====
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
      code: i.code,
    }));
    log.warn({ details, requestId }, "Validation failed");
    res.status(HttpStatus.BAD_REQUEST).json({
      ...ApiResponseBuilder.error(ErrorCode.VALIDATION_FAILED, "Validation failed", details),
      requestId,
    });
    return;
  }

  // ===== 3. JWT errors =====
  if (err instanceof jwt.TokenExpiredError) {
    res.status(HttpStatus.UNAUTHORIZED).json({
      ...ApiResponseBuilder.error(ErrorCode.TOKEN_EXPIRED, "Token has expired"),
      requestId,
    });
    return;
  }
  if (err instanceof jwt.JsonWebTokenError) {
    res.status(HttpStatus.UNAUTHORIZED).json({
      ...ApiResponseBuilder.error(ErrorCode.INVALID_TOKEN, "Invalid token"),
      requestId,
    });
    return;
  }

  // ===== 4. Prisma known errors =====
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    log.warn({ code: err.code, meta: err.meta, requestId }, "Prisma known error");

    // P2002 - unique constraint
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      res.status(HttpStatus.CONFLICT).json({
        ...ApiResponseBuilder.error(
          ErrorCode.CONFLICT,
          `Duplicate value for ${target}`,
        ),
        requestId,
      });
      return;
    }
    // P2025 - record not found
    if (err.code === "P2025") {
      res.status(HttpStatus.NOT_FOUND).json({
        ...ApiResponseBuilder.error(ErrorCode.NOT_FOUND, "Record not found"),
        requestId,
      });
      return;
    }
    // P2003 - foreign key violation
    if (err.code === "P2003") {
      res.status(HttpStatus.BAD_REQUEST).json({
        ...ApiResponseBuilder.error(ErrorCode.BAD_REQUEST, "Related record not found"),
        requestId,
      });
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    log.warn({ err: err.message, requestId }, "Prisma validation error");
    res.status(HttpStatus.BAD_REQUEST).json({
      ...ApiResponseBuilder.error(ErrorCode.BAD_REQUEST, "Invalid database query"),
      requestId,
    });
    return;
  }

  // ===== 5. Unknown errors - bug class =====
  // Production: NEVER expose stack trace - security risk
  // Dev: expose for debugging
  log.error(
    {
      err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      requestId,
    },
    "Unhandled error",
  );

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    ...ApiResponseBuilder.error(
      ErrorCode.INTERNAL,
      isProd
        ? "An internal server error occurred"
        : err instanceof Error
          ? err.message
          : "Unknown error",
      isProd ? undefined : { stack: err instanceof Error ? err.stack : undefined },
    ),
    requestId,
  });
}
