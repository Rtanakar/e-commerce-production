// ============================================================================
// product-card.tsx — Storefront product card (Amazon/Flipkart style)
// ============================================================================
// Features:
//   - Multiple images: hover thumbnail STRIP (reference jaisa) — thumb hover pe
//     main image switch (motion crossfade). Single image → no strip.
//   - COLOR VARIANTS: agar product ke color variants hain to swatches dikhte;
//     swatch click pe poora image-set + price + stock variant ka ho jaata
//     (Amazon "red/black click → wahi variant dikhta" pattern).
//   - Discount badge, out-of-stock badge, rating, wishlist heart, quick-view eye.
//   - Add-to-cart selected-variant aware.
// ============================================================================

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Eye, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/utils/currency";
import { AddToCartButton } from "./add-to-cart-button";
import { WishlistButton } from "./wishlist-button";
import { StarRating } from "./star-rating";
import type { ShopImage, ShopProduct, ShopVariant } from "../types";

interface ProductCardProps {
  product: ShopProduct;
  onQuickView?: (product: ShopProduct) => void;
}

export function ProductCard({ product, onQuickView }: ProductCardProps) {
  const variants = product.variants ?? [];
  const colorVariants = variants.filter((v) => v.color);
  // base product ka pehla hex color → default swatch (image nahi, actual color)
  const baseColor = product.colors?.[0] ?? null;
  // swatch row tabhi jab base color ya koi color variant ho
  const hasColors = !!baseColor || colorVariants.length > 0;

  // selected color variant (null = base product)
  const [selected, setSelected] = useState<ShopVariant | null>(null);
  // hovered thumbnail index (null = show first/primary)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // active gallery — variant images warna product images
  const gallery: ShopImage[] = useMemo(() => {
    const imgs = selected?.images?.length ? selected.images : product.images;
    return imgs ?? [];
  }, [selected, product.images]);

  const displayedImage =
    hoverIdx !== null ? gallery[hoverIdx]?.url : gallery[0]?.url;
  const hasMultipleImages = gallery.length > 1;

  // effective price/stock (variant overrides)
  const price = selected?.price ?? product.salePrice;
  const stock = selected ? selected.stock : product.stock;
  const isOutOfStock = stock <= 0;
  const discount = product.discountPercent;

  const selectVariant = (v: ShopVariant | null) => {
    setSelected(v);
    setHoverIdx(null); // variant switch pe image reset
  };

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-card p-0 shadow-sm ring-1 ring-border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* ── Image ── */}
      <div className="relative">
        <Link href={`/product/${product.slug}`} className="block">
          <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/40">
            <AnimatePresence mode="wait">
              {displayedImage ? (
                <motion.div
                  key={displayedImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={displayedImage}
                    alt={product.title}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  />
                </motion.div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/30">
                  <ImageOff className="size-12" />
                </div>
              )}
            </AnimatePresence>
          </div>
        </Link>

        {/* top-left badge stack: category TAG (transparent glass overlay, Amazon/
            Flipkart style) + discount/out-of-stock niche. Subcategory ho to wahi
            (zyada specific "Mobiles"), warna category ("Electronics"). */}
        <div className="absolute left-3 top-3 z-10 flex max-w-[75%] flex-col items-start gap-2">
          {(product.subcategory || product.category) && (
            <Badge className="max-w-full truncate rounded-full border-0 bg-black/50 px-2.5 py-1 text-[11px] font-medium capitalize text-white shadow-sm backdrop-blur-md hover:bg-black/50">
              {product.subcategory?.name ?? product.category?.name}
            </Badge>
          )}
          {discount > 0 && !isOutOfStock && (
            <Badge className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-rose-500">
              {discount}% OFF
            </Badge>
          )}
          {isOutOfStock && (
            <Badge variant="destructive" className="rounded-full px-2.5 py-1 text-xs shadow">
              Out of Stock
            </Badge>
          )}
        </div>

        {/* top-right: wishlist + quick view (hover reveal) */}
        <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <WishlistButton
            productId={product.id}
            variantId={selected?.id ?? null}
            name={product.title}
            slug={product.slug}
            price={price}
            image={displayedImage}
            size="sm"
          />
          {onQuickView && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={(e) => {
                e.preventDefault();
                onQuickView(product);
              }}
              aria-label="Quick view"
              className="flex size-8 items-center justify-center rounded-full border border-input bg-background/90 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
            >
              <Eye className="size-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Hover thumbnail strip (multiple images) ── */}
      {hasMultipleImages && (
        <div className="flex gap-2 border-t border-border bg-muted/30 p-2.5">
          {gallery.slice(0, 4).map((image, index) => (
            <button
              key={image.url}
              type="button"
              onMouseEnter={() => setHoverIdx(index)}
              onMouseLeave={() => setHoverIdx(null)}
              aria-label={`View image ${index + 1}`}
              className={cn(
                "relative h-12 flex-1 overflow-hidden rounded-md transition-all duration-200",
                (hoverIdx ?? 0) === index
                  ? "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                  : "opacity-60 hover:opacity-100",
              )}
            >
              <Image src={image.url} alt="" fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}

      {/* ── Color swatches (variant switch) ── */}
      {/* Pehla swatch = DEFAULT/base product (original images pe wapas). Iske baad
          har color variant. Har swatch pe halki ring (light+dark dono me visible).
          Variant ka fill EXACT backend hex hai (theme se change nahi hota) — sirf
          patli ring border visibility ke liye. */}
      {hasColors && (
        <div className="flex items-center gap-2 px-4 pt-3">
          {/* default/base swatch = base product ka ACTUAL color (colors[0] hex).
              Image nahi — pure color. colors[] na ho to default swatch skip
              (sirf variant swatches dikhte). Fill exact hex, theme touch nahi karta. */}
          {baseColor && (
            <button
              type="button"
              onClick={() => selectVariant(null)}
              title="Default"
              aria-label="Default"
              aria-pressed={selected === null}
              className={cn(
                "size-6 rounded-full ring-1 ring-black/15 transition-all dark:ring-white/25",
                selected === null
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                  : "hover:ring-foreground/40",
              )}
              style={{ backgroundColor: baseColor }}
            />
          )}

          {colorVariants.slice(0, 5).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectVariant(v)}
              title={v.title}
              aria-label={v.title}
              aria-pressed={selected?.id === v.id}
              className={cn(
                "size-6 rounded-full ring-1 ring-black/15 transition-all dark:ring-white/25",
                selected?.id === v.id
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                  : "hover:ring-foreground/40",
              )}
              // EXACT backend color — theme isko touch nahi karta
              style={{ backgroundColor: v.color ?? undefined }}
            />
          ))}
          {colorVariants.length > 5 && (
            <span className="text-[11px] text-muted-foreground">
              +{colorVariants.length - 5}
            </span>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <CardContent className="flex grow flex-col gap-2 px-4 py-3">
        {/* brand (category/subcategory ab image ke top-left badge me dikhta) */}
        {product.brand && (
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </div>
        )}

        <Link href={`/product/${product.slug}`} className="block">
          <h3 className="line-clamp-1 text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
            {product.title}
          </h3>
        </Link>

        {/* 5-star review row (Amazon/Flipkart style) */}
        <StarRating rating={product.ratingAvg} count={product.ratingCount} />

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-foreground">
              {formatMoney(price, product.currency)}
            </span>
            {product.regularPrice > price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatMoney(product.regularPrice, product.currency)}
              </span>
            )}
          </div>
        </div>
      </CardContent>

      {/* ── Footer: add to cart ── */}
      <CardFooter className="mt-auto p-3 pt-0">
        <AddToCartButton
          productId={product.id}
          variantId={selected?.id ?? null}
          name={product.title}
          slug={product.slug}
          price={price}
          image={displayedImage}
          color={selected?.color ?? null}
          stock={stock}
        />
      </CardFooter>
    </Card>
  );
}
