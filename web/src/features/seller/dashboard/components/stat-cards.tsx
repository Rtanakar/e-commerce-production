// ============================================================================
// stat-cards.tsx — KPI row (theme-aware, animated)
// ============================================================================
// Generic, data-driven. Pass `stats: StatItem[]`. Trend delta coloured with
// semantic emerald/rose (conventional for up/down) over theme tokens. Icon
// chip uses brand `primary` tint so it adapts to light + dark automatically.
// ============================================================================

"use client";

import { motion } from "motion/react";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatItem {
  label: string;
  value: string;
  /** % change vs previous period; sign drives colour + arrow. */
  delta?: number;
  deltaLabel?: string;
  icon: LucideIcon;
  /** Extra context line under the value, e.g. "27 transactions". */
  hint?: string;
}

export function StatCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s, i) => (
        <StatCard key={s.label} {...s} index={i} />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  hint,
  index,
}: StatItem & { index: number }) {
  const hasDelta = typeof delta === "number";
  const positive = (delta ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="gap-0 p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        </div>

        <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>

        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          {hasDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}
            >
              {positive ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {positive ? "+" : ""}
              {delta}%
            </span>
          )}
          {(deltaLabel || hint) && (
            <span className="truncate text-muted-foreground">
              {deltaLabel ?? hint}
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
