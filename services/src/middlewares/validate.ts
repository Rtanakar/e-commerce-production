// ============================================================================
// validate.ts - Zod schema validation middleware
// ============================================================================
// Body/query/params validate karke req[source] pe parsed data replace
// Downstream code me type-safe access (defaults + transforms applied)
// ============================================================================

import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors.js";

type Source = "body" | "query" | "params";

// ============================================================================
// assignValidated — parsed data ko req[source] pe set karo (Express 5 safe)
// ============================================================================
// Express 5 me `req.query` aur `req.params` GETTER-ONLY ban gaye hain (koi
// setter nahi) — seedha `req.query = data` karne pe:
//   "TypeError: Cannot set property query of #<IncomingMessage> which has only a getter"
// Fix: getter-only props ko Object.defineProperty se data-property me override
// karo (configurable getter ko redefine kar deta hai). `body` writable hai →
// normal assignment chalega.
// ============================================================================
function assignValidated(req: Request, source: Source, data: unknown): void {
  if (source === "body") {
    req.body = data;
    return;
  }
  Object.defineProperty(req, source, {
    value: data,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

// Single source validation
export function validate(schema: ZodSchema, source: Source = "body"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
        code: i.code,
      }));
      return next(new ValidationError(`Invalid ${source}`, details));
    }
    assignValidated(req, source, result.data);
    next();
  };
}

// Multi-source validation - body + query + params in one middleware
// Usage: validateRequest({ body: createSchema, params: idSchema })
export function validateRequest(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const allDetails: Array<{ source: string; field: string; message: string }> = [];

    for (const [source, schema] of Object.entries(schemas) as Array<[Source, ZodSchema]>) {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          allDetails.push({
            source,
            field: issue.path.join("."),
            message: issue.message,
          });
        }
      } else {
        assignValidated(req, source, result.data);
      }
    }

    if (allDetails.length > 0) {
      return next(new ValidationError("Request validation failed", allDetails));
    }
    next();
  };
}
