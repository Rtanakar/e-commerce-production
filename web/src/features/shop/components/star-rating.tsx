// ============================================================================
// star-rating.tsx — 5-star review display (half-star support)
// ============================================================================
// Amazon/Flipkart style: filled + half + empty stars + "(count)". ratingAvg
// 0..5. Half star ke liye clip-path overlay (gradient nahi, crisp). Read-only.
// ============================================================================

"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number; // 0..5
  count?: number;
  size?: "sm" | "md";
  showCount?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  count = 0,
  size = "sm",
  showCount = true,
  className,
}: StarRatingProps) {
  const starSize = size === "sm" ? "size-3.5" : "size-4";
  const clamped = Math.max(0, Math.min(5, rating));

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          // is star ka fill ratio (0, 0.5, ya 1)
          const fillPct = Math.max(0, Math.min(1, clamped - i)) * 100;
          return (
            <span key={i} className="relative inline-block">
              {/* empty base */}
              <Star className={cn(starSize, "text-muted-foreground/30")} />
              {/* filled overlay (clipped to fillPct width) */}
              {fillPct > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fillPct}%` }}
                >
                  <Star className={cn(starSize, "fill-amber-400 text-amber-400")} />
                </span>
              )}
            </span>
          );
        })}
      </div>
      {showCount && (
        <span className="text-xs text-muted-foreground">
          {count > 0 ? `${clamped.toFixed(1)} (${count})` : "No reviews"}
        </span>
      )}
    </div>
  );
}
