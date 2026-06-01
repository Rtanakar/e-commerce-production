// ============================================================================
// media-preview-dialog.tsx — Image/Video preview lightbox (+ live filters)
// ============================================================================
// Reusable preview modal — gallery / banner / variant images / product video
// sab jagah use hota. Features:
//   - Multiple items navigate (prev/next buttons + ←/→ keyboard + thumb strip)
//   - Image: zoom + live CSS filters (brightness/contrast/saturate/grayscale/
//     sepia) — view-only preview (saved nahi hote)
//   - Video: native <video controls>
// shadcn Dialog + framer motion.
// ============================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PreviewItem {
  url: string;
  type: "image" | "video";
  alt?: string;
}

const DEFAULTS = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 };
type Filters = typeof DEFAULTS;

const SLIDERS: { key: keyof Filters; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brightness", min: 0, max: 200 },
  { key: "contrast", label: "Contrast", min: 0, max: 200 },
  { key: "saturate", label: "Saturation", min: 0, max: 200 },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100 },
  { key: "sepia", label: "Sepia", min: 0, max: 100 },
];

export function MediaPreviewDialog({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: PreviewItem[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [zoom, setZoom] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const count = items.length;
  const current = items[index];

  // item ya modal badle → filters/zoom reset
  useEffect(() => {
    setFilters(DEFAULTS);
    setZoom(1);
  }, [index, open]);

  const go = useCallback(
    (dir: number) => {
      if (count < 2) return;
      onIndexChange((index + dir + count) % count);
    },
    [index, count, onIndexChange],
  );

  // keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  const filterCss = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%)`;
  const isImage = current?.type === "image";
  const dirty =
    isImage && (SLIDERS.some((s) => filters[s.key] !== DEFAULTS[s.key]) || zoom !== 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Media preview</DialogTitle>

        {current && (
          <div className="flex flex-col">
            {/* Stage */}
            <div className="relative flex min-h-[40vh] items-center justify-center overflow-auto bg-black/90 p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${index}-${current.url}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={current.url}
                      alt={current.alt ?? ""}
                      draggable={false}
                      style={{ filter: filterCss, transform: `scale(${zoom})` }}
                      className="max-h-[62vh] max-w-full rounded-lg object-contain transition-transform"
                    />
                  ) : (
                    <video
                      src={current.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[62vh] max-w-full rounded-lg"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Prev / Next */}
              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70"
                    aria-label="Next"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] text-white backdrop-blur">
                    {index + 1} / {count}
                  </span>
                </>
              )}
            </div>

            {/* Toolbar — zoom + filter toggle (images only) */}
            {isImage && (
              <div className="flex items-center gap-1 border-t border-border bg-card/60 px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  title="Zoom out"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  title="Zoom in"
                >
                  <ZoomIn className="size-4" />
                </Button>

                <Button
                  type="button"
                  variant={showFilters ? "secondary" : "ghost"}
                  size="sm"
                  className="ml-1 h-8 gap-1.5"
                  onClick={() => setShowFilters((s) => !s)}
                >
                  <SlidersHorizontal className="size-3.5" /> Filters
                </Button>

                {dirty && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-8 gap-1.5 text-muted-foreground"
                    onClick={() => {
                      setFilters(DEFAULTS);
                      setZoom(1);
                    }}
                  >
                    <RotateCcw className="size-3.5" /> Reset
                  </Button>
                )}
              </div>
            )}

            {/* Filter sliders */}
            <AnimatePresence>
              {isImage && showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden border-t border-border bg-card/40"
                >
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                    {SLIDERS.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 text-muted-foreground">
                          {s.label}
                        </span>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          value={filters[s.key]}
                          onChange={(e) =>
                            setFilters((f) => ({ ...f, [s.key]: Number(e.target.value) }))
                          }
                          className="h-1.5 flex-1 cursor-pointer accent-primary"
                        />
                        <span className="w-9 text-right tabular-nums text-muted-foreground">
                          {filters[s.key]}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="px-3 pb-2 text-[10px] text-muted-foreground">
                    Preview only — filters image ko save nahi karte.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thumbnail strip */}
            {count > 1 && (
              <div className="flex gap-1.5 overflow-x-auto border-t border-border bg-card/60 p-2">
                {items.map((it, i) => (
                  <button
                    key={`${it.url}-${i}`}
                    type="button"
                    onClick={() => onIndexChange(i)}
                    className={cn(
                      "relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted",
                      i === index
                        ? "border-primary ring-2 ring-primary/40"
                        : "border-border opacity-70 hover:opacity-100",
                    )}
                  >
                    {it.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.url}
                        alt=""
                        className="size-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center bg-black text-[9px] text-white">
                        VIDEO
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
