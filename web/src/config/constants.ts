// ============================================================================
// constants.ts — Frontend-wide constants (mirrors backend config/constants.ts)
// ============================================================================

// Pagination — backend ke saath aligned (DEFAULT 20, MAX 100)
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MIN_PAGE_SIZE: 1,
  MAX_PAGE_SIZE: 100,
} as const;

// TanStack Query staleTime presets (ms) — kitni der data "fresh" maana jaaye
export const STALE_TIME = {
  LIST: 30 * 1000, // 30s — list refetch on focus/nav ke beech
  DETAIL: 60 * 1000, // 60s — single product detail
  STATIC: 5 * 60 * 1000, // 5m — categories (rarely change)
} as const;

// Catalog limits — backend CATALOG ke saath aligned
export const CATALOG = {
  MAX_IMAGES_PER_PRODUCT: 10,
  MAX_VARIANTS_PER_PRODUCT: 50,
  MAX_TAGS: 25,
  MAX_COLORS: 25,
  // Raw image upload cap (compress se pehle) — backend IMAGE_MAX_UPLOAD_BYTES
  MAX_IMAGE_UPLOAD_BYTES: 15 * 1024 * 1024, // 15MB
  MAX_VIDEO_UPLOAD_BYTES: 200 * 1024 * 1024, // 200MB
} as const;

// Default size options (Sizes chips)
export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

// Preset color swatches (Colors row — "+" se custom bhi)
export const COLOR_SWATCHES = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#8b5cf6",
] as const;
