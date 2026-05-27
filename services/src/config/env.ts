// ============================================================================
// env.ts - Environment variable validation
// ============================================================================
// Fail-fast pattern - app start hone se PEHLE env validate
// Missing/galat var → exit, runtime crash nahi
// Netflix/Stripe production me must - silent misconfig disaster banta hai
// ============================================================================

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

// ============================================================================
// Schema
// ============================================================================
const EnvSchema = z.object({
  // ===== APP =====
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("8080")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // API versioning
  API_PREFIX: z.string().default("api"),
  API_VERSION: z.string().default("v1"),

  // App URLs - email links, OAuth callbacks etc.
  APP_URL: z.string().url().default("http://localhost:3000"),

  // ===== DATABASE =====
  DATABASE_URL: z.string().url(),

  // ===== REDIS =====
  // ioredis TCP URL format: rediss://default:<token>@<host>.upstash.io:6379
  // (Upstash dashboard → "Connect" tab → ioredis)
  // Local dev (docker): redis://localhost:6379
  REDIS_URL: z.string().url(),

  // ===== JWT =====
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

  // ===== COOKIES =====
  // Cookie domain - set for subdomain sharing (.shop.com → admin.shop.com, www.shop.com)
  // Leave empty for localhost / single-domain apps
  COOKIE_DOMAIN: z.string().optional(),

  // ===== RATE LIMIT =====
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default("100")
    .transform((v) => parseInt(v, 10)),

  // ===== EMAIL (SMTP - works with Gmail/SES/Resend/Mailtrap/Postmark) =====
  // Industry pattern: nodemailer as abstraction layer, provider via env
  // Dev:  Gmail App Password (this project) / Mailtrap sandbox
  // Prod: AWS SES SMTP / Resend SMTP (Gmail rate-limited)
  //
  // SMTP_SERVICE: nodemailer shortcut - "gmail" auto-sets host/port/secure
  // If set, takes precedence over SMTP_HOST/PORT/SECURE
  SMTP_SERVICE: z.string().optional(),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z
    .string()
    .default("465")
    .transform((v) => parseInt(v, 10)),
  SMTP_SECURE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("E-Commerce <no-reply@shop.local>"),
  EMAIL_FROM_NAME: z.string().default("E-Commerce"),

  // ===== OBSERVABILITY =====
  SENTRY_DSN: z.string().optional(),

  // ===== SWAGGER =====
  ENABLE_DOCS: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
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

export const env = Object.freeze(parseEnv());
export type Env = typeof env;

export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
