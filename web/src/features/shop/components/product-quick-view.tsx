// ============================================================================
// product-quick-view.tsx — Quick-view modal (Amazon/Flipkart style)
// ============================================================================
// Left: image gallery (main + thumbnails, variant-aware). Right: brand/rating,
// title, short desc, COLOR VARIANTS (click → image+price switch), price
// (sale + MRP strike + % off), qty stepper + add-to-cart + wishlist, stock,
// location-based delivery estimate.
//
// Close button: apna custom (showCloseButton={false}) — location chip se overlap
// na ho isliye location chip ko close button ke LEFT me space deke rakha.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, Star, Truck, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/utils/currency";
import { AddToCartButton } from "./add-to-cart-button";
import { WishlistButton } from "./wishlist-button";
import { StarRating } from "./star-rating";
import { useLocation, estimateDelivery } from "../hooks/use-location";
import type { ShopProduct, ShopVariant } from "../types";

interface ProductQuickViewProps {
  product: ShopProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductQuickView({ product, open, onOpenChange }: ProductQuickViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        {product ? (
          <QuickViewBody product={product} onClose={() => onOpenChange(false)} />
        ) : (
          <DialogTitle className="sr-only">Product</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickViewBody({ product, onClose }: { product: ShopProduct; onClose: () => void }) {
  const { location } = useLocation();
  const delivery = estimateDelivery(location);

  const variants = product.variants ?? [];
  const colorVariants = variants.filter((v) => v.color);
  const baseColor = product.colors?.[0] ?? null; // base product ka actual color
  const [selected, setSelected] = useState<ShopVariant | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  // gallery: selected variant images warna product images
  const gallery = useMemo(() => {
    const imgs = selected?.images?.length ? selected.images : product.images;
    return imgs ?? [];
  }, [selected, product.images]);

  const mainImage = gallery[activeImg]?.url ?? gallery[0]?.url;
  const price = selected?.price ?? product.salePrice;
  const stock = selected ? selected.stock : product.stock;
  const isOutOfStock = stock <= 0;

  const selectVariant = (v: ShopVariant | null) => {
    setSelected(v);
    setActiveImg(0); // variant change pe pehli image pe reset
  };

  return (
    <div className="grid max-h-[88vh] grid-cols-1 overflow-y-auto md:grid-cols-2">
      {/* ── Left: gallery ── */}
      <div className="flex flex-col gap-3 bg-muted/30 p-5">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-background">
          <AnimatePresence mode="wait">
            {mainImage ? (
              <motion.div
                key={mainImage}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <Image
                  src={mainImage}
                  alt={product.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 420px"
                  priority
                />
              </motion.div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
                <Star className="size-16" />
              </div>
            )}
          </AnimatePresence>
        </div>

        {gallery.length > 1 && (
          <div className="flex gap-2">
            {gallery.slice(0, 6).map((img, i) => (
              <button
                key={img.url}
                type="button"
                onMouseEnter={() => setActiveImg(i)}
                onClick={() => setActiveImg(i)}
                className={cn(
                  "relative size-14 overflow-hidden rounded-lg border-2 transition-all",
                  activeImg === i
                    ? "border-foreground"
                    : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill className="object-cover" sizes="56px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: details ── */}
      <div className="relative flex flex-col gap-4 p-6">
        {/* header row: location chip + custom close (overlap-safe) */}
        <div className="flex items-start justify-between gap-3">
          {product.brand ? (
            <p className="text-sm font-semibold text-primary">{product.brand}</p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {location?.city && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {location.city}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* rating */}
        <StarRating rating={product.ratingAvg} count={product.ratingCount} size="md" />

        <DialogTitle className="text-xl font-bold leading-snug">{product.title}</DialogTitle>

        {product.shortDescription && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{product.shortDescription}</p>
        )}

        {/* color variants */}
        {(baseColor || colorVariants.length > 0) && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Color{selected?.title ? `: ${selected.title}` : ""}
            </p>
            <div className="flex items-center gap-2">
              {/* default/base swatch = base product ka ACTUAL color (colors[0] hex),
                  image nahi. colors[] na ho to skip. Fill exact hex, no theme conflict. */}
              {baseColor && (
                <button
                  type="button"
                  onClick={() => selectVariant(null)}
                  title="Default"
                  aria-label="Default"
                  aria-pressed={selected === null}
                  className={cn(
                    "size-7 rounded-full ring-1 ring-black/15 transition-all dark:ring-white/25",
                    selected === null
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "hover:ring-foreground/40",
                  )}
                  style={{ backgroundColor: baseColor }}
                />
              )}
              {colorVariants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selectVariant(v)}
                  title={v.title}
                  aria-label={v.title}
                  aria-pressed={selected?.id === v.id}
                  className={cn(
                    // halki ring hamesha visible (white variant bhi dikhe), fill = exact backend hex
                    "size-7 rounded-full ring-1 ring-black/15 transition-all dark:ring-white/25",
                    selected?.id === v.id
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      : "hover:ring-foreground/40",
                  )}
                  style={{ backgroundColor: v.color ?? undefined }}
                />
              ))}
            </div>
          </div>
        )}

        {/* price */}
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">{formatMoney(price, product.currency)}</span>
          {product.regularPrice > price && (
            <>
              <span className="text-base text-muted-foreground line-through">
                {formatMoney(product.regularPrice, product.currency)}
              </span>
              {product.discountPercent > 0 && (
                <Badge className="bg-rose-500 text-white hover:bg-rose-500">
                  {product.discountPercent}% OFF
                </Badge>
              )}
            </>
          )}
        </div>

        {/* add to cart + wishlist */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <AddToCartButton
              productId={product.id}
              variantId={selected?.id ?? null}
              name={product.title}
              slug={product.slug}
              price={price}
              image={mainImage}
              color={selected?.color ?? null}
              stock={stock}
              size="lg"
            />
          </div>
          <WishlistButton
            productId={product.id}
            variantId={selected?.id ?? null}
            name={product.title}
            slug={product.slug}
            price={price}
            image={mainImage}
            size="lg"
          />
        </div>

        {/* stock + delivery */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className={cn("font-medium", isOutOfStock ? "text-rose-500" : "text-emerald-600")}>
            {isOutOfStock ? "Out of stock" : `In stock (${stock} available)`}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Truck className="size-4" />
            Delivery by <span className="font-medium text-foreground">{delivery.label}</span>
            {location?.city && <span>to {location.city}</span>}
          </p>
        </div>

        <Link
          href={`/product/${product.slug}`}
          className="text-center text-sm font-medium text-primary hover:underline"
        >
          View full details
        </Link>
      </div>
    </div>
  );
}
