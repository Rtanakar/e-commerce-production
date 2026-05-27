// ============================================================================
// redis.ts - ioredis singleton (Production-grade TCP client)
// ============================================================================
// Why ioredis over @upstash/redis (REST)?
//   - Persistent TCP connection (sub-ms latency vs ~50ms HTTP roundtrip)
//   - Pipelining + transactions (MULTI/EXEC)
//   - Pub/Sub support (for WebSocket fan-out later)
//   - Streams support (Kafka-lite use cases)
//   - 5-10x faster per operation for long-running servers
//
// Industry: Amazon (ElastiCache), Flipkart, Stripe, Discord - all use TCP Redis
// Upstash provides BOTH endpoints - we use the rediss:// (TCP) one
//
// Upstash dashboard → "Connect" tab → ioredis → copy connection string
// Local dev: docker-compose redis container at redis://localhost:6379
// ============================================================================

// Named import - default import ioredis ke saath NodeNext/ESM me
// "not constructable" error deta hai. Named { Redis } reliably works.
import { Redis } from "ioredis";
type RedisInstance = Redis;
import { env, isProd } from "../config/env.js";
import { logger } from "../utils/logger.js";

// ============================================================================
// Singleton factory
// ============================================================================
function createRedisClient(): RedisInstance {
  const client = new Redis(env.REDIS_URL, {
    // Lazy connect - connection only when first command issued
    // (avoids startup connect-storm with multiple instances)
    lazyConnect: false,

    // Reconnect strategy - exponential backoff with cap
    // Cloud Redis transient disconnects normal hai - resilience zaruri
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },

    // READONLY/MOVED errors auto-handle (cluster scenarios)
    reconnectOnError(err: Error) {
      const target = "READONLY";
      return err.message.includes(target);
    },

    // Connection pool - ioredis single conn by default, sufficient for most apps
    // High-throughput (>10k RPS) → use BullMQ-style multi-conn or cluster
    maxRetriesPerRequest: 3,

    // Production: TLS verify strict, Dev: allow self-signed
    tls: env.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: isProd } : undefined,

    // Command timeout - hang prevent
    commandTimeout: 5000,

    // Connection name - Redis CLIENT LIST me visible (debugging)
    connectionName: `ecommerce-api-${process.pid}`,
  });

  // Event hooks - observability
  // Explicit types required (noImplicitAny strict mode)
  client.on("connect", () => logger.info("Redis: connecting"));
  client.on("ready", () => logger.info("Redis: ready"));
  client.on("error", (err: Error) => logger.error({ err }, "Redis: error"));
  client.on("close", () => logger.warn("Redis: connection closed"));
  client.on("reconnecting", (delay: number) => logger.warn({ delay }, "Redis: reconnecting"));
  client.on("end", () => logger.warn("Redis: connection ended"));

  return client;
}

// Module-level singleton - process me ek hi instance
export const redis: RedisInstance = createRedisClient();

// ============================================================================
// Key namespacing - global Redis collision avoid
// ============================================================================
// Multi-tenant ya multi-env me ek hi Redis share ho to prefix se separation
// jaise: `prod:ecom:session:...` vs `dev:ecom:session:...`
const PREFIX = isProd ? "prod" : env.NODE_ENV;

export const RedisKeys = {
  // Auth
  session: (userId: string, sid: string) => `${PREFIX}:session:${userId}:${sid}`,
  userSessions: (userId: string) => `${PREFIX}:user:sessions:${userId}`,
  passwordResetToken: (token: string) => `${PREFIX}:pwd-reset:${token}`,
  emailVerifyToken: (token: string) => `${PREFIX}:email-verify:${token}`,

  // OTP - request side (send/resend)
  otp: (key: string) => `${PREFIX}:otp:${key}`,
  otpCooldown: (key: string) => `${PREFIX}:otp:cooldown:${key}`,
  otpRequests: (key: string) => `${PREFIX}:otp:requests:${key}`,
  otpSpamLock: (key: string) => `${PREFIX}:otp:spam-lock:${key}`,
  // OTP - verify side (wrong-attempt tracking)
  otpAttempts: (key: string) => `${PREFIX}:otp:attempts:${key}`,
  otpVerifyLock: (key: string) => `${PREFIX}:otp:verify-lock:${key}`,

  // Cache
  cache: (key: string) => `${PREFIX}:cache:${key}`,
} as const;

// ============================================================================
// Graceful shutdown
// ============================================================================
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info("Redis: disconnected gracefully");
}

// ============================================================================
// Health check - ping with timeout
// ============================================================================
export async function pingRedis(timeoutMs = 2000): Promise<boolean> {
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), timeoutMs),
      ),
    ]);
    return result === "PONG";
  } catch (err) {
    logger.error({ err }, "Redis health check failed");
    return false;
  }
}
