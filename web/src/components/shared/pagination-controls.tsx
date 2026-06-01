// ============================================================================
// pagination-controls.tsx — reusable pagination (numbered + prev/next)
// ============================================================================
// ≤7 pages → all numbers; more → ellipsis windowing. Theme-aware + motion.
// ============================================================================

"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { PAGINATION } from "@/config/constants";
import { useEffect, useState } from "react";

// 10 pages se zyada ho to dropdown annoying — input box use karo
// (GitHub, Linear, Vercel pattern)
const DROPDOWN_PAGE_THRESHOLD = 10;

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, "...", total];
  if (current >= total - 2) return [1, "...", total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  hasNextPage,
  hasPreviousPage,
  isFetching,
  onNextPage,
  onPreviousPage,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  totalCount?: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFetching?: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const safePage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
  const nums = pageNumbers(safePage, totalPages);
  const useInput = totalPages > DROPDOWN_PAGE_THRESHOLD;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      <p className="whitespace-nowrap text-sm text-muted-foreground">
        Page <span className="font-semibold text-foreground">{safePage}</span>{" "}
        of <span className="font-semibold text-foreground">{totalPages}</span>
        {totalCount !== undefined && (
          <span className="ml-1.5 text-xs text-muted-foreground/70">
            ({totalCount} total)
          </span>
        )}
      </p>

      {/* Center — numbered + jump */}
      <div className="flex items-center gap-1.5">
        <div className="hidden items-center gap-1 md:flex">
          {nums.map((p, i) =>
            p === "..." ? (
              <span
                key={`d${i}`}
                className="flex size-8 items-center justify-center text-muted-foreground/50"
              >
                <MoreHorizontal className="size-3.5" />
              </span>
            ) : (
              <Button
                key={p}
                variant={p === safePage ? "default" : "outline"}
                size="icon"
                className={cn(
                  "size-8 text-xs font-medium",
                  p === safePage && "pointer-events-none",
                )}
                disabled={isFetching && p !== safePage}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
        </div>

        <span className="hidden md:block mx-0.5 h-4 w-px bg-white/10" />

        {/* Smart jump — dropdown ≤10 / input >10 */}
        {useInput ? (
          <PageInput
            page={safePage}
            totalPages={totalPages}
            isFetching={isFetching}
            onPageChange={onPageChange}
          />
        ) : (
          <PageDropdown
            page={safePage}
            totalPages={totalPages}
            isFetching={isFetching}
            onPageChange={onPageChange}
          />
        )}
      </div>

      {/* Right — Prev / Next */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPreviousPage || isFetching}
          onClick={onPreviousPage}
          className="gap-1.5"
        >
          <ChevronLeft className="size-3.5" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage || isFetching}
          onClick={onNextPage}
          className="gap-1.5"
        >
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Dropdown (≤10 pages) ────────────────────────────────────
function PageDropdown({
  page,
  totalPages,
  isFetching,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  isFetching?: boolean;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-white/55">Page</span>
      <Select
        value={String(page)}
        onValueChange={(v) => onPageChange(Number(v))}
        disabled={isFetching || totalPages <= 1}
      >
        <SelectTrigger className="h-8 w-16 text-xs font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={4}
          className="max-h-60 min-w-16"
        >
          {Array.from(
            { length: totalPages },
            (_, i) => i + PAGINATION.DEFAULT_PAGE,
          ).map((p) => (
            <SelectItem key={p} value={String(p)} className="text-xs">
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="whitespace-nowrap text-xs text-white/55">
        of <span className="font-semibold text-white">{totalPages}</span>
      </span>
    </div>
  );
}

// ─── Input (>10 pages) ───────────────────────────────────────
function PageInput({
  page,
  totalPages,
  isFetching,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  isFetching?: boolean;
  onPageChange: (p: number) => void;
}) {
  const [value, setValue] = useState(String(page));

  // Sync when external page changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(String(page));
  }, [page]);

  const commit = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (
      !isNaN(parsed) &&
      parsed >= PAGINATION.DEFAULT_PAGE &&
      parsed <= totalPages
    ) {
      onPageChange(parsed);
    } else {
      setValue(String(page)); // reset on invalid
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-white/55">Page</span>
      <input
        type="number"
        min={PAGINATION.DEFAULT_PAGE}
        max={totalPages}
        value={value}
        disabled={isFetching}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(value);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            const next = Math.min(page + 1, totalPages);
            setValue(String(next));
            onPageChange(next);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            const prev = Math.max(page - 1, PAGINATION.DEFAULT_PAGE);
            setValue(String(prev));
            onPageChange(prev);
          }
        }}
        className={cn(
          "h-8 w-14 rounded-md border border-[rgba(255,90,31,0.2)] bg-[rgba(15,10,7,0.6)]",
          "px-2 text-center text-xs font-medium text-white",
          "focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[appearance:textfield]",
          "[&::-webkit-outer-spin-button]:appearance-none",
          "[&::-webkit-inner-spin-button]:appearance-none",
        )}
      />
      <span className="whitespace-nowrap text-xs text-white/55">
        of <span className="font-semibold text-white">{totalPages}</span>
      </span>
    </div>
  );
}
