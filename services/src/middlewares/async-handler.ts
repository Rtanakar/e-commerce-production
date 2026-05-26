// ============================================================================
// async-handler.ts - Async route wrapper
// ============================================================================
// Express 4 me async errors automatically catch nahi hote
// Har controller me try/catch dalna boilerplate - is wrapper se DRY
//
// Express 5 me native async support hai but explicit wrapper still recommended:
// - error types narrowed
// - future-proof if migrating frameworks
// - explicit > implicit (Python Zen lol)
//
// Usage:
//   router.get("/", asyncHandler(async (req, res) => { ... }))
// ============================================================================

import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  (fn: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    // Promise.resolve - sync errors bhi catch kar lega
    Promise.resolve(fn(req, res, next)).catch(next);
  };
