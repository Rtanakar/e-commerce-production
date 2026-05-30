// ============================================================================
// countries.ts — ISO-3166 alpha-2 country list with dial codes
// ============================================================================
// Curated top e-commerce markets. Full 249-entry list deferred — use
// `i18n-iso-countries` package when expanding.
// ============================================================================

export interface Country {
  code: string; // ISO alpha-2 (uppercase) — form state value
  name: string; // Display label
  dial: string; // E.164 dial code (no leading +)
  flag: string; // Emoji flag
}

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { code: "US", name: "United States", dial: "1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧" },
  { code: "CA", name: "Canada", dial: "1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { code: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪" },
  { code: "SG", name: "Singapore", dial: "65", flag: "🇸🇬" },
  { code: "BD", name: "Bangladesh", dial: "880", flag: "🇧🇩" },
  { code: "PK", name: "Pakistan", dial: "92", flag: "🇵🇰" },
  { code: "LK", name: "Sri Lanka", dial: "94", flag: "🇱🇰" },
  { code: "NP", name: "Nepal", dial: "977", flag: "🇳🇵" },
  { code: "MY", name: "Malaysia", dial: "60", flag: "🇲🇾" },
  { code: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
  { code: "PH", name: "Philippines", dial: "63", flag: "🇵🇭" },
  { code: "TH", name: "Thailand", dial: "66", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
  { code: "DE", name: "Germany", dial: "49", flag: "🇩🇪" },
  { code: "FR", name: "France", dial: "33", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", dial: "31", flag: "🇳🇱" },
  { code: "ES", name: "Spain", dial: "34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dial: "39", flag: "🇮🇹" },
];

export const DEFAULT_COUNTRY_CODE = "IN";

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
