// ============================================================================
// discount-selector.tsx — multi-select seller discount codes (chips)
// ============================================================================
// Flow: codes "Discount Codes" page pe CREATE hote hain → yahan product form me
// sirf SELECT karne ke liye chips dikhte hain (creation yahan NAHI). Selected =
// filled chip. "flash back offer (5%)" jaisa.
// ============================================================================

"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, TicketPercent, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useDiscounts } from "../hooks/use-discounts";
import type { DiscountCode } from "../types";

function label(dc: DiscountCode): string {
  const val = dc.type === "PERCENT" ? `${dc.value}%` : `₹${(dc.value / 100).toFixed(0)}`;
  return `${dc.title || dc.code} (${val})`;
}

export function DiscountSelector({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { data, isLoading } = useDiscounts({ isActive: true, limit: 100 });
  const codes = data?.discounts ?? [];

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
    );
  }

  // Koi code nahi → discount page ka link (creation wahin hoti hai)
  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1.5 rounded-lg border border-dashed border-border bg-card/40 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          No active discount codes yet.
        </p>
        <Link
          href="/seller/discount-codes"
          target="_blank"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Create codes in Discount Codes
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {codes.map((dc) => {
          const active = value.includes(dc.id);
          return (
            <motion.button
              key={dc.id}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={disabled}
              onClick={() => toggle(dc.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {active ? <Check className="size-3.5" /> : <TicketPercent className="size-3.5" />}
              {label(dc)}
            </motion.button>
          );
        })}
      </div>

      {/* Manage link — naye codes Discount Codes page pe banao */}
      <Link
        href="/seller/discount-codes"
        target="_blank"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
      >
        Manage discount codes
        <ArrowUpRight className="size-3" />
      </Link>
    </div>
  );
}
