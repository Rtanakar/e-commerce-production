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
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

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
  // Customer-scope secrets - shop traffic, customer cookies (at/rt)
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  // Seller-scope secrets - seller portal traffic, seller cookies
  // (seller-access-token / seller-refresh-token). Separate secrets = full
  // cryptographic isolation. Customer token signing key compromise CANNOT
  // forge a valid seller token, and vice versa. Amazon / Stripe Connect
  // pattern: each surface has its own signing key family.
  // Optional: if unset, falls back to customer secrets (single-key dev mode).
  JWT_SELLER_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_SELLER_ACCESS_SECRET must be at least 32 chars")
    .optional(),
  JWT_SELLER_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_SELLER_REFRESH_SECRET must be at least 32 chars")
    .optional(),
  // Format: <number><unit>  unit ∈ {s, m, h, d, w}
  // FAANG default: access 15m + refresh 7d (industry standard - was 30d, but
  // OWASP recommends shorter lived refresh tokens to limit replay window)
  // Access 5h - longer than typical (15m) per user preference. Trade-off:
  // less refresh churn, larger window if token leaks. Mitigated by JTI
  // revocation (logout/password-change instantly kills access token).
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhdw]$/, "format like 5h / 15m / 7d")
    .default("5h"),
  JWT_REFRESH_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhdw]$/, "format like 7d / 1w")
    .default("7d"),

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
  // sameSite override - "lax" | "strict" | "none"
  //   lax    → same-site cross-origin OK (different ports/subdomains) - default
  //   strict → never sent on cross-site (best CSRF protection, breaks SSO/OAuth)
  //   none   → cross-site allowed (REQUIRED if frontend + api on different domains)
  // Leave empty: auto pick (dev = lax, prod = lax if COOKIE_DOMAIN set, else none)
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).optional(),
  // Chrome CHIPS (Cookies Having Independent Partitioned State) - 3rd-party
  // cookie partitioning. Set true if your cookie is loaded from another site
  // in an iframe / 3rd-party context. Modern browsers will require this 2024+
  COOKIE_PARTITIONED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // ===== CSRF =====
  // Double-submit cookie pattern - no server-side secret needed.
  // We still keep a key here for HMAC-binding the CSRF token to the session
  // (rotation possible without invalidating live sessions)
  CSRF_SECRET: z
    .string()
    .min(32, "CSRF_SECRET must be at least 32 chars")
    .default("dev_csrf_change_to_32_char_random_string____________"),
  // Seller CSRF secret - separate HMAC key for seller scope.
  // Optional: falls back to CSRF_SECRET if unset.
  SELLER_CSRF_SECRET: z.string().min(32, "SELLER_CSRF_SECRET must be at least 32 chars").optional(),

  // ===== AUTH POLICY =====
  // Strict device binding - on refresh, fingerprint mismatch revokes session.
  // Mobile users frequently change networks/UA - default OFF (warn-only mode).
  // Enable for high-value tenants (admin panel / payments).
  AUTH_STRICT_DEVICE_BINDING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

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

  // ===== SMS (phone OTP) =====
  // Provider switch: "console" (dev - logs OTP to terminal, no real SMS) or
  // "twilio" (prod - real SMS via Twilio REST API, no SDK dependency).
  // Default "console" so dev works out-of-the-box with zero config.
  SMS_PROVIDER: z.enum(["console", "twilio"]).default("console"),
  // Twilio creds - required only when SMS_PROVIDER=twilio (validated at send time)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  // Sender: either a Twilio phone number (+1...) OR a Messaging Service SID (MG...)
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // ===== GOOGLE OAUTH =====
  // Get credentials: https://console.cloud.google.com/apis/credentials
  // Create OAuth 2.0 Client ID (Web application)
  // Authorized redirect URI: http://localhost:8080/api/v1/auth/google/callback
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Where to redirect after successful OAuth (frontend route)
  GOOGLE_OAUTH_REDIRECT_BASE: z.string().url().default("http://localhost:3000"),

  // ===== OBJECT STORAGE (images / videos / files) =====
  // Provider switch — primary R2 (Cloudflare), baad me AWS S3 par switch.
  // Dono S3-compatible API use karte hain (same SDK), bas endpoint/creds alag.
  //   "r2"  → Cloudflare R2 (S3-compatible, R2_* vars chahiye)
  //   "s3"  → AWS S3 (AWS_* vars chahiye)
  // Default "r2" kyunki user pehle R2 use kar raha hai.
  STORAGE_PROVIDER: z.enum(["r2", "s3"]).default("r2"),

  // Single bucket dono media (image/video/file) ke liye — key prefix se alag.
  STORAGE_BUCKET: z.string().optional(),
  // Public base URL — yahin se browser objects fetch karega.
  //   R2  → custom domain ya https://pub-<hash>.r2.dev
  //   S3  → https://<bucket>.s3.<region>.amazonaws.com ya CloudFront domain
  STORAGE_PUBLIC_URL: z.string().url().optional(),

  // ── Cloudflare R2 ──
  // R2 endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  // R2 region hamesha "auto"
  R2_REGION: z.string().default("auto"),

  // ── AWS S3 (future) ──
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  // Optional custom endpoint (S3-compatible MinIO/LocalStack ke liye)
  AWS_S3_ENDPOINT: z.string().url().optional(),

  // Presigned upload URL kitni der valid (seconds)
  STORAGE_PRESIGN_EXPIRY: z
    .string()
    .default("300")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // ===== IMAGE PROCESSING (sharp - Amazon/Flipkart style) =====
  // Image backend se guzar ke webp/avif me convert + compress hoti hai.
  //   webp → universal support, fast encode (DEFAULT — Amazon bhi webp serve karta)
  //   avif → ~20-30% chhoti par slower encode (storage critical ho to)
  IMAGE_FORMAT: z.enum(["webp", "avif"]).default("webp"),
  // Quality 1-100. 80 = high quality + accha compression (sweet spot).
  IMAGE_QUALITY: z
    .string()
    .default("80")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100)),
  // Bade side ka max pixel cap — isse zyada ko proportionally shrink (zoom ke
  // liye 2000px kaafi; original mat rakho, storage bachao).
  IMAGE_MAX_DIMENSION: z
    .string()
    .default("2000")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  // Listing thumbnail width (responsive — cards me chhoti image, storage minimal)
  IMAGE_THUMB_WIDTH: z
    .string()
    .default("400")
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  // Raw upload ka max size (compress se PEHLE) — multer limit, DoS guard
  IMAGE_MAX_UPLOAD_BYTES: z
    .string()
    .default(String(15 * 1024 * 1024)) // 15 MB
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

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
