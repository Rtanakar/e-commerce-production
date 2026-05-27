// ============================================================================
// theme.ts - Email brand tokens (REFERENCE for designers/devs)
// ============================================================================
// NOTE: These values are HARDCODED in _layout.ejs <style> block.
// Why hardcoded? CSS language server validates <style> content - dynamic EJS
// expressions inside CSS values trigger "property value expected" errors.
//
// Workflow when brand colors change:
//   1. Update values here (single source of truth in code)
//   2. Update matching hex values in _layout.ejs <style> block
//   3. Future improvement: pre-build script that auto-syncs (not needed yet)
// ============================================================================

export const emailTheme = {
  brand: "#FF5A1F",
  brandDark: "#E04A12",
  ink: "#0E0A07",
  inkSoft: "#3A2E22",
  muted: "#6B5B4A",
  cream: "#FFF7EC",
  cream2: "#F7EBD6",
  border: "#E6D6BD",
  white: "#FFFFFF",
  success: "#1F7A3A",
  danger: "#B3321B",
} as const;

export const emailFont =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export type EmailTheme = typeof emailTheme;
