// ============================================================================
// assert.ts - Runtime invariant helpers (defense-in-depth)
// ============================================================================
// PRIMARY validation: Zod at route boundary (auth.routes.ts validate(schema))
// SECONDARY validation: these helpers at service boundary
//
// Why both? Defense in depth:
//   - Zod catches HTTP-layer issues (request shape, types)
//   - Service guards catch business invariants (cross-field rules)
//   - Internal callers (workers, scripts) might bypass Zod - service still safe
//
// Industry: Stripe SDK does this. Public methods always re-validate critical
// inputs even though API gateway already validated.
// ============================================================================

import { BadRequestError } from "./errors.js";

// ============================================================================
// assertRequired - all listed fields must be truthy (non-empty)
// ============================================================================
// Usage:
//   assertRequired({ email, password, name }, ["email", "password", "name"]);
//
// Throws BadRequestError with which fields are missing (helpful in logs).
// ============================================================================
export function assertRequired<T extends Record<string, unknown>>(
  input: T,
  fields: (keyof T)[],
): void {
  const missing: string[] = [];
  for (const field of fields) {
    const value = input[field];
    // Empty string also counts as missing - common API contract
    if (value === undefined || value === null || value === "") {
      missing.push(String(field));
    }
  }
  if (missing.length > 0) {
    throw new BadRequestError(
      `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      { missing },
    );
  }
}

// ============================================================================
// assertTrue - generic invariant assertion
// ============================================================================
// Usage:
//   assertTrue(amount > 0, "Amount must be positive");
//   assertTrue(user.role === "VENDOR", "Vendor role required");
// ============================================================================
export function assertTrue(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new BadRequestError(message);
  }
}
