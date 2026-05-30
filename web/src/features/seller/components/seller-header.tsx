// ============================================================================
// seller-header.tsx — Minimal seller portal header (isolated from shop chrome)
// ============================================================================
// Production parallel: Amazon Seller Central / Flipkart Seller Hub / Shopify
// Partners — completely separate, focused header. NO search, cart, wishlist.
// ============================================================================

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Store, ArrowLeft, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { shopUrl } from "@/lib/portal-urls";

export function SellerHeader() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      <div className="mx-auto flex h-14 max-w-360 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ----- Brand mark — Eshop Seller ----- */}
        <Link
          href="/become-seller"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Store className="size-4" />
          </div>
          <span>
            Eshop <span className="text-muted-foreground">Seller</span>
          </span>
        </Link>

        {/* ----- Right cluster — help + theme + back-to-shop ----- */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/seller/help"
            className="hidden h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            <HelpCircle className="size-4" />
            Help
          </Link>
          <ThemeToggle />
          {/* Cross-host link → plain <a> for a hard navigation to the shop
              origin (switches cookie jar cleanly). next/link would try a
              client transition within the seller host. */}
          <a
            href={shopUrl("/")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Back to shop</span>
          </a>
        </div>
      </div>
    </motion.header>
  );
}
