// ============================================================================
// products-stats.tsx — KPI cards (total / active / draft / out-of-stock)
// ============================================================================
// Parallel count queries (limit=1 → sirf totalCount chahiye). Skeleton while
// loading. Theme-aware + motion.
// ============================================================================

"use client";

import { useQueries } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Boxes, CheckCircle2, FileEdit, PackageX, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { STALE_TIME } from "@/config/constants";
import { productKeys } from "../api/product-keys";
import { fetchSellerProducts } from "../api/products-api";
import type { ListProductsQuery } from "../types";

const QUERIES: { key: string; label: string; icon: LucideIcon; q: ListProductsQuery }[] = [
  { key: "total", label: "Total products", icon: Boxes, q: { page: 1, limit: 1 } },
  { key: "active", label: "Active", icon: CheckCircle2, q: { status: "ACTIVE", page: 1, limit: 1 } },
  { key: "draft", label: "Drafts", icon: FileEdit, q: { status: "DRAFT", page: 1, limit: 1 } },
  { key: "oos", label: "Out of stock", icon: PackageX, q: { status: "OUT_OF_STOCK", page: 1, limit: 1 } },
];

export function ProductsStats() {
  const results = useQueries({
    queries: QUERIES.map((cfg) => ({
      queryKey: productKeys.sellerList(cfg.q),
      queryFn: () => fetchSellerProducts(cfg.q),
      staleTime: STALE_TIME.LIST,
    })),
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {QUERIES.map((cfg, i) => {
        const r = results[i];
        const Icon = cfg.icon;
        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="gap-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{cfg.label}</p>
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              </div>
              {r.isLoading ? (
                <Skeleton className="mt-2 h-7 w-14" />
              ) : (
                <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                  {r.data?.totalCount ?? 0}
                </p>
              )}
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
