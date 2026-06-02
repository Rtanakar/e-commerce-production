// ============================================================================
// currency.ts — minor units (paise/cents) → display string
// ============================================================================
// Backend prices minor units (Int) me store karta hai (Stripe pattern). UI pe
// dikhane se pehle 100 se divide + locale format. Default INR (₹).
// ============================================================================

const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
};

// minor units → "₹8,599" (no paise by default; e-commerce typical)
export function formatMoney(minor: number, currency = "INR"): string {
  const major = (minor || 0) / 100;
  const locale = LOCALES[currency] ?? "en-IN";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: major % 1 === 0 ? 0 : 2,
    }).format(major);
  } catch {
    // unknown currency code → symbol + plain number fallback
    const sym = SYMBOLS[currency] ?? "";
    return `${sym}${major.toLocaleString(locale)}`;
  }
}

// discount % (sale vs MRP) — agar backend ne na bheja ho to compute
export function computeDiscountPercent(salePrice: number, regularPrice: number): number {
  if (regularPrice <= 0 || salePrice >= regularPrice) return 0;
  return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
}
