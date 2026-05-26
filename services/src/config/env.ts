// ============================================================================
// env.ts - Environment variable validation
// ============================================================================
// Fail-fast pattern - app start hone se PEHLE env validate
// agar koi var missing/galat hai to exit, runtime crash nahi
// Netflix/Stripe production me ye must - silent misconfig disaster banta hai
// ============================================================================

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// .env file load karo (dev only - prod me real env vars hote hai)
loadDotenv();

// ============================================================================
// Schema definition
// ============================================================================
const EnvSchema = z.object({
  // ===== APP =====
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("8080")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // API versioning
  API_PREFIX: z.string().default("api"),
  API_VERSION: z.string().default("v1"),

  // ===== DATABASE =====
  DATABASE_URL: z.string().url(),

  // ===== REDIS (Upstash REST) =====
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // ===== JWT =====
  // Minimum 32 chars - HS256 security best practice
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // ===== BCRYPT =====
  BCRYPT_SALT_ROUNDS: z
    .string()
    .default("12")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(10).max(15)),

  // ===== CORS =====
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // ===== RATE LIMIT =====
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .transform((v) => parseInt(v, 10)),

  // ===== OPTIONAL =====
  SENTRY_DSN: z.string().optional(),
});

// ============================================================================
// Parse with helpful errors
// ============================================================================
function parseEnv(): z.infer<typeof EnvSchema> {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ Invalid environment variables:\n");
    for (const issue of result.error.issues) {
      console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
    }
    console.error("\n👉 Check your .env file (see .env.example for reference)\n");
    process.exit(1);
  }

  return result.data;
}

// ============================================================================
// Frozen export - tampering prevent
// ============================================================================
export const env = Object.freeze(parseEnv());
export type Env = typeof env;

// Helper booleans - har file me string compare avoid
export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

// CORS origins as array - cors middleware me direct use
export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
