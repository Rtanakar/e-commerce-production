// ============================================================================
// slugify.ts - URL slug generation
// ============================================================================
// "Apple iPhone 15 Pro!!" → "apple-iphone-15-pro"
// Catalog (products, categories) ke liye SEO-friendly URL slugs banata hai.
// ============================================================================

// ============================================================================
// slugify - string ko URL-safe slug me convert
// ============================================================================
// - lowercase
// - accents/diacritics strip (é → e) via Unicode normalize
// - non-alphanumeric → hyphen
// - leading/trailing/duplicate hyphens clean
// - max length cap (DB index friendly)
// ============================================================================
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize("NFKD") // accented chars decompose (é → e + ́)
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks hatao
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → single hyphen
    .replace(/^-+|-+$/g, "") // ends ke hyphens trim
    .slice(0, maxLength)
    .replace(/-+$/g, ""); // slice ke baad trailing hyphen dobara clean
}

// ============================================================================
// uniqueSlugify - collision-safe slug
// ============================================================================
// Base slug try karta hai; agar `exists` true bole to "-2", "-3" ... suffix
// lagata jaata hai jab tak unique na mile. Course module ka same pattern.
//
// Usage:
//   const slug = await uniqueSlugify(title, (s) => repo.slugExists(s));
// ============================================================================
export async function uniqueSlugify(
  input: string,
  exists: (slug: string) => Promise<boolean>,
  maxLength = 80,
): Promise<string> {
  const base = slugify(input, maxLength) || "item"; // empty fallback (sirf symbols title)

  if (!(await exists(base))) return base;

  // Suffix loop — base-2, base-3 ... pehla available le lo
  for (let i = 2; i < 1000; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }

  // Extreme fallback — random suffix (practically kabhi nahi pahunchega)
  return `${base.slice(0, maxLength - 7)}-${Math.random().toString(36).slice(2, 8)}`;
}
