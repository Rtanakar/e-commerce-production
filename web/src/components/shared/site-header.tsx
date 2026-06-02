// ============================================================================
// site-header.tsx — Top-of-page header (Amazon/Flipkart pattern)
// ============================================================================
// Two-row layout:
//
//   ┌─ ROW 1 (main bar) ──────────────────────────────────────────┐
//   │  [Logo]   [   search bar    🔍]   [Hello,Sign In] [♥] [🛒]  │
//   └─────────────────────────────────────────────────────────────┘
//   ┌─ ROW 2 (category bar) ──────────────────────────────────────┐
//   │  [All Departments ▾]  Home  Products  Shops  Offers  CTA    │
//   └─────────────────────────────────────────────────────────────┘
//
// Sticky on scroll - persistent navigation (industry default for e-commerce).
//
// Components composed here:
//   - SearchBar     - inline (form, no nav yet)
//   - UserMenu      - auth-aware avatar/sign-in chip
//   - WishlistButton - icon + static badge (count wiring later)
//   - CartButton    - icon + static badge (count wiring later)
//   - CategoryBar   - sub-row nav
// ============================================================================

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Heart, Search, ShoppingCart, X } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryBar } from "./category-bar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCart } from "@/features/shop/hooks/use-cart";
import { useWishlist } from "@/features/shop/hooks/use-wishlist";

const EASE = [0.16, 1, 0.3, 1] as const;

// ============================================================================
// SiteHeader - main export (use in app/layout.tsx or per-page)
// ============================================================================
export function SiteHeader() {
  return (
    // sticky top-0 → header pinned on scroll. z-40 above content, below modals.
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      {/* ===== ROW 1 - logo / search / user / wishlist / cart ===== */}
      {/* max-w-[1440px] - Amazon/Flipkart use ~1500px container for wider feel */}
      <div className="mx-auto flex h-16 max-w-360 items-center gap-6 px-6 lg:px-8">
        {/* ----- Logo (left) ----- */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1 text-2xl font-bold tracking-tight"
        >
          <span className="text-foreground">Eshop</span>
        </Link>

        {/* ----- Search bar (flex-1, center column - mx-auto pushes equal space) ----- */}
        <div className="flex flex-1 justify-center">
          <SearchBar />
        </div>

        {/* ----- Right cluster - theme, user, wishlist, cart ----- */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <UserMenu />
          <WishlistButton />
          <CartButton />
        </div>
      </div>

      {/* ===== ROW 2 - category bar (sub-nav) ===== */}
      <CategoryBar />
    </motion.header>
  );
}

// ============================================================================
// SearchBar - production-grade flex layout (Amazon/Flipkart pattern)
// ============================================================================
// Bulletproof composition - NO absolute positioning. Every slot is a flex
// child inside a single bordered container:
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   │ 🔍  [input fills...]  [×] [/]  │  ┌──────────┐                 │
//   │                                  │  │  Search  │                 │
//   └──────────────────────────────────┴──┴──────────┘
//
// Why flex over absolute:
//   - Children can't overlap by accident
//   - Padding bugs impossible (no pl-10 vs left-3.5 math)
//   - Resizes cleanly without layout shift
//
// Theme tokens only: bg-background / bg-input / border-input / etc.
// Adapts to dark mode without any code change.
// ============================================================================
function SearchBar() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ----- "/" keyboard shortcut to focus (Vercel/GitHub pattern) -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    window.location.href = `/search?q=${encodeURIComponent(q)}`;
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex w-full max-w-3xl items-stretch"
    >
      {/* ===== Outer bordered container - holds icon, input, trailing slot ===== */}
      <div
        className={cn(
          "group flex h-11 flex-1 items-center gap-2 overflow-hidden rounded-l-md border border-r-0 bg-background pl-3 pr-2 transition-all dark:bg-input/30",
          // Focus ring via border + shadow (no scale - prevents layout jitter)
          focused
            ? "border-ring/40 shadow-[0_0_0_3px_var(--ring)]/15"
            : "border-input hover:border-ring/30",
        )}
      >
        {/* ----- Leading icon (flex child - no absolute) ----- */}
        <Search
          className={cn(
            "size-4 shrink-0 transition-colors",
            focused ? "text-foreground" : "text-muted-foreground/70",
          )}
          aria-hidden
        />

        {/* ----- Input (flex-1 fills remaining width) ----- */}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search for products, brands, categories..."
          aria-label="Search"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-sm outline-none",
            "placeholder:text-muted-foreground/60",
            // Hide native webkit clear button (we have our own ×)
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />

        {/* ----- Trailing slot - kbd hint OR clear button ----- */}
        <div className="flex shrink-0 items-center">
          <AnimatePresence mode="wait" initial={false}>
            {query ? (
              <motion.button
                key="clear"
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" />
              </motion.button>
            ) : (
              // "/" shortcut hint - hidden on mobile, hides when focused
              <motion.kbd
                key="kbd"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: focused ? 0 : 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="hidden h-6 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex"
                aria-hidden
              >
                /
              </motion.kbd>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== Submit button - square right cap ===== */}
      <motion.button
        type="submit"
        aria-label="Search"
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className={cn(
          "flex h-11 shrink-0 items-center justify-center rounded-r-md bg-primary px-5 text-primary-foreground",
          "transition-colors hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        <Search className="size-4" />
      </motion.button>
    </form>
  );
}

// ============================================================================
// WishlistButton - icon + count badge
// ============================================================================
// Live count from useWishlist (guest Zustand ya server, auth-aware).
// ============================================================================
function WishlistButton() {
  const { count } = useWishlist();
  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist (${count} items)`}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full",
        "transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Heart className="size-5" />
      <CountBadge count={count} />
    </Link>
  );
}

// ============================================================================
// CartButton - icon + count badge
// ============================================================================
function CartButton() {
  const { totalItems: count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Cart (${count} items)`}
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-full",
        "transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <ShoppingCart className="size-5" />
      <CountBadge count={count} />
    </Link>
  );
}

// ============================================================================
// CountBadge - red pill at top-right of icon, hidden when 0
// ============================================================================
// 99+ cap for very large counts (sane visual width)
// ============================================================================
function CountBadge({ count }: { count: number }) {
  // Always render so badge slot occupies layout; visibility toggled by count.
  // Prevents micro-jump when first item added to cart.
  const display = count > 99 ? "99+" : String(count);
  return (
    <Badge
      variant="destructive"
      className={cn(
        "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
        count === 0 && "invisible",
      )}
    >
      {display}
    </Badge>
  );
}
