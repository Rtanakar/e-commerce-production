// ============================================================================
// product-banner-carousel.tsx — Hero banner carousel (framer motion + autoplay)
// ============================================================================
// Top-of-home promotional carousel. Featured products (ya jinke paas banner ho)
// rotate karte. Dependency-free autoplay (setInterval, pause on hover), motion
// slide crossfade, prev/next arrows + dot indicators. Theme-aware.
//
// Empty/loading pe kuch nahi dikhata (graceful). Slides = products with images.
// ============================================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/utils/currency";
import { useShopProducts } from "../hooks/use-shop-products";
import type { ShopProduct } from "../types";

const AUTOPLAY_MS = 5000;

export function ProductBannerCarousel() {
  const { data } = useShopProducts({ sort: "newest", limit: 20 });
  // SIRF woh products jinke paas seller-uploaded banner hai (product gallery image
  // nahi — create-time "Banner (optional)" wala dedicated wide banner)
  const slides = (data?.products ?? []).filter(
    (p): p is ShopProduct & { bannerUrl: string } =>
      typeof p.bannerUrl === "string" && p.bannerUrl.length > 0,
  );

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = slides.length;

  const goTo = useCallback(
    (next: number, dir: number) => {
      if (count === 0) return;
      setDirection(dir);
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const next = useCallback(() => goTo(index + 1, 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1, -1), [index, goTo]);

  // autoplay (pause on hover)
  useEffect(() => {
    if (paused || count <= 1) return;
    timer.current = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, count]);

  if (count === 0) return null;

  const slide = slides[index];

  return (
    <div
      className="relative mx-auto w-full max-w-360 px-4 pt-6 sm:px-6 lg:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-zinc-900 sm:h-64 md:h-80">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <BannerSlide product={slide} />
          </motion.div>
        </AnimatePresence>

        {/* arrows */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {/* dots */}
        {count > 1 && (
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i, i > index ? 1 : -1)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BannerSlide({ product }: { product: ShopProduct & { bannerUrl: string } }) {
  return (
    <div className="relative h-full w-full">
      <Image
        src={product.bannerUrl}
        alt={product.title}
        fill
        className="object-cover opacity-80"
        sizes="100vw"
        priority
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
      <div className="absolute inset-0 flex items-center px-6 sm:px-12">
        <div className="max-w-md space-y-3">
          {product.category && (
            // Category + subcategory breadcrumb chip (Amazon/Flipkart style)
            // Subcategory ho to "Electronics › Smartphones" dikhe, warna sirf category
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white backdrop-blur">
              {product.category.name}
              {product.subcategory && (
                <>
                  <ChevronRight className="size-3 text-white/60" />
                  {product.subcategory.name}
                </>
              )}
            </span>
          )}
          <h2 className="line-clamp-2 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            {product.title}
          </h2>
          <p className="text-lg font-semibold text-white/90">
            {formatMoney(product.salePrice, product.currency)}
            {product.regularPrice > product.salePrice && (
              <span className="ml-2 text-sm text-white/60 line-through">
                {formatMoney(product.regularPrice, product.currency)}
              </span>
            )}
          </p>
          <Button
            asChild
            size="sm"
            className="group/btn bg-white font-semibold text-zinc-900 shadow-md transition-all hover:bg-white hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Link href={`/product/${product.slug}`}>
              Shop Now
              <ArrowRight className="ml-2 size-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
