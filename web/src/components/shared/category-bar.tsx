// ============================================================================
// category-bar.tsx — Sub-header nav (Amazon/Flipkart "All Departments" row)
// ============================================================================
// Structure:
//   [ ☰ All Departments ▾ ]  Home  Products  Shops  Offers  Become A Seller
//
// Currently static UI only - the "All Departments" dropdown is a visual stub.
// Wire-up of actual category navigation will come in a later task.
//
// Industry pattern - this row sits BELOW the main header (logo+search+icons):
//   - Amazon: same horizontal departments bar
//   - Flipkart: same with mega-menu hover
//   - Nike/Adidas: same minimal nav
// ============================================================================

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronDown, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

// ============================================================================
// Nav links - top-level navigation (static)
// ============================================================================
// Order chosen to match Amazon/Flipkart cognitive load (most-used first):
//   Home > Products > Shops > Offers > Become A Seller (CTA)
// ============================================================================
type NavLink = { href: string; label: string; highlight?: boolean };

const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/shops", label: "Shops" },
  { href: "/offers", label: "Offers" },
  // Become A Seller - vendor CTA, highlighted styling
  { href: "/become-seller", label: "Become A Seller", highlight: true },
];

// ============================================================================
// Categories - static list (mega-menu data later from API)
// ============================================================================
const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Books",
  "Sports & Outdoors",
  "Toys & Games",
  "Grocery",
  "Health & Wellness",
  "Automotive",
] as const;

// ============================================================================
// CategoryBar - main export
// ============================================================================
export function CategoryBar() {
  return (
    <div className="border-b bg-background">
      {/* Same container width as SiteHeader row-1 for perfect vertical alignment */}
      <div className="mx-auto flex h-12 max-w-360 items-center gap-1 px-6 lg:px-8">
        {/* ----- All Departments dropdown (left, blue accent) ----- */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "group inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Menu className="size-4" />
              <span>All Departments</span>
              <ChevronDown
                className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-64 overflow-hidden p-0"
          >
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="py-1"
            >
              {CATEGORIES.map((cat) => (
                <DropdownMenuItem key={cat} asChild>
                  <Link
                    // category slug - lowercase + hyphen (SEO friendly URLs)
                    href={`/category/${cat.toLowerCase().replace(/[\s&]+/g, "-").replace(/-+/g, "-")}`}
                    className="cursor-pointer"
                  >
                    {cat}
                  </Link>
                </DropdownMenuItem>
              ))}
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ----- Horizontal nav (right of departments) ----- */}
        <nav className="ml-2 flex items-center gap-1 overflow-x-auto">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-foreground",
                link.highlight
                  ? "text-primary hover:bg-primary/10"
                  : "text-foreground/80",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
