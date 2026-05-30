// ============================================================================
// constants.ts - App-wide constants (magic numbers ek jagah)
// ============================================================================

// ============================================================================
// PAGINATION - cursor + offset hybrid defaults
// ============================================================================
// "Dynamically increase with products" = cursor pagination. Jaise jaise
// products badhte hain, client `nextCursor` bhejta jaata hai aur DB seedha
// us point ke baad rows nikaalta hai (no SKIP, no drift). Offset fallback
// purane clients ke liye.
// ============================================================================
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MIN_PAGE_SIZE: 1,
  MAX_PAGE_SIZE: 100, // DoS guard — koi `limit=100000` na bheje
} as const;

// ============================================================================
// CATALOG limits - product create/edit validation bounds
// ============================================================================
export const CATALOG = {
  MAX_IMAGES_PER_PRODUCT: 10, // UI "Images up to 4MB, max 10"
  MAX_VARIANTS_PER_PRODUCT: 50,
  MAX_TAGS: 25,
  MAX_COLORS: 25,
  MAX_TITLE_LENGTH: 200,
  MAX_SHORT_DESC_WORDS: 150,
} as const;
