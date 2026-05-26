// ============================================================================
// express.d.ts - Express Request type augmentation
// ============================================================================
// Custom properties (req.user, req.id) ko type-safe banane ke liye
// is se "Property 'user' does not exist on Request" warning nahi aati
// ============================================================================

import type { JwtPayload } from "../modules/auth/auth.validator.js";
import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      // Unique request ID - request-id middleware se set hota hai
      id: string;
      // Authenticated user payload - requireAuth middleware se set
      user?: JwtPayload;
      // Per-request scoped logger - request-id auto-attached
      log: Logger;
      // Response time tracking - response-time middleware se set
      startTime?: bigint;
    }
  }
}

// is file ko module banane ke liye - global augmentation kaam karega
export {};
