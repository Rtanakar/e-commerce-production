// ============================================================================
// add-to-cart-button.tsx — Add to cart + quantity stepper (motion)
// ============================================================================
// 3 states:
//   - out of stock → disabled "Out of Stock"
//   - not in cart  → "Add to Cart" button
//   - in cart      → − [qty] + stepper (motion height/opacity transition)
// Auth-agnostic (useCart abstracts guest vs server). Stock pe clamp.
// ============================================================================

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCart } from "../hooks/use-cart";

interface AddToCartButtonProps {
  productId: string;
  variantId?: string | null;
  name: string;
  slug: string;
  price: number; // minor units (effective)
  image?: string;
  color?: string | null;
  stock: number;
  className?: string;
  size?: "default" | "lg";
}

export function AddToCartButton({
  productId,
  variantId = null,
  name,
  slug,
  price,
  image,
  color = null,
  stock,
  className,
  size = "default",
}: AddToCartButtonProps) {
  const { add, setQty, getQty, isMutating } = useCart();

  const qty = getQty(productId, variantId);
  const isOutOfStock = stock <= 0;
  const isAtMax = qty >= stock;

  const heightClass = size === "lg" ? "h-12" : "h-11";

  if (isOutOfStock) {
    return (
      <Button disabled variant="secondary" className={cn(heightClass, "w-full", className)}>
        Out of Stock
      </Button>
    );
  }

  if (qty === 0) {
    return (
      <Button
        onClick={() =>
          add({
            productId,
            variantId,
            quantity: 1,
            snapshot: { name, slug, price, image, color },
          })
        }
        className={cn(heightClass, "w-full gap-2", className)}
      >
        <ShoppingBag className="size-4" />
        Add to Cart
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        heightClass,
        "flex w-full items-center rounded-md border border-input bg-background",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-full flex-1 rounded-r-none"
        onClick={() => setQty(productId, variantId, qty - 1)}
        disabled={isMutating}
        aria-label="Decrease quantity"
      >
        <Minus className="size-4" />
      </Button>

      <div className="flex flex-1 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={qty}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="text-sm font-semibold tabular-nums"
          >
            {qty}
          </motion.span>
        </AnimatePresence>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-full flex-1 rounded-l-none disabled:opacity-30"
        onClick={() => setQty(productId, variantId, qty + 1)}
        disabled={isAtMax || isMutating}
        aria-label="Increase quantity"
      >
        {isMutating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      </Button>
    </motion.div>
  );
}
