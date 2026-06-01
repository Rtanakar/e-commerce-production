// ============================================================================
// products-search.tsx — search input + status/category/sort filters
// ============================================================================

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Filter, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCategories } from "../hooks/use-categories";
import {
  PRODUCT_STATUS_FILTERS,
  PRODUCT_SORTS,
} from "../server/params-loader";

const STATUS_LABELS: Record<string, string> = {
  all: "All statuses",
  DRAFT: "Draft",
  PENDING: "Pending",
  ACTIVE: "Published",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  OUT_OF_STOCK: "Out of stock",
};
const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "price-asc": "Price ↑",
  "price-desc": "Price ↓",
  popular: "Popular",
  rating: "Top rated",
  discount: "Biggest discount",
};

export function ProductsSearch({
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  categoryId,
  onCategoryChange,
  sort,
  onSortChange,
  hasFilters,
  onClear,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: (typeof PRODUCT_STATUS_FILTERS)[number]) => void;
  categoryId: string | null;
  onCategoryChange: (v: string | null) => void;
  sort: string;
  onSortChange: (v: (typeof PRODUCT_SORTS)[number]) => void;
  hasFilters: boolean;
  onClear: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const { data: categories } = useCategories();

  const activeCount =
    (status !== "all" ? 1 : 0) + (categoryId ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search products…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          <AnimatePresence>
            {searchValue && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((s) => !s)}
          className={cn("shrink-0 gap-1.5", showFilters && "border-primary/40 bg-primary/10")}
        >
          <Filter className="size-3.5" /> Filters
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card/40 p-3">
              {/* Status */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                <Select value={status} onValueChange={(v) => onStatusChange(v as (typeof PRODUCT_STATUS_FILTERS)[number])}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUS_FILTERS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Category</label>
                <Select
                  value={categoryId ?? "__all__"}
                  onValueChange={(v) => onCategoryChange(v === "__all__" ? null : v)}
                >
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">All categories</SelectItem>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sort</label>
                <Select value={sort} onValueChange={(v) => onSortChange(v as (typeof PRODUCT_SORTS)[number])}>
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_SORTS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{SORT_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={onClear} className="h-8 gap-1 text-xs text-muted-foreground">
                  <X className="size-3" /> Clear
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
