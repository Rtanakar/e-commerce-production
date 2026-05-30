// ============================================================================
// (seller)/layout.tsx — Seller portal root (thin pass-through)
// ============================================================================
// The seller portal has TWO distinct chromes, so the per-area layouts own the
// UI and this root stays empty:
//   • (seller)/become-seller/layout.tsx → minimal onboarding header
//   • (seller)/seller/layout.tsx        → full dashboard shell (sidebar)
//
// Keeping this a pass-through avoids wrapping the dashboard in the onboarding
// header (and vice-versa).
// ============================================================================

export default function SellerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
