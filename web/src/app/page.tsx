// ============================================================================
// app/page.tsx — Home page
// ============================================================================
// Includes the global SiteHeader (logo + search + user + wishlist + cart +
// category bar). Real homepage content (hero/carousel/featured products) will
// be added in a separate task - currently a placeholder.
// ============================================================================

export default function Home() {
  return (
    <>
      {/* max-w-[1440px] - same as header for visual continuity */}
      <main className="mx-auto flex max-w-360 flex-col items-center px-6 py-16 text-center lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to Eshop
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Homepage content coming soon — hero, carousel, featured products will
          be wired here.
        </p>
      </main>
    </>
  );
}
