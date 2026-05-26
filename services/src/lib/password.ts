// ============================================================================
// password.ts - Password hashing utilities (function-based)
// ============================================================================
// bcryptjs (pure JS) - cross-platform builds easier, no native compile issues
// Performance fark trivial modern CPUs pe
//
// Industry pattern (Express): named function exports - no class wrapper
// One responsibility, no state, no DI needed → functions ideal
// ============================================================================

import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

// ============================================================================
// hashPassword - signup / password-change pe
// ============================================================================
// Salt automatically generate hota hai aur hash me embed
// Alag se salt store karne ki zarurat nahi
// ============================================================================
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

// ============================================================================
// verifyPassword - login pe
// ============================================================================
// Timing-safe comparison - bcrypt internally handle karta hai
// string === se NEVER compare karo (timing attack risk)
// ============================================================================
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ============================================================================
// needsRehash - rounds upgrade detection
// ============================================================================
// Saalon baad bcrypt rounds badhane pe (e.g. 12 → 14), purane hash detect
// Login pe verify ke baad call karo, agar true to silently rehash
// ============================================================================
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < env.BCRYPT_SALT_ROUNDS;
  } catch {
    return true; // invalid hash format - rehash zaruri
  }
}
