// ============================================================================
// wishlist-button.tsx — Heart toggle (motion pop + fill)
// ============================================================================
// Filled rose heart = wishlisted. Click pe spring "pop" + fill transition.
// Auth-agnostic (useWishlist). Card pe overlay ya detail pe inline use hota.
// ============================================================================

"use client";

import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../hooks/use-wishlist";

interface WishlistButtonProps {
  productId: string;
  variantId?: string | null;
  name: string;
  slug: string;
  price: number;
  image?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { btn: "size-8", icon: "size-4" },
  md: { btn: "size-10", icon: "size-5" },
  lg: { btn: "size-11", icon: "size-6" },
};

export function WishlistButton({
  productId,
  variantId = null,
  name,
  slug,
  price,
  image,
  className,
  size = "md",
}: WishlistButtonProps) {
  const { toggle, has } = useWishlist();
  const active = has(productId, variantId);
  const s = SIZES[size];

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ productId, variantId, name, slug, price, image });
      }}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center rounded-full border bg-background/90 backdrop-blur transition-colors",
        active
          ? "border-rose-200 text-rose-500 dark:border-rose-900"
          : "border-input text-muted-foreground hover:text-rose-500",
        s.btn,
        className,
      )}
    >
      <motion.span
        key={active ? "on" : "off"}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15 }}
      >
        <Heart className={cn(s.icon, active && "fill-rose-500")} />
      </motion.span>
    </motion.button>
  );
}
