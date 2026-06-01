// ============================================================================
// product-purge.worker.ts - Soft-deleted products ka auto-purge cron
// ============================================================================
// Flow:
//   1. Seller "Delete" dabata hai → product DELETED state me (deletedAt + purgeAt = now+24h)
//   2. 24h ke andar restore ho sakta hai
//   3. Yeh worker har 15 min chalta hai → jinka purgeAt nikal gaya unhe DB + R2/S3
//      se PERMANENT delete kar deta (purgeExpiredProducts)
//
// Implementation: plain setInterval (extra dependency nahi). 24h-purge ke liye
// exact cron-second precision ki zaroorat nahi — 15 min ka interval kaafi hai.
//
// Industry note: production multi-instance scale pe yeh kaam dedicated worker/
// queue (BullMQ, QStash) me jata hai, aur duplicate runs se bachne ke liye Redis
// lock lagta hai. Single-instance ke liye in-process interval simple + kaafi hai.
// ============================================================================

import { purgeExpiredProducts } from "../modules/product/product.service.js";
import { logger } from "../utils/logger.js";

// Har 15 minute purge check (ms me)
const PURGE_INTERVAL_MS = 15 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let isRunning = false; // overlap guard — pichla run lamba chale to dobara start na ho

// ek purge run — error swallow karke log (worker kabhi crash na ho)
async function runPurge(): Promise<void> {
  if (isRunning) {
    logger.warn("[purge-worker] previous run still in progress — skipping");
    return;
  }
  isRunning = true;
  try {
    await purgeExpiredProducts();
  } catch (err) {
    logger.error({ err }, "[purge-worker] purge run failed");
  } finally {
    isRunning = false;
  }
}

// ============================================================================
// startProductPurgeWorker - server boot pe interval register
// ============================================================================
export function startProductPurgeWorker(): void {
  if (timer) return; // double-start guard
  timer = setInterval(() => void runPurge(), PURGE_INTERVAL_MS);
  // unref — yeh timer akela process ko zinda na rakhe (clean shutdown)
  timer.unref?.();
  logger.info({ intervalMs: PURGE_INTERVAL_MS }, "[purge-worker] started");

  // Boot pe ek baar turant chala do — downtime ke dauraan jo due ho gaye unke liye
  void runPurge();
}

// ============================================================================
// stopProductPurgeWorker - graceful shutdown pe interval band
// ============================================================================
export function stopProductPurgeWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  logger.info("[purge-worker] stopped");
}
